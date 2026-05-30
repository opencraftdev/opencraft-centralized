import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { getPost, updatePost } from "@/lib/posts";

const REPO_ROOT = process.env.REPO_ROOT ?? resolve(process.cwd(), "..");

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = await getPost(supabase, Number(id));
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.type !== "video") return NextResponse.json({ error: "Only video posts can be recovered" }, { status: 400 });

  const statePath = resolve(REPO_ROOT, ".agent-state.json");
  if (!existsSync(statePath)) {
    return NextResponse.json({ error: ".agent-state.json not found" }, { status: 404 });
  }

  let state: {
    phase?: string;
    bundle?: { renderedPath?: string; headline?: string; captions?: Record<string, string>; hashtags?: Record<string, string[]> };
    source?: { url?: string; channelTitle?: string; videoId?: string; videoTitle?: string };
  };
  try {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    return NextResponse.json({ error: "Failed to parse .agent-state.json" }, { status: 500 });
  }

  if (state.phase !== "drafted" || !state.bundle?.renderedPath) {
    return NextResponse.json({ error: `State phase is '${state.phase}' — expected 'drafted'` }, { status: 400 });
  }

  await updatePost(supabase, Number(id), {
    videoPath: state.bundle.renderedPath,
    headline: state.bundle.headline,
    captions: state.bundle.captions ?? null,
    hashtags: state.bundle.hashtags ?? null,
    source: state.source
      ? { videoUrl: state.source.url ?? "", channelTitle: state.source.channelTitle ?? "", videoId: state.source.videoId ?? "", videoTitle: state.source.videoTitle ?? "" }
      : null,
    status: "draft",
  });

  const updated = await getPost(supabase, Number(id));
  return NextResponse.json({ post: updated, recoveredFrom: state.bundle.renderedPath });
}
