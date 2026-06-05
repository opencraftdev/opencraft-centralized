import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRepliesByStatus } from "@/lib/comment-bot/queries";

export const runtime = "nodejs";

// GET /api/comment-bot/queue?status=ready_for_review
export async function GET(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "ready_for_review") as Parameters<
    typeof getRepliesByStatus
  >[1];

  const replies = await getRepliesByStatus(supabase, status);
  return NextResponse.json({ replies });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), id: z.number().int().positive() }),
  z.object({ action: z.literal("skip"), id: z.number().int().positive() }),
  z.object({
    action: z.literal("approve_all"),
    ids: z.array(z.number().int().positive()).min(1),
  }),
  z.object({
    action: z.literal("skip_all"),
    ids: z.array(z.number().int().positive()).min(1),
  }),
]);

// POST /api/comment-bot/queue
// Body: { action: "approve" | "skip" | "approve_all" | "skip_all", id?: number, ids?: number[] }
export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { action } = parsed.data;

  if (action === "approve" || action === "skip") {
    const { id } = parsed.data;
    const newStatus = action === "approve" ? "approved" : "skipped";
    const patch =
      action === "approve"
        ? { status: newStatus, approved_at: now }
        : { status: newStatus };

    const { error } = await admin.from("replies").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // approve_all / skip_all
  const { ids } = parsed.data;
  const newStatus = action === "approve_all" ? "approved" : "skipped";
  const patch =
    action === "approve_all"
      ? { status: newStatus, approved_at: now }
      : { status: newStatus };

  const { error } = await admin.from("replies").update(patch).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: ids.length });
}
