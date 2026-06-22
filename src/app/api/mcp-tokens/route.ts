import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createToken, listTokens, revokeToken } from "@/features/mcp-tokens/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resolve the logged-in user from the app session, or null. */
async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const tokens = await listTokens(session.supabase, session.user.id);
    return NextResponse.json({ tokens });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list tokens" },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { name?: string; expiresInDays?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }
  try {
    const { raw, token } = await createToken(
      session.supabase,
      session.user.id,
      body.name ?? "MCP token",
      body.expiresInDays,
    );
    // `raw` is returned exactly once — the client must copy it now.
    return NextResponse.json({ token, raw });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create token" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing token id" }, { status: 400 });
  try {
    await revokeToken(session.supabase, session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to revoke token" },
      { status: 400 },
    );
  }
}
