import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCloudinaryConfig, getCreditUsage } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tutorial-video/usage — Cloudinary credit usage for the meter.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getCloudinaryConfig();
  if (!config) return NextResponse.json({ usage: null });

  const usage = await getCreditUsage(config);
  return NextResponse.json({ usage });
}
