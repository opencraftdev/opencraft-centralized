import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQueueStats, getRecentCommands } from "@/lib/comment-bot/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/comment-bot/status
// Returns daily cap counters, queue depth by status, and recent bot commands.
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [stats, commands] = await Promise.all([
    getQueueStats(supabase),
    getRecentCommands(supabase, 10),
  ]);

  return NextResponse.json({ stats, commands });
}
