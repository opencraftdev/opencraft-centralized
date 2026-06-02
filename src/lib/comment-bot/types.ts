// ── DB row shapes (mirror migration columns exactly) ─────────

export type ReplyStatus =
  | "scraped"
  | "ready_for_review"
  | "approved"
  | "posted"
  | "failed"
  | "skipped";

export type Platform = "threads" | "x";

export type ReplyMode =
  | "agree_and_extend"
  | "polite_contrarian"
  | "concrete_example"
  | "ask_sharpening_question"
  | "translate_to_outcome";

export type BotCommandType = "scrape" | "post_approved" | "draft";
export type BotCommandStatus = "pending" | "running" | "done" | "failed";

export interface ReplyRow {
  id: number;
  platform: Platform;
  account_username: string;
  parent_post_id: string;
  parent_post_url: string | null;
  parent_post_text: string | null;
  parent_author: string | null;
  parent_likes: number | null;
  parent_replies: number | null;
  parent_created_at: string | null;
  reply_mode: ReplyMode | null;
  draft_text: string | null;
  final_text: string | null;
  reply_platform_id: string | null;
  reply_url: string | null;
  status: ReplyStatus;
  error: string | null;
  note: string | null;
  scraped_at: string;
  drafted_at: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandProfileRow {
  id: number;
  slug: string;
  data: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
}

export interface BotCommandRow {
  id: number;
  command: BotCommandType;
  platform: Platform | "all" | null;
  status: BotCommandStatus;
  context: Record<string, unknown> | null;
  requested_by: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

// ── View models (UI-facing) ───────────────────────────────────

export interface QueueStats {
  scraped: number;
  ready_for_review: number;
  approved: number;
  posted_today_threads: number;
  posted_today_x: number;
  cap_per_day: number;
}
