import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContentPost,
  ContentPostRow,
  GenerationJob,
  GenerationJobRow,
  PostSummary,
  PostStatus,
  PostType,
  WeeklyTemplate,
  WeeklyTemplateRow,
  TemplateType,
} from "./types";

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

function rowToJob(row: GenerationJobRow): GenerationJob {
  return {
    id: row.id,
    postId: row.post_id,
    status: row.status,
    videoId: row.video_id,
    currentStep: row.current_step,
    progressPct: row.progress_pct,
    logText: row.log_text,
    errorMsg: row.error_msg,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPost(
  supabase: SupabaseClient,
  data: { type: PostType; dateSlot: string },
): Promise<ContentPost> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: row, error } = await supabase
    .from("content_posts")
    .insert({ user_id: user.id, type: data.type, date_slot: data.dateSlot })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToPost(row as ContentPostRow);
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

export interface UpdatePostData {
  status?: PostStatus;
  textContent?: string | null;
  imagePath?: string | null;
  videoPath?: string | null;
  headline?: string | null;
  captions?: object | null;
  hashtags?: object | null;
  source?: object | null;
  userFeedback?: string | null;
  publishResults?: object | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
}

export async function updatePost(
  supabase: SupabaseClient,
  id: number,
  data: UpdatePostData,
): Promise<ContentPost | null> {
  const updates: Record<string, unknown> = {};

  if (data.status !== undefined) updates.status = data.status;
  if (data.textContent !== undefined) updates.text_content = data.textContent;
  if (data.imagePath !== undefined) updates.image_path = data.imagePath;
  if (data.videoPath !== undefined) updates.video_path = data.videoPath;
  if (data.headline !== undefined) updates.headline = data.headline;
  if (data.captions !== undefined) updates.captions_json = data.captions ? JSON.stringify(data.captions) : null;
  if (data.hashtags !== undefined) updates.hashtags_json = data.hashtags ? JSON.stringify(data.hashtags) : null;
  if (data.source !== undefined) updates.source_json = data.source ? JSON.stringify(data.source) : null;
  if (data.userFeedback !== undefined) updates.user_feedback = data.userFeedback;
  if (data.publishResults !== undefined) updates.publish_results_json = data.publishResults ? JSON.stringify(data.publishResults) : null;
  if (data.scheduledAt !== undefined) updates.scheduled_at = data.scheduledAt;
  if (data.publishedAt !== undefined) updates.published_at = data.publishedAt;

  if (Object.keys(updates).length === 0) return getPost(supabase, id);

  const { data: row, error } = await supabase
    .from("content_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return null;
  return rowToPost(row as ContentPostRow);
}

export async function deletePost(
  supabase: SupabaseClient,
  id: number,
): Promise<boolean> {
  const { error } = await supabase
    .from("content_posts")
    .delete()
    .eq("id", id);
  return !error;
}

export async function getWeeklyTemplate(
  supabase: SupabaseClient,
): Promise<WeeklyTemplate[]> {
  const { data: rows, error } = await supabase
    .from("weekly_template")
    .select()
    .order("day_of_week", { ascending: true });

  if (error) throw new Error(error.message);

  const byDay = new Map<number, WeeklyTemplate>();
  for (const r of rows as WeeklyTemplateRow[]) {
    byDay.set(r.day_of_week, { dayOfWeek: r.day_of_week, contentType: r.content_type });
  }
  return [0, 1, 2, 3, 4, 5, 6].map(
    (dow) => byDay.get(dow) ?? { dayOfWeek: dow, contentType: "off" as const },
  );
}

export async function setWeeklyTemplate(
  supabase: SupabaseClient,
  template: WeeklyTemplate[],
): Promise<WeeklyTemplate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const rows = template.map((t) => ({
    user_id: user.id,
    day_of_week: t.dayOfWeek,
    content_type: t.contentType,
  }));

  const { error } = await supabase
    .from("weekly_template")
    .upsert(rows, { onConflict: "user_id,day_of_week" });

  if (error) throw new Error(error.message);
  return getWeeklyTemplate(supabase);
}

export async function createJob(
  supabase: SupabaseClient,
  postId: number,
): Promise<GenerationJob> {
  const { data: row, error } = await supabase
    .from("generation_jobs")
    .insert({ post_id: postId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToJob(row as GenerationJobRow);
}

export async function getJob(
  supabase: SupabaseClient,
  id: number,
): Promise<GenerationJob | null> {
  const { data: row, error } = await supabase
    .from("generation_jobs")
    .select()
    .eq("id", id)
    .single();

  if (error) return null;
  return rowToJob(row as GenerationJobRow);
}

export async function getJobForPost(
  supabase: SupabaseClient,
  postId: number,
): Promise<GenerationJob | null> {
  const { data: row, error } = await supabase
    .from("generation_jobs")
    .select()
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return rowToJob(row as GenerationJobRow);
}

export async function hasRunningJobForPost(
  supabase: SupabaseClient,
  postId: number,
): Promise<boolean> {
  const { data } = await supabase
    .from("generation_jobs")
    .select("id")
    .eq("post_id", postId)
    .in("status", ["pending", "running"])
    .limit(1);

  return (data?.length ?? 0) > 0;
}

export async function appendJobLog(
  supabase: SupabaseClient,
  jobId: number,
  line: string,
  opts?: { step?: string; progressPct?: number; status?: string },
): Promise<void> {
  const { data: current } = await supabase
    .from("generation_jobs")
    .select("log_text")
    .eq("id", jobId)
    .single();

  const newLog = (current?.log_text ?? "") + line + "\n";
  const updates: Record<string, unknown> = { log_text: newLog };

  if (opts?.step !== undefined) updates.current_step = opts.step;
  if (opts?.progressPct !== undefined) updates.progress_pct = opts.progressPct;
  if (opts?.status !== undefined) updates.status = opts.status;

  await supabase
    .from("generation_jobs")
    .update(updates)
    .eq("id", jobId);
}
