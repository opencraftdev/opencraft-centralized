import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCloudinaryConfig,
  signParams,
  TUTORIAL_SOURCE_FOLDER,
} from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/tutorial-video/sign
// Returns a short-lived signature so the browser can upload the raw recording
// straight to Cloudinary, keeping the file off our serverless function.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getCloudinaryConfig();
  if (!config) {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 503 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams(
    { folder: TUTORIAL_SOURCE_FOLDER, timestamp },
    config.apiSecret,
  );

  return NextResponse.json({
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    folder: TUTORIAL_SOURCE_FOLDER,
    signature,
  });
}
