import { unstable_cache } from "next/cache";
import {
  getGscAccessToken,
  isGscConfigured,
  ServiceAccountMissingError,
} from "./google-auth";
import type {
  KpiDelta,
  PageRow,
  QueryRow,
  SearchPerformance,
  TrendPoint,
} from "./types";

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// The Search Console property. Domain properties use the `sc-domain:` prefix;
// URL-prefix properties use the full origin (e.g. https://ocraft.id/).
const SITE_URL = process.env.GSC_SITE_URL ?? "sc-domain:ocraft.id";

// GSC data finalizes ~2 days late, so the analysis window ends 2 days back.
const LAG_DAYS = 2;
const WINDOW = 28;

interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function queryGsc(body: Record<string, unknown>): Promise<GscRow[]> {
  const token = await getGscAccessToken(SCOPE);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      SITE_URL,
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`Search Console API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { rows?: GscRow[] };
  return json.rows ?? [];
}

// ── Formatting helpers ──────────────────────────────────────

function compact(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-US");
}
function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}
function pctLabel(delta: number): string {
  return `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}%`;
}

function buildKpis(cur: GscRow, prev: GscRow): SearchPerformance["kpis"] {
  const clicksDelta = pctChange(cur.clicks, prev.clicks);
  const imprDelta = pctChange(cur.impressions, prev.impressions);
  const ctrDelta = (cur.ctr - prev.ctr) * 100; // points
  const posDelta = cur.position - prev.position; // lower is better

  const clicks: KpiDelta = {
    label: "Visits from Google",
    value: Math.round(cur.clicks).toLocaleString("en-US"),
    delta: clicksDelta,
    deltaLabel: pctLabel(clicksDelta),
    goodWhenUp: true,
    plain: "How many people clicked through to your site from Google search.",
  };
  const impressions: KpiDelta = {
    label: "Times shown on Google",
    value: compact(cur.impressions),
    delta: imprDelta,
    deltaLabel: pctLabel(imprDelta),
    goodWhenUp: true,
    plain: "How often your site appeared in someone's search results.",
  };
  const ctr: KpiDelta = {
    label: "Click rate",
    value: `${(cur.ctr * 100).toFixed(1)}%`,
    delta: ctrDelta,
    deltaLabel: `${ctrDelta >= 0 ? "+" : "−"}${Math.abs(ctrDelta).toFixed(1)}pt`,
    goodWhenUp: true,
    plain: "Of the people who saw you in Google, how many actually clicked. Higher is better.",
  };
  const position: KpiDelta = {
    label: "Average rank",
    value: cur.position.toFixed(1),
    delta: posDelta,
    // GSC delta is "new − old"; a drop in position number is an improvement, so
    // we flip the sign for display so "better" always reads as a negative move.
    deltaLabel: `${posDelta <= 0 ? "−" : "+"}${Math.abs(posDelta).toFixed(1)}`,
    goodWhenUp: false,
    plain: "Your typical spot in Google results. 1 is the very top — lower numbers are better.",
  };
  return { clicks, impressions, ctr, position };
}

const EMPTY_ROW: GscRow = { clicks: 0, impressions: 0, ctr: 0, position: 0 };

async function fetchSearchPerformance(): Promise<SearchPerformance> {
  const base: SearchPerformance = {
    connected: false,
    siteUrl: SITE_URL,
    range: null,
    kpis: null,
    trend: [],
    topQueries: [],
    topPages: [],
    fetchedAt: new Date().toISOString(),
  };

  if (!isGscConfigured()) {
    return {
      ...base,
      reason:
        "Google Search Console isn't connected yet. Run the OAuth sign-in (scripts/gsc-oauth.mjs) or add a service-account key.",
    };
  }

  const endDate = ymd(daysAgo(LAG_DAYS));
  const startDate = ymd(daysAgo(LAG_DAYS + WINDOW - 1));
  const prevEnd = ymd(daysAgo(LAG_DAYS + WINDOW));
  const prevStart = ymd(daysAgo(LAG_DAYS + WINDOW * 2 - 1));

  try {
    const [curTotals, prevTotals, byDate, byQuery, byPage] = await Promise.all([
      queryGsc({ startDate, endDate }),
      queryGsc({ startDate: prevStart, endDate: prevEnd }),
      queryGsc({ startDate, endDate, dimensions: ["date"], rowLimit: 1000 }),
      queryGsc({ startDate, endDate, dimensions: ["query"], rowLimit: 10 }),
      queryGsc({ startDate, endDate, dimensions: ["page"], rowLimit: 10 }),
    ]);

    const cur = curTotals[0] ?? EMPTY_ROW;
    const prev = prevTotals[0] ?? EMPTY_ROW;

    // The date dimension comes back ordered by clicks, not chronologically —
    // sort by the YYYY-MM-DD key (lexicographic = chronological) before mapping.
    const trend: TrendPoint[] = [...byDate]
      .sort((a, b) => (a.keys?.[0] ?? "").localeCompare(b.keys?.[0] ?? ""))
      .map((r) => ({
        label: new Date(`${r.keys?.[0]}T00:00:00Z`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
      }));

    const topQueries: QueryRow[] = byQuery
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 6)
      .map((r) => ({
        query: r.keys?.[0] ?? "(unknown)",
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        ctr: `${(r.ctr * 100).toFixed(1)}%`,
        position: r.position,
      }));

    const topPages: PageRow[] = byPage
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 6)
      .map((r) => ({
        page: prettyPath(r.keys?.[0] ?? ""),
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        ctr: `${(r.ctr * 100).toFixed(1)}%`,
        position: r.position,
      }));

    return {
      ...base,
      connected: true,
      range: { start: startDate, end: endDate },
      kpis: buildKpis(cur, prev),
      trend,
      topQueries,
      topPages,
    };
  } catch (err) {
    if (err instanceof ServiceAccountMissingError) {
      return { ...base, reason: "Google Search Console isn't connected yet." };
    }
    return {
      ...base,
      reason: err instanceof Error ? err.message : "Failed to load Search Console data.",
    };
  }
}

// Show the path (and query) without the origin — easier to scan in the table.
function prettyPath(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname + u.search) || "/";
  } catch {
    return url || "/";
  }
}

// Cached 30m: GSC data only refreshes daily, so per-request hits to Google are
// wasteful. Keyed globally (site-level data, identical for every viewer).
// (v2 key intentionally busts any stale pre-credentials cache entry.)
const cachedSearchPerformance = unstable_cache(
  fetchSearchPerformance,
  ["blog-search-performance-v2"],
  { revalidate: 1800, tags: ["seo-performance"] },
);

// Only cache once GSC is actually configured. Otherwise a render that happens
// before the credentials are in place would pin a stale "not connected" result
// for the whole revalidate window, even after the env is fixed.
export async function getSearchPerformance(): Promise<SearchPerformance> {
  if (!isGscConfigured()) return fetchSearchPerformance();
  return cachedSearchPerformance();
}
