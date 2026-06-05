import type { SupabaseClient } from "@supabase/supabase-js";
import type { SosmedCommandRow, VideoSuggestItem } from "./types";

export async function getCommand(
  supabase: SupabaseClient,
  id: number,
  userId: string,
): Promise<SosmedCommandRow | null> {
  const { data, error } = await supabase
    .from("bot_commands")
    .select("id,command,platform,status,context,user_id,error,log_text,created_at,started_at,finished_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as SosmedCommandRow | null) ?? null;
}

export async function getVideoAgentState(
  supabase: SupabaseClient,
  userId: string,
): Promise<VideoSuggestItem[] | null> {
  const { data, error } = await supabase
    .from("video_agent_state")
    .select("suggest_list_json")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { suggest_list_json: VideoSuggestItem[] | null } | null)?.suggest_list_json ?? null;
}
