// Serve local files (rendered MP4s, code card PNGs) for browser preview.
// Only files inside the repo's out/ directory are served.
import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { lookup as mimeLookup } from "./mime";

const REPO_ROOT = process.env.REPO_ROOT ?? resolve(process.cwd(), "..");
// web/out is where codeCardRenderer writes when Next.js CWD is web/
const WEB_ROOT = resolve(REPO_ROOT, "web");
const ALLOWED_DIRS = [
  resolve(REPO_ROOT, "out"),
  resolve(REPO_ROOT, "data"),
  resolve(WEB_ROOT, "out"),
];

type Params = { params: Promise<{ path: string[] }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { path: segments } = await params;

  // Reconstruct file path from URL segments (Next.js decodes them)
  // We receive an encoded absolute path split by /. Rejoin and decode.
  const filePath = resolve("/", ...segments);

  // Security: ensure path is inside an allowed directory
  const allowed = ALLOWED_DIRS.some((dir) => {
    const rel = relative(dir, filePath);
    return !rel.startsWith("..") && !rel.startsWith("/");
  });

  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });

    const buffer = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const contentType = mimeLookup(ext);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
