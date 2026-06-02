import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const commandSchema = z.object({
  command: z.enum(["scrape", "post_approved", "draft"]),
  platform: z.enum(["threads", "x", "all"]).optional(),
  context: z.record(z.unknown()).optional(),
});

// POST /api/comment-bot/command
// Writes a bot_commands row; the bot polls for pending rows and executes them.
export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bot_commands")
    .insert({
      command: parsed.data.command,
      platform: parsed.data.platform ?? null,
      context: parsed.data.context ?? null,
      requested_by: user.email ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, command_id: data.id }, { status: 201 });
}
