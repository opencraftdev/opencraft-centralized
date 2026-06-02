import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsBriefRow } from "./types";

// Recent AI news briefs, newest first. Read with the dashboard (authenticated)
// client — RLS allows SELECT for any signed-in viewer. Mirrors
// getRecentTutorialVideos in the tutorial-video feature.
export async function getRecentNewsBriefs(
  supabase: SupabaseClient,
  limit = 20,
): Promise<NewsBriefRow[]> {
  const { data, error } = await supabase
    .from("news_briefs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NewsBriefRow[];
}
