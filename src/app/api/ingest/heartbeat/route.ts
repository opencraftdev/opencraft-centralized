import { NextResponse } from "next/server";
import { withIngest } from "@/lib/ingest/handler";
import { heartbeatSchema } from "@/lib/ingest/schemas";

export const runtime = "nodejs";

// POST /api/ingest/heartbeat — { slug }
// Updates the agent's last_heartbeat_at, which drives the online/offline dot.
export async function POST(req: Request) {
  return withIngest(req, heartbeatSchema, async ({ agent, admin }) => {
    const { error } = await admin
      .from("agents")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", agent.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  });
}
