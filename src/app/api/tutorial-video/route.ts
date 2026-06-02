import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCloudinaryConfig,
  buildRenderTransformation,
  buildDeliveryUrl,
  startRender,
} from "@/lib/cloudinary";
import { getPresenter } from "@/features/tutorial-video/presenters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Burned-in captions need Cloudinary's google_video_transcription add-on. It's
// opt-in (one-click enable, costs credits) so we gate it behind an env flag —
// off by default, the recipe simply skips captions and the rest is unchanged.
const CAPTIONS_ENABLED = process.env.CLOUDINARY_CAPTIONS === "1";

// POST /api/tutorial-video
// Body: { sourcePublicId, presenterId, title, duration? }
// Starts the eager render (+ transcription) and records the job in tutorial_videos.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getCloudinaryConfig();
  const logoPublicId = process.env.CLOUDINARY_LOGO_PUBLIC_ID;
  const outroPublicId = process.env.CLOUDINARY_OUTRO_PUBLIC_ID;
  if (!config || !logoPublicId || !outroPublicId) {
    return NextResponse.json(
      { error: "Cloudinary assets not configured (logo/outro public IDs)" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { sourcePublicId?: string; presenterId?: string; title?: string; duration?: number }
    | null;
  const sourcePublicId = body?.sourcePublicId?.trim();
  const presenter = getPresenter(body?.presenterId ?? "");
  const title = (body?.title ?? "").trim();
  if (!sourcePublicId || !presenter || !title) {
    return NextResponse.json(
      { error: "Missing title, sourcePublicId, or unknown presenter" },
      { status: 400 },
    );
  }

  const transformation = buildRenderTransformation({
    name: presenter.name,
    handle: presenter.handle,
    logoPublicId,
    outroPublicId,
    // The transcript Cloudinary generates is served alongside the source, so the
    // subtitles overlay references the source's own public id.
    subtitlesPublicId: CAPTIONS_ENABLED ? sourcePublicId : undefined,
  });
  // Deterministic URL for exactly this recipe — stored now, served when ready.
  const outputUrl = buildDeliveryUrl(config, transformation, sourcePublicId);

  // Only set a webhook when a publicly reachable URL is configured. In local
  // dev there's no public URL, so the status route polls Cloudinary instead.
  const notificationUrl = process.env.TUTORIAL_VIDEO_WEBHOOK_URL || undefined;

  try {
    await startRender({
      config,
      sourcePublicId,
      transformation,
      notificationUrl,
      rawConvert: CAPTIONS_ENABLED ? "google_video_transcription" : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render start failed";
    console.error("tutorial-video render start failed:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutorial_videos")
    .insert({
      user_email: user.email ?? null,
      title,
      name_text: presenter.name,
      source_public_id: sourcePublicId,
      output_url: outputUrl,
      status: "processing",
      duration_seconds: body?.duration ?? null,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

// GET /api/tutorial-video — recent renders (newest first).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("tutorial_videos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ videos: data ?? [] });
}
