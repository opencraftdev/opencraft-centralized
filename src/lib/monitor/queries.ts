import type { SupabaseClient } from "@supabase/supabase-js";
import { presignS3GetUrl } from "@/lib/s3";
import type {
  AgentStatusRow,
  AgentRunRow,
  AgentEventRow,
  AgentMetricRow,
  AgentDocumentRow,
  AgentSummary,
  DocumentHistoryItem,
  DocumentStats,
  BlogArticleItem,
} from "@/lib/monitor/types";

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ── Fleet overview ──────────────────────────────────────────

export async function getFleet(supabase: SupabaseClient): Promise<AgentSummary[]> {
  const { data: statuses, error } = await supabase
    .from("agent_status")
    .select("*")
    .order("name");
  if (error) throw error;

  const rows = (statuses ?? []) as AgentStatusRow[];
  const today = startOfTodayIso();

  // Counts per agent (runs today + total). A handful of agents → cheap.
  const summaries = await Promise.all(
    rows.map(async (a) => {
      const [todayRes, totalRes] = await Promise.all([
        supabase
          .from("agent_runs")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", a.id)
          .gte("started_at", today),
        supabase
          .from("agent_runs")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", a.id),
      ]);
      return {
        ...a,
        runsToday: todayRes.count ?? 0,
        totalRuns: totalRes.count ?? 0,
      } satisfies AgentSummary;
    }),
  );

  return summaries;
}

// ── Per-agent detail ────────────────────────────────────────

export async function getAgentBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<AgentStatusRow | null> {
  const { data, error } = await supabase
    .from("agent_status")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as AgentStatusRow | null) ?? null;
}

export async function getRecentRuns(
  supabase: SupabaseClient,
  agentId: number,
  limit = 20,
): Promise<AgentRunRow[]> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("agent_id", agentId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentRunRow[];
}

export async function getRecentEvents(
  supabase: SupabaseClient,
  agentId: number,
  limit = 20,
): Promise<AgentEventRow[]> {
  const { data, error } = await supabase
    .from("agent_events")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentEventRow[];
}

export interface DailyThroughputRow {
  agent_id: number;
  day: string;
  runs: number;
  succeeded: number;
  failed: number;
  items_processed: number | null;
  avg_duration_ms: number | null;
}

export async function getDailyThroughput(
  supabase: SupabaseClient,
  agentId: number,
): Promise<DailyThroughputRow[]> {
  const { data, error } = await supabase
    .from("agent_daily_throughput")
    .select("*")
    .eq("agent_id", agentId)
    .order("day");
  if (error) throw error;
  return (data ?? []) as DailyThroughputRow[];
}

// Sums each specific metric_key over the last `days` days → { key: total }.
export async function getMetricTotals(
  supabase: SupabaseClient,
  agentId: number,
  days = 30,
): Promise<Record<string, number>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("agent_metrics")
    .select("metric_key,value,recorded_at")
    .eq("agent_id", agentId)
    .gte("recorded_at", since)
    .limit(5000);
  if (error) throw error;

  const totals: Record<string, number> = {};
  for (const row of (data ?? []) as Pick<AgentMetricRow, "metric_key" | "value">[]) {
    totals[row.metric_key] = (totals[row.metric_key] ?? 0) + Number(row.value);
  }
  return totals;
}

// ── Document history (Document Agent) ───────────────────────

const LINK_TTL = 3600; // 1 hour — long enough for an open dashboard tab

