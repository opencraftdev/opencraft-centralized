export type SosmedPlatform = "engage" | "educate" | "video";
export type SosmedCommand = "generate" | "publish" | "suggest" | "draft" | "approve" | "reset";
export type SosmedCommandStatus = "pending" | "processing" | "completed" | "failed";

export interface SosmedCommandRow {
  id: number;
  command: SosmedCommand;
  platform: SosmedPlatform;
  status: SosmedCommandStatus;
  context: Record<string, unknown> | null;
  user_id: string | null;
  error: string | null;
  log_text: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface VideoSuggestItem {
  videoId: string;
  title: string;
  channelTitle: string;
  duration: string;
  thumbnailUrl: string;
}
