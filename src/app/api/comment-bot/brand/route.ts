import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBrandProfile } from "@/lib/comment-bot/queries";

export const runtime = "nodejs";

// GET /api/comment-bot/brand
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getBrandProfile(supabase);
  return NextResponse.json({ profile });
}

const updateSchema = z.object({
  data: z.record(z.unknown()),
});

// PUT /api/comment-bot/brand
// Body: { data: { ...brandProfileJson } }
export async function PUT(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("brand_profile")
    .update({ data: parsed.data.data, updated_by: user.email ?? null })
    .eq("slug", "opencraft");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
