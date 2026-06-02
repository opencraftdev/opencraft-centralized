// Telemetry / monitoring domain types for the read side of the dashboard.
// These mirror the tables in supabase/migrations/002_telemetry_schema.sql.

export type AgentKind = "social-media" | "document" | "comment-bot" | "blogpost";
export type AgentStatus = "online" | "degraded" | "offline" | "unknown";
export type RunStatus = "running" | "succeeded" | "failed";
export type EventLevel = "info" | "warning" | "error";
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

export interface AgentStatusRow {
  id: number;
  slug: string;
  name: string;
  kind: AgentKind;
  repo_url: string | null;
  heartbeat_interval_s: number;
  degraded_below: number;
  last_heartbeat_at: string | null;
  runs_24h: number;
  succeeded_24h: number;
  failed_24h: number;
  success_rate_24h: number | null;
  status: AgentStatus;
}

export interface AgentRunRow {
  id: number;
  agent_id: number;
  external_id: string | null;
  status: RunStatus;
  items_processed: number;
  duration_ms: number | null;
  error_msg: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

export interface AgentMetricRow {
  id: number;
  agent_id: number;
  run_id: number | null;
  metric_key: string;
  value: number;
  labels: Record<string, unknown> | null;
  recorded_at: string;
}

export interface AgentEventRow {
  id: number;
  agent_id: number;
  run_id: number | null;
  level: EventLevel;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
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

// ── View-model shapes used by the UI ────────────────────────

export interface AgentSummary extends AgentStatusRow {
  totalRuns: number;
  runsToday: number;
}

export interface DocumentHistoryItem extends AgentDocumentRow {
  // Ready-to-use links resolved server-side; null when no storage location.
  viewUrl: string | null; // opens inline (in-browser) — for "View"
  downloadUrl: string | null; // forces a file download — for "Download"
}

export interface DocumentStats {
  total: number;
  generated: number;
  failed: number;
  totalWords: number;
}
