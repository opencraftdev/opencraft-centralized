import { NextResponse } from "next/server";
import { withIngest } from "@/lib/ingest/handler";
import { documentSchema } from "@/lib/ingest/schemas";

export const runtime = "nodejs";

// POST /api/ingest/document
// Records one document the Document Agent produced, including where the
// artifact is stored (S3 primary, optional Supabase Storage / plain URL).
// Upserts on (agent_id, external_id) so re-reporting the same document is
// idempotent (e.g. a retried generation that finally succeeds).
export async function POST(req: Request) {
  return withIngest(req, documentSchema, async ({ data, agent, admin }) => {
    const row = {
      agent_id: agent.id,
      run_id: data.run_id ?? null,
      external_id: data.external_id ?? null,
      title: data.title,
      doc_type: data.doc_type ?? null,
      tool: data.tool ?? null,
      status: data.status,
      word_count: data.word_count ?? null,
      size_bytes: data.size_bytes ?? null,
      duration_ms: data.duration_ms ?? null,
      s3_bucket: data.s3_bucket ?? null,
      s3_key: data.s3_key ?? null,
      s3_region: data.s3_region ?? null,
      storage_bucket: data.storage_bucket ?? null,
      storage_path: data.storage_path ?? null,
      file_url: data.file_url ?? null,
      error_msg: data.error_msg ?? null,
      metadata: data.metadata ?? null,
      generated_at: data.generated_at ?? new Date().toISOString(),
    };

    const query = data.external_id
      ? admin
          .from("agent_documents")
          .upsert(row, { onConflict: "agent_id,external_id" })
          .select("id")
          .single()
      : admin.from("agent_documents").insert(row).select("id").single();

    const { data: inserted, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ document_id: inserted.id }, { status: 201 });
  });
}
