import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCloudinaryConfig,
  isRenderReady,
  deleteVideo,
} from "@/lib/cloudinary";
import type { TutorialVideoRow } from "@/features/tutorial-video/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tutorial-video/[id] — status poll.
// If still processing, asks Cloudinary whether the eager render is ready (this
// is what drives progress in local dev, where the webhook can't reach us).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The status update below is a server-side write, so use the service-role
  // client; access is already gated above.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutorial_videos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = data as TutorialVideoRow;
  if (row.status !== "processing") {
    return NextResponse.json({ video: row });
  }

  // Poll the deterministic recipe URL (overlays + spliced outro). 200 = ready.
  if (row.output_url && (await isRenderReady(row.output_url))) {
    const { data: updated } = await admin
      .from("tutorial_videos")
      .update({ status: "done" })
      .eq("id", id)
      .select("*")
      .single();
    return NextResponse.json({ video: updated ?? { ...row, status: "done" } });
  }
  return NextResponse.json({ video: row });
}

// PATCH /api/tutorial-video/[id] — rename a video (update its title).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { title?: string } | null;
  const title = (body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tutorial_videos")
    .update({ title })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ video: data });
}

// DELETE /api/tutorial-video/[id] — frees credits by destroying the Cloudinary
// source video (which also removes its derived output). The history row stays.
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("tutorial_videos")
    .select("source_public_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Destroy the Cloudinary source (its derived output goes with it) to free
  // credits, then remove the history row entirely.
  const config = getCloudinaryConfig();
  if (config) {
    await deleteVideo(config, (data as { source_public_id: string }).source_public_id);
  }

  const admin = createAdminClient();
  await admin.from("tutorial_videos").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
