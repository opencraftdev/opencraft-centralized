import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRecorderToken } from "@/lib/tutorial-video/recorder-link";
import type { NewsBriefRow } from "@/features/news-materials/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The recorder is a native/desktop client with no Supabase session, so this
// route is token-gated (?t=<token>) rather than session-authed. Because the
// token already proves authorization, exposing it cross-origin is safe.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// Preflight for the non-browser/native caller.
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/tutorial-video/brief/[id]?t=<token>
// Token-authed (NOT session). Returns the full NewsBriefRow that drives the
// recorder's teleprompter.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!verifyRecorderToken(token, id)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  // RLS only allows SELECT for signed-in viewers and the recorder is
  // unauthenticated, so read with the service-role client. Access is already
  // gated by the verified token above.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("news_briefs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(data as NewsBriefRow, { headers: CORS_HEADERS });
}
