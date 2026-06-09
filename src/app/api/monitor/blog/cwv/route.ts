import { NextResponse } from "next/server";
import { getCoreWebVitals } from "@/lib/seo/pagespeed";

// Core Web Vitals are fetched client-side (PageSpeed can take 10-30s) so the
// Performance page paints its Search Console data immediately. The upstream
// PageSpeed call is cached 6h inside getCoreWebVitals().
export async function GET() {
  const cwv = await getCoreWebVitals();
  return NextResponse.json(cwv);
}
