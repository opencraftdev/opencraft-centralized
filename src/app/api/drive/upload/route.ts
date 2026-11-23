import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presignS3Url } from "@/lib/s3";
import { driveKey, UPLOAD_TTL } from "@/lib/drive/storage";

export const runtime = "nodejs";

// POST /api/drive/upload {name} → { id, key, uploadUrl }
// The browser PUTs the file straight to S3 with uploadUrl, then inserts the drive_files row with this id + key.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const id = crypto.randomUUID();
  const key = driveKey(id, name);
  const uploadUrl = presignS3Url({ method: "PUT", key, expiresIn: UPLOAD_TTL });
  if (!uploadUrl) return NextResponse.json({ error: "S3 is not configured" }, { status: 500 });
  return NextResponse.json({ id, key, uploadUrl });
}
