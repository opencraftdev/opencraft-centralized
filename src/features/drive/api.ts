// Drive mutations, run in the browser with the user's Supabase session (RLS: authenticated = full access).
import { createClient } from "@/lib/supabase/client";
import {
  DRIVE_BUCKET,
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

// Storage keys reject some characters; keep the display name untouched in `name`.
function safeKey(name: string): string {
  return name.normalize("NFKD").replace(/[^\w.\-() ]+/g, "_").trim() || "file";
}

export async function uploadFile(file: File, folderId: string | null, userId: string) {
  const client = sb();
  const id = crypto.randomUUID();
  const path = `${id}/${safeKey(file.name)}`;
  const mime = file.type || "application/octet-stream";
  check(await client.storage.from(DRIVE_BUCKET).upload(path, file, { contentType: mime }));
  const res = await client.from("drive_files").insert({
    id,
    folder_id: folderId,
    name: file.name,
    mime_type: mime,
    size_bytes: file.size,
    storage_path: path,
    source: "upload",
    status: "ready",
    created_by: userId,
  });
  if (res.error) {
    await client.storage.from(DRIVE_BUCKET).remove([path]);
    throw new Error(res.error.message);
  }
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

// Permanently delete files (and their storage objects; legacy S3 docs keep their agent_documents row).
export async function deleteFilesForever(files: DriveFile[]) {
  if (!files.length) return;
  const client = sb();
  const paths = files.map((f) => f.storage_path).filter((p): p is string => !!p);
  if (paths.length) check(await client.storage.from(DRIVE_BUCKET).remove(paths));
  check(await client.from("drive_files").delete().in("id", files.map((f) => f.id)));
}

// Folder + everything below it (`files` = all files in its subtree). Files go first because the FK
// would otherwise move them to root; sub-folders are removed by ON DELETE CASCADE.
export async function deleteFolderForever(folderId: string, files: DriveFile[]) {
  await deleteFilesForever(files);
  check(await sb().from("drive_folders").delete().eq("id", folderId));
}
