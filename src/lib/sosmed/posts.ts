import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPost, ContentPostRow, PostType, PostStatus } from "@/lib/types";

export class NotFoundError extends Error {
  constructor(msg = "Not found") { super(msg); this.name = "NotFoundError"; }
}

// mirrors lib/posts.ts rowToPost — kept local because lib/posts does not export it
function rowToPost(row: ContentPostRow): ContentPost {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    dateSlot: row.date_slot,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    textContent: row.text_content,
    imagePath: row.image_path,
    videoPath: row.video_path,
    headline: row.headline,
    captions: row.captions_json ? JSON.parse(row.captions_json) : null,
    hashtags: row.hashtags_json ? JSON.parse(row.hashtags_json) : null,
    source: row.source_json ? JSON.parse(row.source_json) : null,
    userFeedback: row.user_feedback,
    publishResults: row.publish_results_json ? JSON.parse(row.publish_results_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPost(
  admin: SupabaseClient,
  { userId, type, dateSlot }: { userId: string; type: PostType; dateSlot: string },
): Promise<ContentPost> {
  const { data, error } = await admin
    .from("content_posts")
    .insert({ user_id: userId, type, status: "draft", date_slot: dateSlot })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToPost(data as ContentPostRow);
}

export async function patchPost(
  admin: SupabaseClient,
  id: number,
  userId: string,
  patch: { status?: PostStatus; userFeedback?: string | null; scheduledAt?: string | null },
): Promise<ContentPost> {
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.userFeedback !== undefined) update.user_feedback = patch.userFeedback;
  if (patch.scheduledAt !== undefined) update.scheduled_at = patch.scheduledAt;

  if (Object.keys(update).length === 0) throw new Error("Nothing to update");

  const { data, error } = await admin
    .from("content_posts")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") throw new NotFoundError();
    throw new Error(error.message);
  }
  return rowToPost(data as ContentPostRow);
}

export async function deletePost(
  admin: SupabaseClient,
  id: number,
  userId: string,
): Promise<void> {
  const { error } = await admin
    .from("content_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
