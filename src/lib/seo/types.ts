// Display + read-model types for the Blogs → Performance view.
// Search metrics come from Google Search Console; page-experience metrics from
// the PageSpeed Insights / CrUX API. Mirrors the KPI shapes the UI renders.

export type CwvStatus = "good" | "needs-improvement" | "poor" | "unknown";

export interface KpiDelta {
  label: string;
  value: string;
  /** signed percentage / point change vs the prior period */
  delta: number;
  deltaLabel: string;
  /** when true an upward delta is good (clicks); false → lower is better (position) */
  goodWhenUp: boolean;
  /** plain-English explanation for non-SEO readers */
  plain: string;
}

export interface TrendPoint {
  label: string;
  clicks: number;
  impressions: number;
}

export interface CwvMetric {
  key: string;
  /** technical code shown as a small badge (LCP / INP / CLS) */
  code: string;
  /** friendly, plain-English name */
  title: string;
  value: string;
  status: CwvStatus;
  /** one-line explanation anyone can understand */
  plain: string;
  /** what a good result looks like */
  goodText: string;
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: number;
}

export interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: number;
}

// ── Aggregate read models ───────────────────────────────────

export interface SearchPerformance {
  /** true when GSC is configured and the query succeeded */
  connected: boolean;
  /** why we're not connected / what went wrong (shown in the connect state) */
  reason?: string;
  siteUrl: string;
  range: { start: string; end: string } | null;
  kpis: {
    clicks: KpiDelta;
    impressions: KpiDelta;
    ctr: KpiDelta;
    position: KpiDelta;
  } | null;
  trend: TrendPoint[];
  topQueries: QueryRow[];
  topPages: PageRow[];
  fetchedAt: string;
}

export interface CoreWebVitals {
  ok: boolean;
  url: string;
  /** field = real-user (CrUX), lab = Lighthouse, none = unavailable */
  source: "field" | "lab" | "none";
  metrics: CwvMetric[];
  reason?: string;
}
