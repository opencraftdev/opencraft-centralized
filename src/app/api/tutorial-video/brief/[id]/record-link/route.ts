import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signRecorderToken } from "@/lib/tutorial-video/recorder-link";
import {
  PRESENTERS,
  DEFAULT_PRESENTER_ID,
} from "@/features/tutorial-video/presenters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default deep-link scheme the desktop recorder registers. Overridable so a
// build can point at a different scheme.
const DEEP_LINK_BASE =
  process.env.NEXT_PUBLIC_RECORDER_DEEP_LINK || "opencraft-recorder://record";

// Same default as RecorderDownload.tsx — the GitHub releases asset.
const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_RECORDER_DOWNLOAD_URL ||
  "https://github.com/opencraftdev/opencraft-recorder/releases/latest/download/opencraft-recorder-mac-arm64.dmg";

// The public origin the desktop recorder should call back to fetch the full
// brief (GET /api/tutorial-video/brief/[id]?t=…). The recorder is off-box (e.g.
// a Mac reaching this server over Tailscale), so localhost is never right —
// derive it from the request the browser actually used, with an env override for
// fixed deployments.
function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}`;
}

// POST /api/tutorial-video/brief/[id]/record-link
// Session-authed. Mints a short-lived recorder deep link for a given brief so
// the webapp's "Record this brief" button can hand it off to the desktop app.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { presenterId?: string }
    | null;
  const presenterId = (body?.presenterId ?? "").trim();
  if (!presenterId) {
    return NextResponse.json({ error: "presenterId is required" }, { status: 400 });
  }

  // Resolve presenter name + handle from the single source of truth, falling
  // back to the default presenter if the id is unknown.
  const presenter =
    PRESENTERS.find((p) => p.id === presenterId) ??
    PRESENTERS.find((p) => p.id === DEFAULT_PRESENTER_ID);
  if (!presenter) {
    return NextResponse.json({ error: "Unknown presenter" }, { status: 400 });
  }

  // Confirm the brief exists (RLS allows SELECT for the signed-in viewer).
  const { data: brief, error } = await supabase
    .from("news_briefs")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = signRecorderToken(id);

  const url =
    `${DEEP_LINK_BASE}?briefId=${encodeURIComponent(id)}` +
    `&presenter=${encodeURIComponent(presenter.name)}` +
    `&handle=${encodeURIComponent(presenter.handle)}` +
    `&t=${encodeURIComponent(token)}` +
    `&api=${encodeURIComponent(appOrigin(req))}`;

  return NextResponse.json({ url, downloadUrl: DOWNLOAD_URL });
}
