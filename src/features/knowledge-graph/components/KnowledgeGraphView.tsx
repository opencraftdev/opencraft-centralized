"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import SpriteText from "three-spritetext";

import { createClient } from "@/lib/supabase/client";
import type { BrandGraph, KnowledgeNode } from "../types";
import { NODE_TYPE_META, nodeColor } from "../types";
import { getBrandGraph } from "../queries";

// react-force-graph-3d pulls in three.js / WebGL — must only run in the browser.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9aa0a6",
        fontSize: 14,
      }}
    >
      Loading 3D graph…
    </Box>
  ),
});

// Shapes react-force-graph mutates the node/link objects in place (adds x/y/z,
// resolves source/target to node refs), so we use loose local types here.
type GNode = Omit<KnowledgeNode, "x" | "y" | "z"> & {
  degree: number;
  // force-graph fills these in at runtime; null seed positions become undefined.
  x?: number;
  y?: number;
  z?: number;
};
type GLink = {
  id: string;
  source: string | GNode;
  target: string | GNode;
  relation: string;
  weight: number;
};

type ForceGraphHandle = {
  cameraPosition: (
    pos: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    ms?: number,
  ) => void;
};

export function KnowledgeGraphView({ graph: initialGraph }: { graph: BrandGraph }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphHandle | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<GNode | null>(null);
  // Live graph state: seeded from the server fetch, then kept in sync with
  // Supabase via realtime so MCP/DB edits appear without a reload.
  const [graph, setGraph] = useState<BrandGraph>(initialGraph);
  const [live, setLive] = useState(false);

  useEffect(() => setGraph(initialGraph), [initialGraph]);

  // Subscribe to Supabase Realtime for this brand's nodes + edges.
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refresh = async () => {
      try {
        const next = await getBrandGraph(supabase, initialGraph.brandSlug);
        if (active && next.nodes.length) setGraph(next);
      } catch {
        /* keep the last good graph on transient errors */
      }
    };

    (async () => {
      // Bind the user's session token so realtime honours RLS.
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      const filter = `brand_slug=eq.${initialGraph.brandSlug}`;
      channel = supabase
        .channel(`brand-knowledge-${initialGraph.brandSlug}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "brand_knowledge_nodes", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "brand_knowledge_edges", filter }, refresh)
        .subscribe((status) => {
          if (active) setLive(status === "SUBSCRIBED");
        });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [initialGraph.brandSlug]);

  // The set of node types actually present, in legend order.
  const presentTypes = useMemo(() => {
    const order = Object.keys(NODE_TYPE_META);
    const set = new Set(graph.nodes.map((n) => n.type));
    const known = order.filter((t) => set.has(t));
    const extra = [...set].filter((t) => !order.includes(t));
    return [...known, ...extra];
  }, [graph.nodes]);

  // Build force-graph data, filtering out hidden types and any dangling links.
  const data = useMemo(() => {
    const degree = new Map<string, number>();
    graph.edges.forEach((e) => {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    });

    const visible = graph.nodes.filter((n) => !hidden.has(n.type));
    const visibleIds = new Set(visible.map((n) => n.id));

    const nodes: GNode[] = visible.map((n) => ({
      ...n,
      x: n.x ?? undefined,
      y: n.y ?? undefined,
      z: n.z ?? undefined,
      degree: degree.get(n.id) ?? 0,
    }));
    const links: GLink[] = graph.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        relation: e.relation,
        weight: e.weight,
      }));

    return { nodes, links };
  }, [graph, hidden]);

  // Keep the canvas sized to its container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleType = useCallback((type: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const nodeThreeObject = useCallback((node: GNode) => {
    const sprite = new SpriteText(`${node.icon ? node.icon + " " : ""}${node.label}`);
    sprite.color = "#e8eaed";
    sprite.textHeight = node.type === "brand" ? 6 : 3.2;
    sprite.fontWeight = node.type === "brand" ? "700" : "500";
    sprite.backgroundColor = "rgba(15,17,23,0.55)";
    sprite.padding = 1.5;
    sprite.borderRadius = 2;
    // Float the label just above the node sphere. (three-spritetext extends
    // THREE.Sprite at runtime but its types don't surface `position`.)
    (sprite as unknown as { position: { set: (x: number, y: number, z: number) => void } })
      .position.set(0, (node.type === "brand" ? 10 : 6) + node.degree * 0.4, 0);
    return sprite;
  }, []);

  const focusNode = useCallback((node: GNode) => {
    setSelected(node);
    const fg = fgRef.current;
    if (!fg || node.x == null) return;
    const nx = node.x;
    const ny = node.y ?? 0;
    const nz = node.z ?? 0;
    const dist = 120;
    const ratio = 1 + dist / (Math.hypot(nx, ny, nz) || 1);
    fg.cameraPosition(
      { x: nx * ratio, y: ny * ratio, z: nz * ratio },
      { x: nx, y: ny, z: nz },
      800,
    );
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%" }}>
      {/* Legend / type filters */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
        <Chip
          size="small"
          label={live ? "● Live" : "○ Connecting…"}
          title={live ? "Connected to Supabase Realtime" : "Connecting to Supabase…"}
          sx={{
            fontWeight: 600,
            fontSize: "0.72rem",
            color: live ? "#fff" : "#9aa0a6",
            bgcolor: live ? "#16a34a" : "#2a2d35",
            "& .MuiChip-label": { px: 1.25 },
          }}
        />
        {presentTypes.map((type) => {
          const meta = NODE_TYPE_META[type];
          const color = meta?.color ?? "#94a3b8";
          const off = hidden.has(type);
          return (
            <Chip
              key={type}
              size="small"
              onClick={() => toggleType(type)}
              label={meta?.label ?? type}
              sx={{
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.72rem",
                color: off ? "#9aa0a6" : "#fff",
                bgcolor: off ? "#2a2d35" : color,
                opacity: off ? 0.5 : 1,
                "& .MuiChip-label": { px: 1.25 },
                "&:hover": { bgcolor: off ? "#33363f" : color, opacity: off ? 0.7 : 0.9 },
              }}
            />
          );
        })}
      </Box>

      {/* 3D canvas */}
      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 560,
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: "#0b0e14",
          border: "1px solid #1f2430",
        }}
      >
        {size.width > 0 && (
          <ForceGraph3D
            ref={fgRef as never}
            graphData={data}
            width={size.width}
            height={size.height}
            backgroundColor="#0b0e14"
            showNavInfo={false}
            nodeId="id"
            nodeColor={(n) => nodeColor(n as GNode)}
            nodeVal={(n) => 2 + (n as GNode).degree * 1.5}
            nodeOpacity={0.95}
            nodeResolution={16}
            nodeThreeObjectExtend
            nodeThreeObject={nodeThreeObject as never}
            nodeLabel={(n) => {
              const node = n as GNode;
              return `<div style="font:13px sans-serif;color:#fff;background:#1a1d24;padding:6px 9px;border-radius:6px;max-width:260px;border:1px solid #2a2d35">
                <b>${node.label}</b><br/>
                <span style="color:#9aa0a6;font-size:11px">${NODE_TYPE_META[node.type]?.label ?? node.type}</span>
                ${node.description ? `<br/><span style="color:#c8ccd2;font-size:11px">${node.description}</span>` : ""}
              </div>`;
            }}
            linkColor={() => "rgba(150,160,180,0.35)"}
            linkWidth={(l) => 0.4 + (l as GLink).weight * 0.5}
            linkDirectionalParticles={(l) => Math.min(4, Math.round((l as GLink).weight))}
            linkDirectionalParticleSpeed={0.006}
            linkDirectionalParticleWidth={1.4}
            linkLabel={(l) => (l as GLink).relation}
            onNodeClick={(n) => focusNode(n as GNode)}
            onBackgroundClick={() => setSelected(null)}
            cooldownTicks={120}
          />
        )}

        {/* Selected-node detail panel */}
        {selected && (
          <Box
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 260,
              p: 1.75,
              borderRadius: 2,
              bgcolor: "rgba(20,23,30,0.92)",
              border: "1px solid #2a2d35",
              backdropFilter: "blur(6px)",
            }}
          >
            <Chip
              size="small"
              label={NODE_TYPE_META[selected.type]?.label ?? selected.type}
              sx={{
                bgcolor: nodeColor(selected),
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.68rem",
                mb: 1,
              }}
            />
            <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: "0.95rem" }}>
              {selected.icon ? `${selected.icon} ` : ""}
              {selected.label}
            </Typography>
            {selected.description && (
              <Typography sx={{ color: "#c8ccd2", fontSize: "0.8rem", mt: 0.5 }}>
                {selected.description}
              </Typography>
            )}
            <Typography sx={{ color: "#9aa0a6", fontSize: "0.72rem", mt: 1 }}>
              {selected.degree} connection{selected.degree === 1 ? "" : "s"}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
