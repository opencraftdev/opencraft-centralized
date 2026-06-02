import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runBlogMonitorSync } from "@/lib/monitor/blog-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST (or GET, for cron services that only do GET) /api/monitor/blog/sync
// Reconciles the shared `articles` table into the Blogpost Automation agent's
// telemetry. Protected by MONITOR_CRON_SECRET — pass it as `Authorization:
// Bearer <secret>` or `?key=<secret>`.

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function authorized(req: Request): boolean {
  const secret = process.env.MONITOR_CRON_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  const header = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim();
  const token = bearer ?? new URL(req.url).searchParams.get("key") ?? "";
  return token.length > 0 && safeEqual(token, secret);
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runBlogMonitorSync(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("blog monitor sync failed:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
