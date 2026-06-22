#!/usr/bin/env bun
/**
 * Brand Knowledge MCP server.
 *
 * Exposes the brand knowledge graph (Supabase tables `brand_knowledge_nodes`
 * and `brand_knowledge_edges`) over the Model Context Protocol so internal
 * agents can read and curate everything about a brand.
 *
 * Transport: stdio. Auth: Supabase service-role key (full read/write).
 *
 * Required env:
 *   SUPABASE_URL                (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional env:
 *   BRAND_KNOWLEDGE_DEFAULT_BRAND   default brand_slug (default: "opencraft")
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Zero-config env: if the Supabase vars aren't already in the environment,
 * walk up from this file to find the repo's `.env.local` and load the keys we
 * need. Keeps secrets out of the MCP config file regardless of launch cwd.
 */
function loadDotEnvLocal() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env.local");
    if (existsSync(candidate)) {
      for (const line of readFileSync(candidate, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const [, key, rawVal] = m;
        if (process.env[key] !== undefined) continue;
        process.env[key] = rawVal.replace(/^["']|["']$/g, "");
      }
      return;
    }
    dir = dirname(dir);
  }
}
loadDotEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_BRAND = process.env.BRAND_KNOWLEDGE_DEFAULT_BRAND ?? "opencraft";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "[brand-knowledge-mcp] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.",
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const NODE_COLS = "id,brand_slug,type,label,description,props,color,icon,x,y,z,created_at,updated_at";
const EDGE_COLS = "id,brand_slug,source_id,target_id,relation,weight,props,created_at";

/** Wrap a JSON-able value as an MCP text-content result. */
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/** Resolve a node reference (uuid OR exact label) to a node id within a brand. */
async function resolveNodeId(brand: string, ref: string): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
  if (isUuid) {
    const { data } = await supabase
      .from("brand_knowledge_nodes")
      .select("id")
      .eq("id", ref)
      .maybeSingle();
    return data?.id ?? null;
  }
  const { data } = await supabase
    .from("brand_knowledge_nodes")
    .select("id")
    .eq("brand_slug", brand)
    .eq("label", ref)
    .maybeSingle();
  return data?.id ?? null;
}

const server = new McpServer({ name: "brand-knowledge", version: "0.1.0" });

const brandArg = z
  .string()
  .optional()
  .describe(`Brand slug. Defaults to "${DEFAULT_BRAND}".`);

// ── get_graph ──────────────────────────────────────────────────────────────
server.registerTool(
  "get_graph",
  {
    title: "Get full brand knowledge graph",
    description:
      "Return the entire knowledge graph (all nodes and edges) for a brand, plus counts by node type. Use this for an overview or to feed a visualization.",
    inputSchema: { brand_slug: brandArg },
  },
  async ({ brand_slug }) => {
    const brand = brand_slug ?? DEFAULT_BRAND;
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from("brand_knowledge_nodes").select(NODE_COLS).eq("brand_slug", brand),
      supabase.from("brand_knowledge_edges").select(EDGE_COLS).eq("brand_slug", brand),
    ]);
    if (nodesRes.error) return fail(nodesRes.error.message);
    if (edgesRes.error) return fail(edgesRes.error.message);

    const byType: Record<string, number> = {};
    for (const n of nodesRes.data ?? []) byType[n.type] = (byType[n.type] ?? 0) + 1;

    return ok({
      brand_slug: brand,
      counts: { nodes: nodesRes.data?.length ?? 0, edges: edgesRes.data?.length ?? 0, by_type: byType },
      nodes: nodesRes.data,
      edges: edgesRes.data,
    });
  },
);

