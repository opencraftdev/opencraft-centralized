import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { driveLinks } from "@/lib/drive/storage";

export const runtime = "nodejs";

// GET /api/drive/files/[id]/link → { viewUrl, downloadUrl } (presigned S3 GETs, server-side so AWS keys stay here)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: file, error } = await supabase
    .from("drive_files")
    .select("name, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!file.storage_path) return NextResponse.json({ viewUrl: null, downloadUrl: null });

  const links = driveLinks(file.storage_path, file.name);
  if (!links.viewUrl) return NextResponse.json({ error: "S3 is not configured" }, { status: 500 });
  return NextResponse.json(links);
}
