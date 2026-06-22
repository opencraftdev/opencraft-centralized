/** Entity categories in the brand knowledge graph. Matches the `type`
 *  column on `brand_knowledge_nodes`. Free-form in the DB, but these are
 *  the seeded kinds the UI knows how to colour/legend. */
export type KnowledgeNodeType =
  | "brand"
  | "positioning"
  | "layanan"
  | "tech"
  | "proses"
  | "prinsip"
  | "audiens"
  | "studi_kasus"
  | "channel"
  | "tone"
  | "topik"
  | "pendekatan"
  | "pasar"
  | string;

export type KnowledgeNode = {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  description: string | null;
  props: Record<string, unknown>;
  color: string | null;
  icon: string | null;
  /** Optional fixed 3D position; null lets the force layout place it. */
  x: number | null;
  y: number | null;
  z: number | null;
};

export type KnowledgeEdge = {
  id: string;
  /** Node id. */
  source: string;
  /** Node id. */
  target: string;
  relation: string;
  weight: number;
  props: Record<string, unknown>;
};

export type BrandGraph = {
  brandSlug: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

/** Display colour + label per node type, used by the legend and as a
 *  fallback when a node has no explicit `color`. */
export const NODE_TYPE_META: Record<
  string,
  { label: string; color: string }
> = {
  brand: { label: "Brand", color: "#6366f1" },
  positioning: { label: "Positioning", color: "#f43f5e" },
  layanan: { label: "Layanan", color: "#0ea5e9" },
  tech: { label: "Teknologi", color: "#38bdf8" },
  proses: { label: "Proses", color: "#f59e0b" },
  prinsip: { label: "Prinsip", color: "#ec4899" },
  audiens: { label: "Audiens", color: "#f97316" },
  studi_kasus: { label: "Studi Kasus", color: "#22c55e" },
  channel: { label: "Channel", color: "#10b981" },
  tone: { label: "Tone & Voice", color: "#a855f7" },
  topik: { label: "Topik Konten", color: "#14b8a6" },
  pendekatan: { label: "Pendekatan", color: "#eab308" },
  pasar: { label: "Pasar", color: "#06b6d4" },
};

export function nodeColor(node: Pick<KnowledgeNode, "type" | "color">): string {
  return node.color ?? NODE_TYPE_META[node.type]?.color ?? "#94a3b8";
}
