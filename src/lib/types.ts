export type PostType = "engage" | "educate" | "video";
export type PostStatus = "draft" | "accepted" | "scheduled" | "publishing" | "published" | "failed";
export type TemplateType = PostType | "off";

export interface PostCaptions {
  threads: string;
  x: string;
  instagram: string;
  tiktok: string;
}

export interface PostHashtags {
  threads: string[];
  x: string[];
  instagram: string[];
  tiktok: string[];
}

export interface PostSource {
  videoUrl: string;
  channelTitle: string;
  videoId?: string;
  videoTitle?: string;
}

export interface PublishResult {
  platform: string;
  uri: string;
  status: "ok" | "failed" | "skipped";
  error?: string;
}

export interface ContentPost {
  id: number;
  userId: string;
  type: PostType;
  status: PostStatus;
  dateSlot: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  textContent: string | null;
  imagePath: string | null;
  videoPath: string | null;
  headline: string | null;
  captions: PostCaptions | null;
  hashtags: PostHashtags | null;
  source: PostSource | null;
  userFeedback: string | null;
  publishResults: PublishResult[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostSummary {
  id: number;
  type: PostType;
  status: PostStatus;
  dateSlot: string;
  scheduledAt: string | null;
  headline: string | null;
  textContent: string | null;
}

export interface GenerationJob {
  id: number;
  postId: number;
  status: "pending" | "running" | "completed" | "failed";
  videoId: string | null;
  currentStep: string | null;
  progressPct: number;
  logText: string | null;
  errorMsg: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyTemplate {
  dayOfWeek: number;
  contentType: TemplateType;
}

export interface JobProgressEvent {
  logLine?: string;
  step?: string;
  progressPct?: number;
  done?: boolean;
  error?: string;
}

export interface ContentPostRow {
  id: number;
  user_id: string;
  type: PostType;
  status: PostStatus;
  date_slot: string;
  scheduled_at: string | null;
  published_at: string | null;
  text_content: string | null;
  image_path: string | null;
  video_path: string | null;
  headline: string | null;
  captions_json: string | null;
  hashtags_json: string | null;
  source_json: string | null;
  user_feedback: string | null;
  publish_results_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationJobRow {
  id: number;
  post_id: number;
  status: "pending" | "running" | "completed" | "failed";
  video_id: string | null;
  current_step: string | null;
  progress_pct: number;
  log_text: string | null;
  error_msg: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyTemplateRow {
  day_of_week: number;
  user_id: string;
  content_type: TemplateType;
  updated_at: string;
}
