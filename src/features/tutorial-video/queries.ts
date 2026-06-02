import type { SupabaseClient } from "@supabase/supabase-js";
import type { TutorialVideoRow } from "./types";

// Recent tutorial renders, newest first. Read with the dashboard (authenticated)
// client — RLS allows SELECT for any signed-in viewer.
export async function getRecentTutorialVideos(
  supabase: SupabaseClient,
  limit = 20,
): Promise<TutorialVideoRow[]> {
  const { data, error } = await supabase
    .from("tutorial_videos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TutorialVideoRow[];
}
