import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAllowedUser } from "@/lib/auth/allowed";
import { GoogleDriveError, openContent } from "@/lib/google/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/drive/files/:id/content[?download=1]  (docs/DRIVE.md → "Preview without a Google session")
// Streams the drive_files row's Google file with the server's Drive token, so the browser needs no
// Google session. Google-native Docs/Sheets/Slides are exported to PDF; for the inline preview, Office
// files (docx/pptx/xlsx) are converted to PDF as well. `?download=1` → the original bytes as attachment.

// Types the browser may render inline on our origin. Everything else is served with a sandbox CSP
// (inert: no scripts, no same-origin access), e.g. uploaded HTML/SVG.
const SAFE_INLINE = /^(application\/pdf|image\/(png|jpeg|gif|webp|avif|bmp)|video\/|audio\/|text\/plain|text\/csv)/;

const EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

function contentDisposition(type: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAllowedUser();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  const download = new URL(req.url).searchParams.get("download") === "1";
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("drive_files")
    .select("name, mime_type, google_file_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  if (!row.google_file_id) return NextResponse.json({ error: "File belum tersedia" }, { status: 404 });

  const mime = (row.mime_type as string | null) ?? "application/octet-stream";
  try {
    const { res, pdf } = await openContent(
      row.google_file_id as string,
      { mimeType: mime, asPdf: !download, range: rangeHeader(req, download) },
      db,
    );
    let name = row.name as string;
    if (pdf && !/\.pdf$/i.test(name)) name = `${name.replace(/\.(docx?|pptx?|xlsx?)$/i, "")}.pdf`;
    const type = pdf ? "application/pdf" : (res.headers.get("content-type") ?? mime);
    // Display names may lack the extension (e.g. "Penawaran Harga …"): add it for the saved file.
    const ext = EXT[type.split(";")[0]];
    if (ext && !name.toLowerCase().endsWith(ext)) name += ext;

    const headers = new Headers({
      "content-type": type,
      "content-disposition": contentDisposition(download ? "attachment" : "inline", name),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
    if (!download && !SAFE_INLINE.test(type)) headers.set("content-security-policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(res.body, { status: res.status === 206 ? 206 : 200, headers });
  } catch (e) {
    const status = e instanceof GoogleDriveError && e.status === 404 ? 404 : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

// Range requests (video seeking, PDF streaming) only make sense for the original bytes.
function rangeHeader(req: Request, download: boolean): string | null {
  return download ? null : req.headers.get("range");
}
