import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDiscordTest } from "@/lib/integrations/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/integrations/discord/test — sends a sample message to the saved webhook.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await sendDiscordTest();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send test";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
