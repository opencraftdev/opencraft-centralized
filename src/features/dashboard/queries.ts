import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPostRow, PostStatus, PostType } from "@/lib/types";

export interface DashboardStats {
  total: number;
  published: number;
  scheduled: number;
  failed: number;
}

export interface TypeCount {
  type: PostType;
  count: number;
}

export interface DayCount {
  dateSlot: string;
  count: number;
}

export interface RecentPost {
  id: number;
  type: PostType;
  status: PostStatus;
  dateSlot: string;
  headline: string | null;
  createdAt: string;
}

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const { data: rows, error } = await supabase
    .from("content_posts")
    .select("status");

  if (error) throw new Error(error.message);

  const all = rows as { status: PostStatus }[];
  return {
    total: all.length,
    published: all.filter((r) => r.status === "published").length,
    scheduled: all.filter((r) => r.status === "scheduled").length,
    failed: all.filter((r) => r.status === "failed").length,
  };
}

export async function getTypeBreakdown(supabase: SupabaseClient): Promise<TypeCount[]> {
  const { data: rows, error } = await supabase
    .from("content_posts")
    .select("type");

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = { engage: 0, educate: 0, video: 0 };
  for (const row of rows as { type: PostType }[]) {
    counts[row.type] = (counts[row.type] ?? 0) + 1;
  }

  return Object.entries(counts).map(([type, count]) => ({
    type: type as PostType,
    count,
  }));
}

export async function getMonthHeatmap(
  supabase: SupabaseClient,
  year: number,
  month: number,
): Promise<DayCount[]> {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const { data: rows, error } = await supabase
    .from("content_posts")
    .select("date_slot")
    .like("date_slot", `${prefix}%`);

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  for (const row of rows as { date_slot: string }[]) {
    counts[row.date_slot] = (counts[row.date_slot] ?? 0) + 1;
  }

  return Object.entries(counts).map(([dateSlot, count]) => ({ dateSlot, count }));
}

export async function getRecentPosts(supabase: SupabaseClient): Promise<RecentPost[]> {
  const { data: rows, error } = await supabase
    .from("content_posts")
    .select("id, type, status, date_slot, headline, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  return (rows as ContentPostRow[]).map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    dateSlot: r.date_slot,
    headline: r.headline,
    createdAt: r.created_at,
  }));
}
