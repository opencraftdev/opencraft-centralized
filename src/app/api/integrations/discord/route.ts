import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDiscordSettings, saveDiscordSettings, type SaveDiscordInput } from "@/lib/integrations/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getDiscordSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: SaveDiscordInput;
  try {
    body = (await req.json()) as SaveDiscordInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    await saveDiscordSettings({
      webhookUrl: body.webhookUrl,
      enabled: body.enabled,
      sources: body.sources,
    });
    const settings = await getDiscordSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save settings";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
