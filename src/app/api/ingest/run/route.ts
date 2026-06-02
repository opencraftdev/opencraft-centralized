import { NextResponse } from "next/server";
import { withIngest } from "@/lib/ingest/handler";
import { runSchema } from "@/lib/ingest/schemas";

export const runtime = "nodejs";

// POST /api/ingest/run
// Open a run (status: "running") or close one (status: "succeeded"|"failed").
// A close call is matched by run_id, or by (agent_id, external_id).
export async function POST(req: Request) {
  return withIngest(req, runSchema, async ({ data, agent, admin }) => {
    // ── Opening a new run ──────────────────────────────────
    if (data.status === "running" && data.run_id == null) {
      const row = {
        agent_id: agent.id,
        external_id: data.external_id ?? null,
        status: "running" as const,
        items_processed: data.items_processed ?? 0,
        started_at: data.started_at ?? new Date().toISOString(),
      };

      // Upsert on (agent_id, external_id) so a retried "open" is idempotent.
      const query = data.external_id
        ? admin
            .from("agent_runs")
            .upsert(row, { onConflict: "agent_id,external_id" })
            .select("id")
            .single()
        : admin.from("agent_runs").insert(row).select("id").single();

      const { data: inserted, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ run_id: inserted.id }, { status: 201 });
    }

    // ── Closing / updating an existing run ─────────────────
    const patch: Record<string, unknown> = { status: data.status };
    if (data.items_processed != null) patch.items_processed = data.items_processed;
    if (data.duration_ms != null) patch.duration_ms = data.duration_ms;
    if (data.error_msg != null) patch.error_msg = data.error_msg;
    if (data.status !== "running") {
      patch.finished_at = data.finished_at ?? new Date().toISOString();
    }

    let update = admin.from("agent_runs").update(patch).eq("agent_id", agent.id);
    update = data.run_id != null
      ? update.eq("id", data.run_id)
      : update.eq("external_id", data.external_id!);

    const { data: updated, error } = await update.select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    return NextResponse.json({ run_id: updated.id });
  });
}
