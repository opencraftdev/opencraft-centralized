import { NextResponse } from "next/server";
import { withIngest } from "@/lib/ingest/handler";
import { metricSchema } from "@/lib/ingest/schemas";

export const runtime = "nodejs";

// POST /api/ingest/metric
// Records one domain metric point (incremental value per run; see METRICS.md).
export async function POST(req: Request) {
  return withIngest(req, metricSchema, async ({ data, agent, admin }) => {
    const { error } = await admin.from("agent_metrics").insert({
      agent_id: agent.id,
      run_id: data.run_id ?? null,
      metric_key: data.metric_key,
      value: data.value,
      labels: data.labels ?? null,
      recorded_at: data.recorded_at ?? new Date().toISOString(),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
