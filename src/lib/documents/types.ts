// Telemetry / monitoring domain types for the read side of the dashboard.
// These mirror the tables in supabase/migrations/002_telemetry_schema.sql.

export type AgentKind = "social-media" | "document" | "comment-bot" | "blogpost";
export type DocumentStatus = "generated" | "failed" | "pending";

// ── Row shapes (snake_case, as returned by Supabase) ────────

export interface AgentRow {
  id: number;
  slug: string;
  name: string;
  kind: AgentKind;
  repo_url: string | null;
  heartbeat_interval_s: number;
  degraded_below: number;
  last_heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentDocumentRow {
  id: number;
  agent_id: number;
  run_id: number | null;
  external_id: string | null;
  title: string;
  doc_type: string | null;
  tool: string | null;
  status: DocumentStatus;
  word_count: number | null;
  size_bytes: number | null;
  duration_ms: number | null;
  s3_bucket: string | null;
  s3_key: string | null;
  s3_region: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_url: string | null;
  error_msg: string | null;
  metadata: Record<string, unknown> | null;
  generated_at: string;
  created_at: string;
}
