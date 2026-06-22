import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandGraph, KnowledgeEdge, KnowledgeNode } from "./types";

type NodeRow = {
  id: string;
  type: string;
  label: string;
  description: string | null;
  props: Record<string, unknown> | null;
  color: string | null;
  icon: string | null;
  x: number | null;
  y: number | null;
  z: number | null;
};

type EdgeRow = {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  weight: number | string | null;
  props: Record<string, unknown> | null;
};

function toNode(row: NodeRow): KnowledgeNode {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    description: row.description,
    props: row.props ?? {},
    color: row.color,
    icon: row.icon,
    x: row.x,
    y: row.y,
    z: row.z,
  };
}

function toEdge(row: EdgeRow): KnowledgeEdge {
  return {
    id: row.id,
    source: row.source_id,
    target: row.target_id,
    relation: row.relation,
    weight: row.weight == null ? 1 : Number(row.weight),
    props: row.props ?? {},
  };
}

/** Load the full knowledge graph (nodes + edges) for a brand. */
export async function getBrandGraph(
  supabase: SupabaseClient,
  brandSlug = "opencraft",
): Promise<BrandGraph> {
  const [nodesRes, edgesRes] = await Promise.all([
    supabase
      .from("brand_knowledge_nodes")
      .select("id,type,label,description,props,color,icon,x,y,z")
      .eq("brand_slug", brandSlug)
      .order("type", { ascending: true }),
    supabase
      .from("brand_knowledge_edges")
      .select("id,source_id,target_id,relation,weight,props")
      .eq("brand_slug", brandSlug),
  ]);

  if (nodesRes.error) throw nodesRes.error;
  if (edgesRes.error) throw edgesRes.error;

  return {
    brandSlug,
    nodes: (nodesRes.data ?? []).map((r) => toNode(r as NodeRow)),
    edges: (edgesRes.data ?? []).map((r) => toEdge(r as EdgeRow)),
  };
}
