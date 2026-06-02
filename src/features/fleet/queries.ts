import type { SupabaseClient } from "@supabase/supabase-js";
import { getFleet } from "@/lib/monitor/queries";
import { formatDuration, formatBytes, formatNumber } from "@/features/monitor/format";
import type { AgentSummary, AgentKind } from "@/lib/monitor/types";

// ── Window selection ────────────────────────────────────────

export type FleetWindow = "24h" | "7d" | "30d";

export const WINDOW_META: Record<
  FleetWindow,
  { label: string; ms: number; bucket: "hour" | "day"; buckets: number }
> = {
  "24h": { label: "24 hours", ms: 24 * 3_600_000, bucket: "hour", buckets: 24 },
  "7d": { label: "7 days", ms: 7 * 86_400_000, bucket: "day", buckets: 7 },
  "30d": { label: "30 days", ms: 30 * 86_400_000, bucket: "day", buckets: 30 },
};

export function parseWindow(raw: string | undefined): FleetWindow {
  return raw === "24h" || raw === "30d" ? raw : "7d";
}

// ── Shapes the overview returns ─────────────────────────────

export interface FleetTotals {
  runs: number;
  succeeded: number;
  failed: number;
  running: number;
  successRate: number | null; // 0..1
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  itemsProcessed: number;
}

export interface TimeBucket {
  /** short axis label, e.g. "14:00" or "May 28" */
  label: string;
  succeeded: number;
  failed: number;
}

export type ActivityType = "run" | "document";
export type ActivityOutcome = "succeeded" | "failed" | "running" | "generated" | "pending";

/** One entry in the cross-fleet activity history. */
export interface ActivityItem {
  key: string;
  agentName: string;
  agentKind: AgentKind | null;
  type: ActivityType;
  title: string;
  detail: string | null;
  outcome: ActivityOutcome;
  at: string;
}

export interface FleetOverview {
  window: FleetWindow;
  agents: AgentSummary[];
  totals: FleetTotals;
  series: TimeBucket[];
  activity: ActivityItem[];
}

type RawRun = {
  agent_id: number;
  status: "running" | "succeeded" | "failed";
  duration_ms: number | null;
  items_processed: number | null;
  started_at: string;
};

type ActivityRun = RawRun & { id: number; external_id: string | null };

type RawDoc = {
  id: number;
  agent_id: number;
  title: string;
  doc_type: string | null;
  tool: string | null;
  word_count: number | null;
  size_bytes: number | null;
  status: string;
  generated_at: string;
};

// ── Bucketing helpers (local time) ──────────────────────────

