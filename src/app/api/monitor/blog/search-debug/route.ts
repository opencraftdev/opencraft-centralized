import { NextResponse } from "next/server";
import { getSearchPerformance } from "@/lib/seo/search-console";

export const dynamic = "force-dynamic";

// Quick connection diagnostic for Blogs → Performance (no secrets returned).
// GET /api/monitor/blog/search-debug
export async function GET() {
  const s = await getSearchPerformance();
  return NextResponse.json({
    connected: s.connected,
    reason: s.reason ?? null,
    siteUrl: s.siteUrl,
    range: s.range,
    hasKpis: Boolean(s.kpis),
    trendPoints: s.trend.length,
    topQueries: s.topQueries.length,
    topPages: s.topPages.length,
  });
}
