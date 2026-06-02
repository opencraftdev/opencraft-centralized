import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContentPost,
  ContentPostRow,
  PostSummary,
  PostStatus,
} from "./types";

// Read-only data access for bot-created content.
// This app only displays metrics and content the automation agent produced;
// all create/update/delete/publish paths have been removed.

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

function rowToSummary(row: ContentPostRow): PostSummary {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    dateSlot: row.date_slot,
    scheduledAt: row.scheduled_at,
    headline: row.headline,
    textContent: row.text_content,
  };
}

export async function getPost(
  supabase: SupabaseClient,
  id: number,
): Promise<ContentPost | null> {
  const { data: row, error } = await supabase
    .from("content_posts")
    .select()
    .eq("id", id)
    .single();

  if (error) return null;
  return rowToPost(row as ContentPostRow);
}

export async function listPosts(
  supabase: SupabaseClient,
  opts?: { status?: PostStatus; dateSlot?: string; limit?: number; offset?: number },
): Promise<ContentPost[]> {
  let query = supabase.from("content_posts").select();

  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.dateSlot) query = query.eq("date_slot", opts.dateSlot);

  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;

  const { data: rows, error } = await query
    .order("date_slot", { ascending: true })
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return (rows as ContentPostRow[]).map(rowToPost);
}

export async function getPostsByMonth(
  supabase: SupabaseClient,
  year: number,
  month: number,
): Promise<Record<string, PostSummary[]>> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const { data: rows, error } = await supabase
    .from("content_posts")
    .select()
    .like("date_slot", `${prefix}%`)
    .order("date_slot", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const result: Record<string, PostSummary[]> = {};
  for (const row of rows as ContentPostRow[]) {
    const key = row.date_slot;
    if (!result[key]) result[key] = [];
    result[key].push(rowToSummary(row));
  }
  return result;
}
