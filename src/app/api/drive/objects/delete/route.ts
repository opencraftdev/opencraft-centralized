import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteS3Objects } from "@/lib/s3";

export const runtime = "nodejs";

// POST /api/drive/objects/delete {ids} → deletes the S3 objects of these drive_files rows.
// Keys are looked up server-side, so a caller can only delete objects that belong to Drive rows.
// The browser deletes the rows afterwards.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (!ids.length) return NextResponse.json({ deleted: 0 });

  const { data, error } = await supabase.from("drive_files").select("storage_path").in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const keys = (data ?? [])
    .map((r) => r.storage_path as string | null)
    .filter((k): k is string => !!k && k.startsWith("drive/"));
  try {
    await deleteS3Objects(keys);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ deleted: keys.length });
}
