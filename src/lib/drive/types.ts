// Row shapes for the Drive tables (supabase/migrations/020_drive.sql, docs/DRIVE.md).

export type DriveFileStatus = "queued" | "generating" | "needs_input" | "ready" | "failed";
export type DriveFileSource = "generated" | "upload" | "agent";
export type DriveDocType = "sph" | "mou" | "deck" | "other";

export interface DriveMessage {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  parent_id: string | null;
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
  storage_path: string | null;
  legacy_document_id: number | null;
  source: DriveFileSource;
  status: DriveFileStatus;
  doc_type: DriveDocType | null;
  prompt: string | null;
  messages: DriveMessage[];
  agent_message: string | null;
  doc_number: string | null;
  error_msg: string | null;
  starred: boolean;
  trashed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const DRIVE_BUCKET = "drive";
