import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReplyRow,
  ReplyStatus,
  BrandProfileRow,
  BotCommandRow,
  QueueStats,
} from "./types";

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ── Replies ───────────────────────────────────────────────────

export async function getRepliesByStatus(
  supabase: SupabaseClient,
  status: ReplyStatus,
  limit = 100,
): Promise<ReplyRow[]> {
  const { data, error } = await supabase
    .from("replies")
    .select("*")
    .eq("status", status)
    .order("scraped_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReplyRow[];
}

export async function getRepliesHistory(
  supabase: SupabaseClient,
  statuses: ReplyStatus[],
  limit = 100,
): Promise<ReplyRow[]> {
  const { data, error } = await supabase
    .from("replies")
    .select("*")
    .in("status", statuses)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReplyRow[];
}

export async function getQueueStats(supabase: SupabaseClient): Promise<QueueStats> {
  const today = startOfTodayIso();

  const [scraped, ready, approved, postedThreadsToday, postedXToday] = await Promise.all([
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("status", "scraped"),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready_for_review"),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("status", "posted")
      .eq("platform", "threads")
      .gte("posted_at", today),
    supabase
      .from("replies")
      .select("id", { count: "exact", head: true })
      .eq("status", "posted")
      .eq("platform", "x")
      .gte("posted_at", today),
  ]);

  return {
    scraped: scraped.count ?? 0,
    ready_for_review: ready.count ?? 0,
    approved: approved.count ?? 0,
    posted_today_threads: postedThreadsToday.count ?? 0,
    posted_today_x: postedXToday.count ?? 0,
    cap_per_day: 5,
  };
}

export async function getScrapedPosts(
  supabase: SupabaseClient,
  limit = 20,
): Promise<ReplyRow[]> {
  const { data, error } = await supabase
    .from("replies")
    .select("*")
    .eq("status", "scraped")
    .order("scraped_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ReplyRow[];
}

// ── Brand Profile ─────────────────────────────────────────────

export async function getBrandProfile(supabase: SupabaseClient): Promise<BrandProfileRow | null> {
  const { data, error } = await supabase
    .from("brand_profile")
    .select("*")
    .eq("slug", "opencraft")
    .maybeSingle();
  if (error) throw error;
  return (data as BrandProfileRow | null) ?? null;
}

// ── Bot Commands ──────────────────────────────────────────────

export async function getRecentCommands(
  supabase: SupabaseClient,
  limit = 10,
): Promise<BotCommandRow[]> {
  const { data, error } = await supabase
    .from("bot_commands")
    .select("*")
    .or("platform.in.(threads,x,all),platform.is.null")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BotCommandRow[];
}
