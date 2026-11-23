import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createResumableUpload, ensureFolder } from "@/lib/google/drive";

export const runtime = "nodejs";

// POST /api/drive/upload {name, mimeType, size, folderId} → { uploadUrl }
// Creates a Google Drive resumable upload session in the Google folder of `folderId` (null = root).
// The browser PUTs the file to uploadUrl, reads the Google file id from the response and inserts
// the drive_files row (see src/features/drive/api.ts uploadFile).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const mimeType = typeof body?.mimeType === "string" && body.mimeType ? body.mimeType : "application/octet-stream";
  const size = typeof body?.size === "number" && body.size >= 0 ? body.size : undefined;
  const folderId = typeof body?.folderId === "string" && body.folderId ? body.folderId : null;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  try {
    const parentId = await ensureFolder(folderId);
    const uploadUrl = await createResumableUpload({ name, mimeType, parentId, origin, size });
    return NextResponse.json({ uploadUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
