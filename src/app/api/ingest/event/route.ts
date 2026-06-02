import { NextResponse } from "next/server";
import { withIngest } from "@/lib/ingest/handler";
import { eventSchema } from "@/lib/ingest/schemas";

export const runtime = "nodejs";

// POST /api/ingest/event
// Records a discrete event/log line (info|warning|error).
export async function POST(req: Request) {
  return withIngest(req, eventSchema, async ({ data, agent, admin }) => {
    const { error } = await admin.from("agent_events").insert({
      agent_id: agent.id,
      run_id: data.run_id ?? null,
      level: data.level,
      message: data.message,
      context: data.context ?? null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
