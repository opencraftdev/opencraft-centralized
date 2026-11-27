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
export async function uploadAttachments(
  files: File[],
  target: { taskId: string; commentId?: string },
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const folderId = await attachmentsFolder();
  const { data } = await sb().auth.getUser();
  const userId = data.user?.id ?? "";
  let done = 0;
  onProgress?.(0, files.length);
  for (const f of files) {
    await uploadFile(f, folderId, userId, { task_id: target.taskId, ...(target.commentId ? { comment_id: target.commentId } : {}) });
    onProgress?.(++done, files.length);
  }
}

/** Moves an attachment to the Drive trash (restorable from Document → Sampah). */
export const removeAttachment = (fileId: string) => trashItem("file", fileId);

export const MAX_ATTACHMENT_MB = 500;
