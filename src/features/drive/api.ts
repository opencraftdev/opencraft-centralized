// Drive mutations, run in the browser with the user's Supabase session (RLS: authenticated = full access).
import { createClient } from "@/lib/supabase/client";
import {
  type DriveDocType,
  type DriveFile,
  type DriveFolder,
  type DriveMessage,
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

export async function updateItem(kind: ItemKind, id: string, patch: Record<string, unknown>) {
  check(await sb().from(table(kind)).update(patch).eq("id", id));
}

export async function createFolder(name: string, parentId: string | null, userId: string) {
  check(await sb().from("drive_folders").insert({ name, parent_id: parentId, created_by: userId }));
}

export async function moveItem(kind: ItemKind, id: string, folderId: string | null) {
  await updateItem(kind, id, kind === "folder" ? { parent_id: folderId } : { folder_id: folderId });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Request gagal (${res.status})`);
  return j as T;
}

// Files live in AWS S3: get a presigned PUT from the server, upload straight to S3, then insert the row.
export async function uploadFile(file: File, folderId: string | null, userId: string) {
  const { id, key, uploadUrl } = await postJson<{ id: string; key: string; uploadUrl: string }>(
    "/api/drive/upload",
    { name: file.name },
  );
  const mime = file.type || "application/octet-stream";
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
  if (!put.ok) throw new Error(`Upload ke S3 gagal (${put.status})`);
  check(
    await sb().from("drive_files").insert({
      id,
      folder_id: folderId,
      name: file.name,
      mime_type: mime,
      size_bytes: file.size,
      storage_path: key,
      source: "upload",
      status: "ready",
      created_by: userId,
    }),
  );
}

export const DOC_TYPE_LABEL: Record<DriveDocType, string> = {
  sph: "SPH",
  mou: "MoU",
  deck: "Deck",
  other: "Dokumen",
};

export async function createGenerateJob(args: {
  docType: DriveDocType;
  prompt: string;
  folderId: string | null;
  userId: string;
}): Promise<string> {
  const words = args.prompt.trim().split(/\s+/).slice(0, 8).join(" ");
  const at = new Date().toISOString();
  const row = check(
    await sb()
      .from("drive_files")
      .insert({
        folder_id: args.folderId,
        name: `${DOC_TYPE_LABEL[args.docType]} — ${words}`,
        source: "generated",
        status: "queued",
        doc_type: args.docType,
        prompt: args.prompt.trim(),
        messages: [{ role: "user", text: args.prompt.trim(), at }] satisfies DriveMessage[],
        created_by: args.userId,
      })
      .select("id")
      .single(),
  ) as { id: string };
  return row.id;
}

// needs_input → user answers → back to the queue (worker resumes the same session).
export async function replyToJob(file: DriveFile, text: string) {
  const messages: DriveMessage[] = [
    ...(file.messages ?? []),
    { role: "user", text: text.trim(), at: new Date().toISOString() },
  ];
  await updateItem("file", file.id, { messages, status: "queued", error_msg: null });
}

export async function retryJob(file: DriveFile) {
  await updateItem("file", file.id, { status: "queued", error_msg: null });
}

export async function getFileLinks(id: string): Promise<{ viewUrl: string | null; downloadUrl: string | null }> {
  const res = await fetch(`/api/drive/files/${id}/link`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Gagal memuat link (${res.status})`);
  return j;
}

// Permanently delete files: S3 objects first (server looks up the keys), then the rows.
export async function deleteFilesForever(files: DriveFile[]) {
  if (!files.length) return;
  const ids = files.map((f) => f.id);
  if (files.some((f) => f.storage_path)) await postJson("/api/drive/objects/delete", { ids });
  check(await sb().from("drive_files").delete().in("id", ids));
}

// Folder + everything below it (`files` = all files in its subtree). Files go first because the FK
// would otherwise move them to root; sub-folders are removed by ON DELETE CASCADE.
export async function deleteFolderForever(folderId: string, files: DriveFile[]) {
  await deleteFilesForever(files);
  check(await sb().from("drive_folders").delete().eq("id", folderId));
}