function startOfLocalHour(d: Date): Date {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function hourLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Builds a continuous, gap-free set of buckets ending "now" and tallies runs.
function buildSeries(runs: RawRun[], window: FleetWindow): TimeBucket[] {
  const { bucket, buckets } = WINDOW_META[window];
  const now = new Date();
  const stepMs = bucket === "hour" ? 3_600_000 : 86_400_000;
  const anchor = bucket === "hour" ? startOfLocalHour(now) : startOfLocalDay(now);

  const order: number[] = [];
  const byKey = new Map<number, TimeBucket>();
  for (let i = buckets - 1; i >= 0; i--) {
    const d = new Date(anchor.getTime() - i * stepMs);
    const key = d.getTime();
    order.push(key);
    byKey.set(key, {
      label: bucket === "hour" ? hourLabel(d) : dayLabel(d),
      succeeded: 0,
      failed: 0,
    });
  }

  for (const r of runs) {
    if (r.status === "running") continue;
    const d = new Date(r.started_at);
    const key = (bucket === "hour" ? startOfLocalHour(d) : startOfLocalDay(d)).getTime();
    const b = byKey.get(key);
    if (!b) continue;
    if (r.status === "succeeded") b.succeeded += 1;
    else if (r.status === "failed") b.failed += 1;
  }

  return order.map((k) => byKey.get(k)!);
}

function computeTotals(runs: RawRun[]): FleetTotals {
  let succeeded = 0;
  let failed = 0;
  let running = 0;
  let items = 0;
  const durations: number[] = [];

  for (const r of runs) {
    if (r.status === "succeeded") succeeded += 1;
    else if (r.status === "failed") failed += 1;
    else running += 1;
    items += r.items_processed ?? 0;
    if (r.duration_ms != null) durations.push(r.duration_ms);
  }

  const finished = succeeded + failed;
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  let p95: number | null = null;
  if (durations.length) {
    const sorted = [...durations].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
    p95 = sorted[Math.max(0, idx)];
  }

  return {
    runs: runs.length,
    succeeded,
    failed,
    running,
    successRate: finished > 0 ? succeeded / finished : null,
    avgDurationMs: avg,
    p95DurationMs: p95,
    itemsProcessed: items,
  };
}

// ── Activity labelling ──────────────────────────────────────

const RUN_ACTION: Record<AgentKind, string> = {
  "social-media": "Post pipeline run",
  document: "Document generation run",
  "comment-bot": "Commenting cycle",
  blogpost: "Blog post run",
};

function runDetail(r: ActivityRun): string | null {
  const parts: string[] = [];
  if (r.items_processed && r.items_processed > 0) parts.push(`${formatNumber(r.items_processed)} items`);
  if (r.duration_ms != null) parts.push(formatDuration(r.duration_ms));
  if (r.external_id) parts.push(r.external_id);
  return parts.length ? parts.join(" · ") : null;
}

function docDetail(d: RawDoc): string | null {
  const parts: string[] = [];
  if (d.doc_type) parts.push(d.doc_type.toUpperCase());
  if (d.word_count != null) parts.push(`${formatNumber(d.word_count)} words`);
  if (d.size_bytes != null) parts.push(formatBytes(d.size_bytes));
  if (d.tool) parts.push(d.tool);
  return parts.length ? parts.join(" · ") : null;
}

// ── Main loader ─────────────────────────────────────────────

const ACTIVITY_LIMIT = 25;

export async function getFleetOverview(
  supabase: SupabaseClient,
  window: FleetWindow,
): Promise<FleetOverview> {
  const agents = await getFleet(supabase);
  const since = new Date(Date.now() - WINDOW_META[window].ms).toISOString();

  const [windowRunsRes, recentRunsRes, docsRes] = await Promise.all([
    // Windowed runs power the hero chart + totals.
    supabase
      .from("agent_runs")
      .select("agent_id,status,duration_ms,items_processed,started_at")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(20000),
    // Latest runs across every agent feed the activity history.
    supabase
      .from("agent_runs")
      .select("id,agent_id,external_id,status,duration_ms,items_processed,started_at")
      .order("started_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    // Latest produced documents feed the activity history.
    supabase
      .from("agent_documents")
      .select("id,agent_id,title,doc_type,tool,word_count,size_bytes,status,generated_at")
      .order("generated_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
  ]);

  if (windowRunsRes.error) throw windowRunsRes.error;

  const windowRuns = (windowRunsRes.data ?? []) as RawRun[];
  const totals = computeTotals(windowRuns);
  const series = buildSeries(windowRuns, window);

  // ── Unified activity feed across all agents ───────────────
  const agentById = new Map(agents.map((a) => [a.id, a]));

  const runItems: ActivityItem[] = ((recentRunsRes.data ?? []) as ActivityRun[]).map((r) => {
    const agent = agentById.get(r.agent_id);
    const kind = agent?.kind ?? null;
    return {
      key: `run-${r.id}`,
      agentName: agent?.name ?? "Unknown agent",
      agentKind: kind,
      type: "run",
      title: kind ? RUN_ACTION[kind] : "Agent run",
      detail: runDetail(r),
      outcome: r.status,
      at: r.started_at,
    };
  });

  const docItems: ActivityItem[] = ((docsRes.data ?? []) as RawDoc[]).map((d) => {
    const agent = agentById.get(d.agent_id);
    return {
      key: `doc-${d.id}`,
      agentName: agent?.name ?? "Unknown agent",
      agentKind: agent?.kind ?? null,
      type: "document",
      title: d.title,
      detail: docDetail(d),
      outcome: (d.status as ActivityOutcome) ?? "generated",
      at: d.generated_at,
    };
  });

  const activity = [...runItems, ...docItems]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, ACTIVITY_LIMIT);

  return { window, agents, totals, series, activity };
}
