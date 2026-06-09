import type { CoreWebVitals, CwvMetric, CwvStatus } from "./types";

// Core Web Vitals via the PageSpeed Insights API. Prefers CrUX field data (real
// users); falls back to Lighthouse lab data for LCP/CLS when a URL has too
// little traffic for a field reading. INP is field-only (it needs real input).

// The URL we measure — defaults to the public blog index.
function targetUrl(): string {
  if (process.env.SEO_CWV_URL) return process.env.SEO_CWV_URL;
  const base = (process.env.BLOG_PUBLIC_BASE_URL ?? "https://ocraft.id").replace(/\/+$/, "");
  const locale = process.env.BLOG_PUBLIC_LOCALE ?? "id";
  return `${base}/${locale}/blog`;
}

interface FieldMetric {
  percentile: number;
  category: "FAST" | "AVERAGE" | "SLOW";
}
interface PsiResponse {
  loadingExperience?: { metrics?: Record<string, FieldMetric> };
  lighthouseResult?: { audits?: Record<string, { numericValue?: number }> };
}

const categoryToStatus = (c: FieldMetric["category"]): CwvStatus =>
  c === "FAST" ? "good" : c === "AVERAGE" ? "needs-improvement" : "poor";

function band(value: number, good: number, ni: number): CwvStatus {
  if (value <= good) return "good";
  if (value <= ni) return "needs-improvement";
  return "poor";
}

export async function getCoreWebVitals(): Promise<CoreWebVitals> {
  const url = targetUrl();
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", "mobile");
  api.searchParams.append("category", "performance");
  const key = process.env.PAGESPEED_API_KEY;
  if (key) api.searchParams.set("key", key);

  let json: PsiResponse;
  try {
    const res = await fetch(api, {
      // CWV changes slowly; cache the upstream call for 6h across requests.
      next: { revalidate: 21_600 },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      return { ok: false, url, source: "none", metrics: [], reason: `PageSpeed API ${res.status}` };
    }
    json = (await res.json()) as PsiResponse;
  } catch (err) {
    return {
      ok: false,
      url,
      source: "none",
      metrics: [],
      reason: err instanceof Error ? err.message : "PageSpeed request failed",
    };
  }

  const field = json.loadingExperience?.metrics ?? {};
  const lab = json.lighthouseResult?.audits ?? {};
  let usedField = false;
  let usedLab = false;

  // ── LCP (loading speed) ──
  let lcp: CwvMetric;
  const lcpField = field.LARGEST_CONTENTFUL_PAINT_MS;
  const lcpLab = lab["largest-contentful-paint"]?.numericValue;
  if (lcpField) {
    usedField = true;
    lcp = mkMetric("lcp", "LCP", "Loading speed", `${(lcpField.percentile / 1000).toFixed(1)}s`,
      categoryToStatus(lcpField.category),
      "How quickly the main content shows up after someone opens the page.",
      "Good: under 2.5 seconds");
  } else if (typeof lcpLab === "number") {
    usedLab = true;
    lcp = mkMetric("lcp", "LCP", "Loading speed", `${(lcpLab / 1000).toFixed(1)}s`,
      band(lcpLab, 2500, 4000),
      "How quickly the main content shows up after someone opens the page.",
      "Good: under 2.5 seconds");
  } else {
    lcp = unknownMetric("lcp", "LCP", "Loading speed",
      "How quickly the main content shows up after someone opens the page.", "Good: under 2.5 seconds");
  }

  // ── INP (responsiveness) — field-only ──
  let inp: CwvMetric;
  const inpField = field.INTERACTION_TO_NEXT_PAINT;
  if (inpField) {
    usedField = true;
    inp = mkMetric("inp", "INP", "Responsiveness", `${Math.round(inpField.percentile)}ms`,
      categoryToStatus(inpField.category),
      "How fast the page reacts when someone taps or clicks something.",
      "Good: under 200ms");
  } else {
    inp = unknownMetric("inp", "INP", "Responsiveness",
      "How fast the page reacts when someone taps or clicks something.",
      "Needs enough real visitors for Google to measure.");
  }

  // ── CLS (visual stability) ──
  let cls: CwvMetric;
  const clsField = field.CUMULATIVE_LAYOUT_SHIFT_SCORE;
  const clsLab = lab["cumulative-layout-shift"]?.numericValue;
  if (clsField) {
    usedField = true;
    cls = mkMetric("cls", "CLS", "Visual stability", (clsField.percentile / 100).toFixed(2),
      categoryToStatus(clsField.category),
      "How much the layout jumps around while the page is loading.",
      "Good: under 0.10");
  } else if (typeof clsLab === "number") {
    usedLab = true;
    cls = mkMetric("cls", "CLS", "Visual stability", clsLab.toFixed(2),
      band(clsLab, 0.1, 0.25),
      "How much the layout jumps around while the page is loading.",
      "Good: under 0.10");
  } else {
    cls = unknownMetric("cls", "CLS", "Visual stability",
      "How much the layout jumps around while the page is loading.", "Good: under 0.10");
  }

  const source = usedField ? "field" : usedLab ? "lab" : "none";
  return { ok: source !== "none", url, source, metrics: [lcp, inp, cls] };
}

function mkMetric(
  key: string, code: string, title: string, value: string,
  status: CwvStatus, plain: string, goodText: string,
): CwvMetric {
  return { key, code, title, value, status, plain, goodText };
}
function unknownMetric(
  key: string, code: string, title: string, plain: string, goodText: string,
): CwvMetric {
  return { key, code, title, value: "No data yet", status: "unknown", plain, goodText };
}
