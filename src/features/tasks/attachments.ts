// Attachments for tasks and comments (docs/TASKS.md → "Lampiran"). Files are stored in Google Drive like every other
// file, in the dashboard folder "Task Management", as drive_files rows tagged in `metadata`:
// {task_id} for a file on the task, {task_id, comment_id} for a file on a comment. No extra table needed.
import { createClient } from "@/lib/supabase/client";
import { createFolder, trashItem, uploadFile } from "@/features/drive/api";
import type { DriveFile } from "@/lib/drive/types";

const FOLDER_NAME = "Task Management";
const sb = () => createClient();

let folderPromise: Promise<string> | null = null;

/** The dashboard folder attachments go in (created once if missing). */
function attachmentsFolder(): Promise<string> {
  folderPromise ??= (async () => {
    const { data, error } = await sb()
      .from("drive_folders")
      .select("id")
      .eq("name", FOLDER_NAME)
      .is("parent_id", null)
      .is("trashed_at", null)
      .limit(1);
    if (error) throw new Error(error.message);
    if (data?.[0]) return data[0].id as string;
    return createFolder(FOLDER_NAME, null);
  })().catch((e) => {
    folderPromise = null;
    throw e;
  });
  return folderPromise;
}

/** All live attachments of a task (its own and its comments'). */
export async function listAttachments(taskId: string): Promise<DriveFile[]> {
  const { data, error } = await sb()
    .from("drive_files")
    .select("*")
    .eq("metadata->>task_id", taskId)
    .is("trashed_at", null)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as DriveFile[];
}

export const commentIdOf = (f: DriveFile): string | null => {
  const v = (f.metadata as Record<string, unknown> | null)?.comment_id;
  return typeof v === "string" ? v : null;
};

/** Uploads files one by one (straight to Google Drive). Calls onProgress(done, total). */
export interface UploadProgress {
  done: number; // files finished
  total: number; // files in this batch
  pct: number; // 0–100 over all bytes of the batch
  name: string; // file being sent now
}

export async function uploadAttachments(
  files: File[],
  target: { taskId: string; commentId?: string },
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  const folderId = await attachmentsFolder();
  const { data } = await sb().auth.getUser();
  const userId = data.user?.id ?? "";
  const totalBytes = files.reduce((n, f) => n + f.size, 0) || 1;
  let sent = 0;
  let done = 0;
  for (const f of files) {
    const report = (loaded: number) =>
      onProgress?.({ done, total: files.length, pct: Math.min(99, Math.round(((sent + loaded) / totalBytes) * 100)), name: f.name });
    report(0);
    await uploadFile(f, folderId, userId, { task_id: target.taskId, ...(target.commentId ? { comment_id: target.commentId } : {}) }, report);
    sent += f.size;
    done++;
    onProgress?.({ done, total: files.length, pct: done === files.length ? 100 : Math.round((sent / totalBytes) * 100), name: f.name });
  }
}

/** Moves an attachment to the Drive trash (restorable from Document → Sampah). */
export const removeAttachment = (fileId: string) => trashItem("file", fileId);

export const MAX_ATTACHMENT_MB = 500;

/** Uploads one image (project logo, profile photo) to the same folder; returns its drive_files id. */
export async function uploadImage(file: File, metadata: Record<string, unknown>): Promise<string> {
  const folderId = await attachmentsFolder();
  const { data } = await sb().auth.getUser();
  return uploadFile(file, folderId, data.user?.id ?? "", metadata);
}

/** Pixel size of an image file (SVG without size → null). */
export function imageSize(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : null);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
