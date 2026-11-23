// Drive data access from the browser. Reads + DB-only writes use the user's Supabase session (RLS:
// allow-listed users only, is_allowed_user()); anything that touches Google Drive goes through /api/drive/*.
import { createClient } from "@/lib/supabase/client";
import {
  type DriveDocType,
  type DriveFile,
  type DriveFolder,
  type DriveSyncState,
} from "@/lib/drive/types";

const sb = () => createClient();

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function fetchDrive(): Promise<{ folders: DriveFolder[]; files: DriveFile[] }> {
  const client = sb();
  const [folders, files] = await Promise.all([
    client.from("drive_folders").select("*"),
    client.from("drive_files").select("*"),
  ]);
  return { folders: check(folders) as DriveFolder[], files: check(files) as DriveFile[] };
}

export type ItemKind = "folder" | "file";
const table = (kind: ItemKind) => (kind === "folder" ? "drive_folders" : "drive_files");

// DB-only fields (starred, generation-job state). Name/location/trash go through `driveItems` so the
// change is mirrored to Google Drive.
export async function updateItem(kind: ItemKind, id: string, patch: Record<string, unknown>) {
  check(await sb().from(table(kind)).update(patch).eq("id", id));
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal (${res.status})`);
  return j as T;
}

// Mutations mirrored to Google Drive by /api/drive/items.
const driveItems = <T = unknown>(body: Record<string, unknown>) => postJson<T>("/api/drive/items", body);

export async function createFolder(name: string, parentId: string | null) {
  return (await driveItems<{ id: string }>({ op: "createFolder", name, parentId })).id;
}
export const renameItem = (kind: ItemKind, id: string, name: string) => driveItems({ op: "rename", kind, id, name });
export const moveItem = (kind: ItemKind, id: string, folderId: string | null) =>
  driveItems({ op: "move", kind, id, folderId });
export const trashItem = (kind: ItemKind, id: string) => driveItems({ op: "trash", kind, id });
export const restoreItem = (kind: ItemKind, id: string) => driveItems({ op: "restore", kind, id });
// Permanent delete; a folder takes its whole subtree (DB + Google).
export const deleteForever = (kind: ItemKind, id: string) => driveItems({ op: "delete", kind, id });

// Upload straight to Google Drive: server opens a resumable session in the folder's Google folder,
// the browser PUTs the bytes there, then the row is stored with the Google file id.
export async function uploadFile(file: File, folderId: string | null, userId: string) {
  const mime = file.type || "application/octet-stream";
  const { uploadUrl } = await postJson<{ uploadUrl: string }>("/api/drive/upload", {
    name: file.name,
    mimeType: mime,
    size: file.size,
    folderId,
  });
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": mime }, body: file });
  const g = (await put.json().catch(() => ({}))) as { id?: string; size?: string; modifiedTime?: string };
  if (!put.ok || !g.id) throw new Error(`Upload ke Google Drive gagal (${put.status})`);
  const row = {
    folder_id: folderId,
    name: file.name,
    mime_type: mime,
    size_bytes: g.size != null ? Number(g.size) : file.size,
    google_file_id: g.id,
    google_modified_at: g.modifiedTime ?? null,
    source: "upload",
    status: "ready",
    created_by: userId,
  };
  let res = await sb().from("drive_files").insert(row);
  // The worker's Google→dashboard sync may have picked the new file up first (as source='google'): take that row over.
  if (res.error?.code === "23505") res = await sb().from("drive_files").update(row).eq("google_file_id", g.id);
  if (res.error) {
    await driveItems({ op: "discardUpload", googleFileId: g.id }).catch(() => {});
    throw new Error(res.error.message);
  }
}

export const DOC_TYPE_LABEL: Record<DriveDocType, string> = {
  sph: "SPH",
  mou: "MoU",
  deck: "Deck",
  other: "Dokumen",
};

// Re-queue a failed generate job (older rows from before Chat; new documents are made in /chat).
export async function retryJob(file: DriveFile) {
  await updateItem("file", file.id, { status: "queued", error_msg: null, cancel_requested_at: null });
}

// ── Google Drive sync status (docs/DRIVE.md → "Sync status in the UI") ──
export async function fetchSyncState(): Promise<DriveSyncState | null> {
  return check(
    await sb()
      .from("drive_sync_state")
      .select("root_folder_id,last_sync_at,last_sync_summary,last_error,sync_requested_at")
      .eq("id", 1)
      .maybeSingle(),
  ) as DriveSyncState | null;
}

// The only column the UI may write; the worker syncs within ~5 s when it is newer than last_sync_at.
// Stamped with the DB clock (request_drive_sync RPC), so a skewed browser clock can't make the worker skip it.
export async function requestSync(): Promise<string> {
  return check(await sb().rpc("request_drive_sync")) as string;
}
