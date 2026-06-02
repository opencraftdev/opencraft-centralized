import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCloudinaryConfig, verifyWebhookSignature } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/tutorial-video/webhook
// Cloudinary's eager-render notification. Configure its URL as
// TUTORIAL_VIDEO_WEBHOOK_URL (a public https URL) for production; local dev
// relies on the status route polling instead.
export async function POST(req: Request) {
  const config = getCloudinaryConfig();
  if (!config) return NextResponse.json({ ok: false }, { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get("x-cld-signature") ?? "";
  const timestamp = req.headers.get("x-cld-timestamp") ?? "";
  if (
    !signature ||
    !timestamp ||
    !verifyWebhookSignature(raw, timestamp, signature, config.apiSecret)
  ) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  let payload: { public_id?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  // The deterministic output_url is already stored at creation, so the eager
  // notification just needs to flip the job to done.
  const publicId = payload.public_id;
  if (publicId) {
    const admin = createAdminClient();
    await admin
      .from("tutorial_videos")
      .update({ status: "done" })
      .eq("source_public_id", publicId)
      .eq("status", "processing");
  }

  return NextResponse.json({ ok: true });
}
