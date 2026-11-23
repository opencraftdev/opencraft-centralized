// Row shapes for the Drive tables (supabase/migrations/020_drive.sql, 021_drive_google.sql, 022_*, docs/DRIVE.md).

export type DriveFileStatus = "queued" | "generating" | "needs_input" | "ready" | "failed";
export type DriveFileSource = "generated" | "upload" | "agent" | "google"; // google = created directly in Google Drive (sync)
export type DriveDocType = "sph" | "mou" | "deck" | "other";

// One step of an agent run: the short Indonesian progress line and when it started (migration 024).
export interface DriveStep {
  label: string;
  at: string;
}

export interface DriveMessage {
  role: "user" | "assistant";
  text: string; // Markdown for assistant messages
  at: string;
  steps?: DriveStep[]; // assistant: the run's steps (moved from run_steps when the run ended)
  duration_ms?: number; // assistant: how long the run took
  stopped?: boolean; // assistant: the user stopped the run
}

export interface DriveFolder {
  id: string;
  name: string;
  parent_id: string | null;
  google_folder_id: string | null; // null = not created in Google Drive yet (created lazily)
  google_modified_at: string | null; // Google modifiedTime last seen/written (two-way sync)
  starred: boolean;
  trashed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriveFile {
  id: string;
  folder_id: string | null;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  google_file_id: string | null; // null = no file in Google Drive (job not ready, or legacy row)
  google_modified_at: string | null; // Google modifiedTime last seen/written (two-way sync)
  source: DriveFileSource;
  status: DriveFileStatus;
  doc_type: DriveDocType | null;
  prompt: string | null;
  messages: DriveMessage[];
  agent_message: string | null;
  doc_number: string | null;
  error_msg: string | null;
  progress: string | null; // live step text while the agent works (migration 023)
  run_steps: DriveStep[] | null; // steps of the run in progress (migration 024, worker-written)
  stream_text: string | null; // reply streamed so far, RESULT line cut off (migration 024, worker-written)
  cancel_requested_at: string | null; // set by the UI "Stop" (migration 024)
  started_at: string | null; // worker: when the current/last run was claimed
  finished_at: string | null; // worker: when the last run ended
  starred: boolean;
  trashed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Single row (id=1) written by the worker's sync loop; the UI may only set sync_requested_at (migration 023).
export interface DriveSyncState {
  root_folder_id: string | null;
  last_sync_at: string | null;
  last_sync_summary: string | null;
  last_error: string | null;
  sync_requested_at: string | null;
}
