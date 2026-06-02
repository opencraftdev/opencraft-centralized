// Placeholder data for the Blogs → Performance and SEO Audit tabs.
// Deterministic (no Math.random / live Date) so server and client render
// identically — swap these out for live GSC / Firecrawl data later.

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

export type CwvStatus = "good" | "needs-improvement" | "poor";
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

// ── Performance (Search Console + Core Web Vitals) ──────────────
const ANCHOR = new Date("2026-05-31T00:00:00Z");

export const perfTrend: TrendPoint[] = Array.from({ length: 28 }, (_, i) => {
  const d = new Date(ANCHOR);
  d.setUTCDate(d.getUTCDate() - (27 - i));
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const clicks = Math.round(34 + 18 * Math.sin(i / 3) + i * 0.7);
  const impressions = Math.round(980 + 360 * Math.sin(i / 4 + 1) + i * 14);
  return { label, clicks, impressions };
});

export const perfKpis: KpiDelta[] = [
  {
    label: "Visits from Google",
    value: "1,243",
    delta: 12.4,
    deltaLabel: "+12.4%",
    goodWhenUp: true,
    plain: "How many people clicked through to your site from Google search.",
  },
  {
    label: "Times shown on Google",
    value: "38.8K",
    delta: 8.1,
    deltaLabel: "+8.1%",
    goodWhenUp: true,
    plain: "How often your site appeared in someone's search results.",
  },
  {
    label: "Click rate",
    value: "3.2%",
    delta: 0.3,
    deltaLabel: "+0.3pt",
    goodWhenUp: true,
    plain: "Of the people who saw you in Google, how many actually clicked. Higher is better.",
  },
  {
    label: "Average rank",
    value: "14.6",
    delta: -1.2,
    deltaLabel: "−1.2",
    goodWhenUp: false,
    plain: "Your typical spot in Google results. 1 is the very top — lower numbers are better.",
  },
];

export const cwvMetrics: CwvMetric[] = [
  {
    key: "lcp",
    code: "LCP",
    title: "Loading speed",
    value: "2.1s",
    status: "good",
    plain: "How quickly the main content shows up after someone opens the page.",
    goodText: "Good: under 2.5 seconds",
  },
  {
    key: "inp",
    code: "INP",
    title: "Responsiveness",
    value: "184ms",
    status: "needs-improvement",
    plain: "How fast the page reacts when someone taps or clicks something.",
    goodText: "Good: under 200ms",
  },
  {
    key: "cls",
    code: "CLS",
    title: "Visual stability",
    value: "0.06",
    status: "good",
    plain: "How much the layout jumps around while the page is loading.",
    goodText: "Good: under 0.10",
  },
];

export const topQueries: QueryRow[] = [
  { query: "opencraft", clicks: 312, impressions: 4120, ctr: "7.6%", position: 2.1 },
  { query: "ai content automation", clicks: 188, impressions: 6900, ctr: "2.7%", position: 8.4 },
  { query: "social media agent", clicks: 142, impressions: 5210, ctr: "2.7%", position: 11.2 },
  { query: "blog automation tool", clicks: 96, impressions: 3880, ctr: "2.5%", position: 13.9 },
  { query: "document generation ai", clicks: 74, impressions: 2960, ctr: "2.5%", position: 16.3 },
  { query: "content calendar app", clicks: 51, impressions: 2410, ctr: "2.1%", position: 18.7 },
];

export const topPages: PageRow[] = [
  { page: "/", clicks: 498, impressions: 12400, ctr: "4.0%", position: 9.2 },
  { page: "/pricing", clicks: 211, impressions: 5600, ctr: "3.8%", position: 11.0 },
  { page: "/blog", clicks: 167, impressions: 7300, ctr: "2.3%", position: 14.5 },
  { page: "/about", clicks: 88, impressions: 3100, ctr: "2.8%", position: 16.8 },
  { page: "/blog/ai-content-2026", clicks: 63, impressions: 2200, ctr: "2.9%", position: 12.4 },
];

// ── SEO Audit (Firecrawl + claude-seo grading) ──────────────────
export type Severity = "critical" | "high" | "medium" | "low";

export interface CategoryScore {
  key: string;
  label: string;
  weight: number; // percentage weight in the overall score
  score: number; // 0-100
}

export interface Finding {
  severity: Severity;
  category: string;
  page: string;
  message: string;
}

export interface PageScore {
  path: string;
  score: number;
}

export interface AuditSnapshot {
  site: string;
  overallScore: number;
  auditedAt: string;
  categories: CategoryScore[];
  findings: Finding[];
  pages: PageScore[];
}

export const auditSnapshot: AuditSnapshot = {
  site: "ocraft.id",
  overallScore: 78,
  auditedAt: "2026-05-30T09:12:00Z",
  categories: [
    { key: "content", label: "Content Quality", weight: 23, score: 82 },
    { key: "technical", label: "Technical SEO", weight: 22, score: 74 },
    { key: "onpage", label: "On-Page SEO", weight: 20, score: 80 },
    { key: "schema", label: "Schema Markup", weight: 10, score: 61 },
    { key: "performance", label: "Performance (CWV)", weight: 10, score: 70 },
    { key: "ai", label: "AI Search Readiness", weight: 10, score: 88 },
    { key: "images", label: "Images", weight: 5, score: 65 },
  ],
  findings: [
    {
      severity: "critical",
      category: "Technical SEO",
      page: "/pricing",
      message: "Page is missing a canonical tag — risk of duplicate-content dilution.",
    },
    {
      severity: "high",
      category: "Schema Markup",
      page: "/",
      message: "No Organization schema detected. Add JSON-LD for richer brand results.",
    },
    {
      severity: "high",
      category: "Images",
      page: "/about",
      message: "4 images missing alt text, hurting accessibility and image SEO.",
    },
    {
      severity: "medium",
      category: "On-Page SEO",
      page: "/blog",
      message: "Meta description is 178 chars — trim to under 160 to avoid truncation.",
    },
    {
      severity: "medium",
      category: "Performance (CWV)",
      page: "/",
      message: "INP is 184ms (needs improvement). Reduce main-thread work on hero CTA.",
    },
    {
      severity: "low",
      category: "Content Quality",
      page: "/about",
      message: "Add an FAQ section to capture long-tail and AI-overview queries.",
    },
  ],
  pages: [
    { path: "/", score: 84 },
    { path: "/pricing", score: 69 },
    { path: "/about", score: 76 },
    { path: "/blog", score: 81 },
  ],
};
