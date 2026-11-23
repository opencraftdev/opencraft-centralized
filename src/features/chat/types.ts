// Row shapes for the chat tables (supabase/migrations/025_chat_and_skills.sql, docs/CHAT.md → "Data").

export type ChatStatus = "idle" | "queued" | "running" | "failed";

/** One step of a run: the short Indonesian progress line and when it started. */
export interface ChatStep {
  label: string;
  at: string;
}

/** A file the agent attached: the id of a drive_files row (source='chat'). */
export interface ChatAttachment {
  file_id: string;
  name: string;
  mime_type: string | null;
}

/** What the chat list needs (cheap select). */
export interface ChatListItem {
  id: string;
  title: string;
  status: ChatStatus;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

/** The open chat, incl. the live columns the worker writes while a run goes. */
export interface Chat extends ChatListItem {
  consumed_at: string | null;
  run_steps: ChatStep[] | null;
  stream_text: string | null;
  started_at: string | null;
  cancel_requested_at: string | null;
  error_msg: string | null;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  steps: ChatStep[] | null;
  duration_ms: number | null;
  stopped: boolean;
  error: string | null;
  attachments: ChatAttachment[] | null;
  created_at: string;
}

export const isRunning = (c: { status: ChatStatus }) => c.status === "queued" || c.status === "running";

/** Columns the chat list selects. */
export const LIST_COLUMNS = "id,title,status,pinned,created_at,updated_at";
