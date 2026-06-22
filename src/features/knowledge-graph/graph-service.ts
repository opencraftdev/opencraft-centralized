import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Brand knowledge graph operations, shared by the HTTP MCP route.
 *
 * Reads take a SupabaseClient that honours RLS (built from the caller's token);
 * writes take a service-role client. Splitting the two keeps "who can read"
 * enforced by the database while writes go through a controlled, authed path.
 */

export const NODE_COLS =
  "id,brand_slug,type,label,description,props,color,icon,x,y,z,created_at,updated_at";
export const EDGE_COLS =
  "id,brand_slug,source_id,target_id,relation,weight,props,created_at";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a node reference (uuid OR exact label) to a node id within a brand. */
export async function resolveNodeId(
  client: SupabaseClient,
  brand: string,
  ref: string,
): Promise<string | null> {
  if (UUID_RE.test(ref)) {
    const { data } = await client
      .from("brand_knowledge_nodes")
      .select("id")
      .eq("id", ref)
      .maybeSingle();
    return data?.id ?? null;
  }
  const { data } = await client
    .from("brand_knowledge_nodes")
    .select("id")
    .eq("brand_slug", brand)
    .eq("label", ref)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getGraph(read: SupabaseClient, brand: string) {
  const [nodesRes, edgesRes] = await Promise.all([
    read.from("brand_knowledge_nodes").select(NODE_COLS).eq("brand_slug", brand),
    read.from("brand_knowledge_edges").select(EDGE_COLS).eq("brand_slug", brand),
  ]);
  if (nodesRes.error) throw nodesRes.error;
  if (edgesRes.error) throw edgesRes.error;
  const byType: Record<string, number> = {};
  for (const n of nodesRes.data ?? []) byType[n.type] = (byType[n.type] ?? 0) + 1;
  return {
    brand_slug: brand,
    counts: {
      nodes: nodesRes.data?.length ?? 0,
      edges: edgesRes.data?.length ?? 0,
      by_type: byType,
    },
    nodes: nodesRes.data,
    edges: edgesRes.data,
  };
}

export async function searchNodes(
  read: SupabaseClient,
  brand: string,
  query: string,
  type?: string,
  limit = 20,
) {
  let q = read
    .from("brand_knowledge_nodes")
    .select(NODE_COLS)
    .eq("brand_slug", brand)
    .or(`label.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(limit);
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) throw error;
  return { brand_slug: brand, query, matches: data };
}

export async function getNode(read: SupabaseClient, brand: string, ref: string) {
  const id = await resolveNodeId(read, brand, ref);
  if (!id) return null;
  const [nodeRes, outRes, inRes] = await Promise.all([
    read.from("brand_knowledge_nodes").select(NODE_COLS).eq("id", id).single(),
    read
      .from("brand_knowledge_edges")
      .select(`${EDGE_COLS}, target:target_id(id,label,type)`)
      .eq("source_id", id),
    read
      .from("brand_knowledge_edges")
      .select(`${EDGE_COLS}, source:source_id(id,label,type)`)
      .eq("target_id", id),
  ]);
  if (nodeRes.error) throw nodeRes.error;
  return { node: nodeRes.data, outgoing: outRes.data ?? [], incoming: inRes.data ?? [] };
}

export async function listTypes(read: SupabaseClient, brand: string) {
  const { data, error } = await read
    .from("brand_knowledge_nodes")
    .select("type")
    .eq("brand_slug", brand);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.type] = (counts[r.type] ?? 0) + 1;
  return { brand_slug: brand, types: counts };
}

export type UpsertNodeInput = {
  id?: string;
  type: string;
  label: string;
  description?: string;
  props?: Record<string, unknown>;
  color?: string;
  icon?: string;
};

export async function upsertNode(
  write: SupabaseClient,
  brand: string,
  input: UpsertNodeInput,
) {
  const row: Record<string, unknown> = {
    brand_slug: brand,
    type: input.type,
    label: input.label,
  };
  if (input.description !== undefined) row.description = input.description;
  if (input.props !== undefined) row.props = input.props;
  if (input.color !== undefined) row.color = input.color;
  if (input.icon !== undefined) row.icon = input.icon;
  if (input.id) row.id = input.id;

  const { data, error } = await write
    .from("brand_knowledge_nodes")
    .upsert(row, { onConflict: "id" })
    .select(NODE_COLS)
    .single();
  if (error) throw error;
  return { saved: data };
}

export async function addEdge(
  write: SupabaseClient,
  brand: string,
  source: string,
  target: string,
  relation: string,
  weight = 1,
  props: Record<string, unknown> = {},
) {
  const [sourceId, targetId] = await Promise.all([
    resolveNodeId(write, brand, source),
    resolveNodeId(write, brand, target),
  ]);
  if (!sourceId) throw new Error(`Source node not found: "${source}".`);
  if (!targetId) throw new Error(`Target node not found: "${target}".`);
  if (sourceId === targetId) throw new Error("Self-loops are not allowed.");

  const { data, error } = await write
    .from("brand_knowledge_edges")
    .insert({
      brand_slug: brand,
      source_id: sourceId,
      target_id: targetId,
      relation,
      weight,
      props,
    })
    .select(EDGE_COLS)
    .single();
  if (error) throw error;
  return { added: data };
}

export async function deleteNode(write: SupabaseClient, id: string) {
  const { error } = await write.from("brand_knowledge_nodes").delete().eq("id", id);
  if (error) throw error;
  return { deleted: id };
}