// ── search_nodes ────────────────────────────────────────────────────────────
server.registerTool(
  "search_nodes",
  {
    title: "Search knowledge nodes",
    description:
      "Find nodes whose label or description matches a query (case-insensitive). Optionally filter by node type. Use this to answer 'what does the brand know/think about X'.",
    inputSchema: {
      query: z.string().describe("Text to match against node label and description."),
      brand_slug: brandArg,
      type: z.string().optional().describe("Optional node type filter, e.g. 'topic', 'audience'."),
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)."),
    },
  },
  async ({ query, brand_slug, type, limit }) => {
    const brand = brand_slug ?? DEFAULT_BRAND;
    let q = supabase
      .from("brand_knowledge_nodes")
      .select(NODE_COLS)
      .eq("brand_slug", brand)
      .or(`label.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit ?? 20);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok({ brand_slug: brand, query, matches: data });
  },
);

// ── get_node ────────────────────────────────────────────────────────────────
server.registerTool(
  "get_node",
  {
    title: "Get a node with its relationships",
    description:
      "Return one node (by id or exact label) together with its outgoing and incoming edges, including the neighbour node labels. A 360° view of one entity.",
    inputSchema: {
      ref: z.string().describe("Node id (uuid) or exact label."),
      brand_slug: brandArg,
    },
  },
  async ({ ref, brand_slug }) => {
    const brand = brand_slug ?? DEFAULT_BRAND;
    const id = await resolveNodeId(brand, ref);
    if (!id) return fail(`No node found for ref "${ref}" in brand "${brand}".`);

    const [nodeRes, outRes, inRes] = await Promise.all([
      supabase.from("brand_knowledge_nodes").select(NODE_COLS).eq("id", id).single(),
      supabase
        .from("brand_knowledge_edges")
        .select(`${EDGE_COLS}, target:target_id(id,label,type)`)
        .eq("source_id", id),
      supabase
        .from("brand_knowledge_edges")
        .select(`${EDGE_COLS}, source:source_id(id,label,type)`)
        .eq("target_id", id),
    ]);
    if (nodeRes.error) return fail(nodeRes.error.message);

    return ok({
      node: nodeRes.data,
      outgoing: outRes.data ?? [],
      incoming: inRes.data ?? [],
    });
  },
);

// ── list_types ──────────────────────────────────────────────────────────────
server.registerTool(
  "list_types",
  {
    title: "List node types with counts",
    description: "Return the distinct node types in a brand graph and how many nodes each has.",
    inputSchema: { brand_slug: brandArg },
  },
  async ({ brand_slug }) => {
    const brand = brand_slug ?? DEFAULT_BRAND;
    const { data, error } = await supabase
      .from("brand_knowledge_nodes")
      .select("type")
      .eq("brand_slug", brand);
    if (error) return fail(error.message);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[r.type] = (counts[r.type] ?? 0) + 1;
    return ok({ brand_slug: brand, types: counts });
  },
);

// ── upsert_node ─────────────────────────────────────────────────────────────
server.registerTool(
  "upsert_node",
  {
    title: "Create or update a knowledge node",
    description:
      "Insert a new node, or update an existing one when `id` is supplied. Use to curate the brand's knowledge (add a topic, value, audience, competitor, etc.).",
    inputSchema: {
      id: z.string().uuid().optional().describe("Existing node id to update. Omit to create."),
      brand_slug: brandArg,
      type: z.string().describe("Node type, e.g. brand|value|topic|subtopic|audience|persona|channel|tone|strategy|anti_topic|competitor."),
      label: z.string().describe("Display label (unique per brand recommended)."),
      description: z.string().optional(),
      props: z.record(z.any()).optional().describe("Arbitrary JSON metadata."),
      color: z.string().optional().describe("Hex colour for the viz, e.g. '#6366f1'."),
      icon: z.string().optional().describe("Emoji or short icon."),
    },
  },
  async ({ id, brand_slug, type, label, description, props, color, icon }) => {
    const brand = brand_slug ?? DEFAULT_BRAND;
    const row: Record<string, unknown> = { brand_slug: brand, type, label };
    if (description !== undefined) row.description = description;
    if (props !== undefined) row.props = props;
    if (color !== undefined) row.color = color;
    if (icon !== undefined) row.icon = icon;
    if (id) row.id = id;

    const { data, error } = await supabase
      .from("brand_knowledge_nodes")
      .upsert(row, { onConflict: "id" })
      .select(NODE_COLS)
      .single();
    if (error) return fail(error.message);
    return ok({ saved: data });
  },
);

// ── add_edge ────────────────────────────────────────────────────────────────
server.registerTool(
  "add_edge",
  {
    title: "Add a relationship between two nodes",
    description:
      "Create an edge from source to target. Each endpoint may be a node id (uuid) or an exact node label (resolved within the brand).",
    inputSchema: {
      brand_slug: brandArg,
      source: z.string().describe("Source node id or exact label."),
      target: z.string().describe("Target node id or exact label."),
      relation: z.string().describe("Relationship verb, e.g. offers|serves|values|includes|interested_in|avoids|publishes_on|has_tone|uses_strategy|competes_with."),
      weight: z.number().optional().describe("Edge weight / strength (default 1)."),
      props: z.record(z.any()).optional(),
    },
  },
  async ({ brand_slug, source, target, relation, weight, props }) => {
    const brand = brand_slug ?? DEFAULT_BRAND;
    const [sourceId, targetId] = await Promise.all([
      resolveNodeId(brand, source),
      resolveNodeId(brand, target),
    ]);
    if (!sourceId) return fail(`Source node not found: "${source}".`);
    if (!targetId) return fail(`Target node not found: "${target}".`);
    if (sourceId === targetId) return fail("Self-loops are not allowed.");

    const { data, error } = await supabase
      .from("brand_knowledge_edges")
      .insert({
        brand_slug: brand,
        source_id: sourceId,
        target_id: targetId,
        relation,
        weight: weight ?? 1,
        props: props ?? {},
      })
      .select(EDGE_COLS)
      .single();
    if (error) return fail(error.message);
    return ok({ added: data });
  },
);

// ── delete_node ─────────────────────────────────────────────────────────────
server.registerTool(
  "delete_node",
  {
    title: "Delete a node (and its edges)",
    description:
      "Permanently delete a node by id. Connected edges are removed via cascade. Use carefully.",
    inputSchema: { id: z.string().uuid().describe("Node id to delete.") },
  },
  async ({ id }) => {
    const { error } = await supabase.from("brand_knowledge_nodes").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok({ deleted: id });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[brand-knowledge-mcp] ready (default brand: ${DEFAULT_BRAND})`);