function basename(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

// Resolves view (inline) + download (forced) links for a document, preferring a
// presigned S3 GET, then a stored file_url, then a Supabase Storage signed URL.
async function resolveLinks(
  supabase: SupabaseClient,
  doc: AgentDocumentRow,
): Promise<{ viewUrl: string | null; downloadUrl: string | null }> {
  if (doc.s3_bucket && doc.s3_key) {
    const region = doc.s3_region ?? undefined;
    const filename = basename(doc.s3_key);
    const viewUrl = presignS3GetUrl({ bucket: doc.s3_bucket, key: doc.s3_key, region, expiresIn: LINK_TTL });
    const downloadUrl = presignS3GetUrl({
      bucket: doc.s3_bucket,
      key: doc.s3_key,
      region,
      expiresIn: LINK_TTL,
      downloadFilename: filename,
    });
    if (viewUrl) return { viewUrl, downloadUrl: downloadUrl ?? viewUrl };
  }
  if (doc.file_url) return { viewUrl: doc.file_url, downloadUrl: doc.file_url };
  if (doc.storage_bucket && doc.storage_path) {
    const store = supabase.storage.from(doc.storage_bucket);
    const [view, dl] = await Promise.all([
      store.createSignedUrl(doc.storage_path, LINK_TTL),
      store.createSignedUrl(doc.storage_path, LINK_TTL, { download: true }),
    ]);
    if (view.data?.signedUrl) {
      return {
        viewUrl: view.data.signedUrl,
        downloadUrl: dl.data?.signedUrl ?? view.data.signedUrl,
      };
    }
  }
  return { viewUrl: null, downloadUrl: null };
}

export async function getDocuments(
  supabase: SupabaseClient,
  agentId: number,
  limit = 50,
): Promise<DocumentHistoryItem[]> {
  const { data, error } = await supabase
    .from("agent_documents")
    .select("*")
    .eq("agent_id", agentId)
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const docs = (data ?? []) as AgentDocumentRow[];
  return Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      ...(await resolveLinks(supabase, doc)),
    })),
  );
}

// ── Blog drafts (Blogpost Automation, agent-authored) ───────
//
// The History view lists the blogs the agent drafted FOR us — the OpenCraft
// originals in public.articles — not the scraped external articles the bot
// merely monitors. Read straight from `articles` so it's always complete and
// fresh (the agent_documents telemetry mirror lags behind the source table).

// Public site where the blog is served: /{locale}/blog/{slug}. Mirrors the URL
// the sync bot builds (see lib/monitor/blog-bot.ts).
const BLOG_BASE_URL = (process.env.BLOG_PUBLIC_BASE_URL ?? "https://ocraft.id").replace(/\/+$/, "");
const BLOG_LOCALE = process.env.BLOG_PUBLIC_LOCALE ?? "id";

// The source_name the agent stamps on its own drafts, vs. scraped sources
// (LangChain, Anthropic, …).
const OWN_SOURCE = "OpenCraft";

function blogWordCount(content: string | null): number | null {
  if (!content) return null;
  const words = content.trim().split(/\s+/).filter(Boolean);
  return words.length || null;
}

export async function getBlogDrafts(
  supabase: SupabaseClient,
  limit = 200,
): Promise<BlogArticleItem[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("slug,title,summary,content,source_name,published_at,created_at")
    .eq("source_name", OWN_SOURCE)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  type ArticleRow = {
    slug: string | null;
    title: string | null;
    summary: string | null;
    content: string | null;
    source_name: string | null;
    published_at: string | null;
    created_at: string;
  };

  return ((data ?? []) as ArticleRow[]).map((a) => ({
    slug: a.slug ?? "",
    title: a.title?.trim() || "Untitled draft",
    summary: a.summary,
    source_name: a.source_name,
    word_count: blogWordCount(a.content),
    url: a.slug ? `${BLOG_BASE_URL}/${BLOG_LOCALE}/blog/${a.slug}` : null,
    published_at: a.published_at,
    created_at: a.created_at,
  }));
}

export interface BlogDraftStats {
  total: number;
  totalWords: number;
  latestAt: string | null;
}

// Stats derived from the same OpenCraft-only article set the list shows.
export function blogDraftStats(drafts: BlogArticleItem[]): BlogDraftStats {
  return {
    total: drafts.length,
    totalWords: drafts.reduce((sum, d) => sum + (d.word_count ?? 0), 0),
    latestAt: drafts[0]?.published_at ?? drafts[0]?.created_at ?? null,
  };
}

export async function getDocumentStats(
  supabase: SupabaseClient,
  agentId: number,
): Promise<DocumentStats> {
  const [totalRes, generatedRes, failedRes, wordsRes] = await Promise.all([
    supabase
      .from("agent_documents")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId),
    supabase
      .from("agent_documents")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("status", "generated"),
    supabase
      .from("agent_documents")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("status", "failed"),
    supabase
      .from("agent_documents")
      .select("word_count")
      .eq("agent_id", agentId)
      .not("word_count", "is", null)
      .limit(5000),
  ]);

  const totalWords = ((wordsRes.data ?? []) as { word_count: number | null }[]).reduce(
    (sum, r) => sum + (r.word_count ?? 0),
    0,
  );

  return {
    total: totalRes.count ?? 0,
    generated: generatedRes.count ?? 0,
    failed: failedRes.count ?? 0,
    totalWords,
  };
}
