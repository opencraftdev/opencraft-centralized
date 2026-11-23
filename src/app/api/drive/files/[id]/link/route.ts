import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLegacyLinks, signStorage } from "@/lib/documents/queries";
import { DRIVE_BUCKET } from "@/lib/drive/types";

export const runtime = "nodejs";

// GET /api/drive/files/[id]/link → { viewUrl, downloadUrl }
// Server-side because legacy (S3) documents need the AWS credentials to presign.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: file, error } = await supabase
    .from("drive_files")
    .select("name, storage_path, legacy_document_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  try {
    if (file.storage_path) {
      return NextResponse.json(await signStorage(supabase, DRIVE_BUCKET, file.storage_path, file.name));
    }
    if (file.legacy_document_id != null) {
      return NextResponse.json(await getLegacyLinks(supabase, file.legacy_document_id));
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ viewUrl: null, downloadUrl: null });
}
