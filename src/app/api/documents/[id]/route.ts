import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteS3Object } from "@/lib/s3";

export const runtime = "nodejs";

// DELETE /api/documents/[id]
// Removes one document from the history and its S3 artifact (best-effort).
//
// This is the dashboard's only write path. It is guarded by Supabase Auth — a
// request must carry a valid logged-in session — and performs the delete with
// the service-role key (the browser/anon role is SELECT-only under RLS).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docId = Number(id);
  if (!Number.isInteger(docId) || docId <= 0) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  // Require an authenticated dashboard user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: doc, error: fetchErr } = await admin
    .from("agent_documents")
    .select("id, s3_bucket, s3_key, s3_region")
    .eq("id", docId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  // Best-effort: remove the S3 object. Failure here does not block the record
  // deletion (the artifact may already be gone or storage may be unreachable).
  let s3Deleted: boolean | null = null;
  if (doc.s3_bucket && doc.s3_key) {
    s3Deleted = await deleteS3Object({
      bucket: doc.s3_bucket,
      key: doc.s3_key,
      region: doc.s3_region ?? undefined,
    });
  }

  const { error: delErr } = await admin.from("agent_documents").delete().eq("id", docId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, s3Deleted });
}
