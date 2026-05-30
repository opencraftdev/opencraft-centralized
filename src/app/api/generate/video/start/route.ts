import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPost, createJob, hasRunningJobForPost, getJobForPost } from "@/lib/posts";
import { z } from "zod";

const Schema = z.object({
  postId: z.number().int().positive(),
  videoId: z.string().min(1),
  videoTitle: z.string().optional(),
  videoUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { postId, videoId, videoTitle = "", videoUrl = "" } = parsed.data;

  const post = await getPost(supabase, postId);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.type !== "video") return NextResponse.json({ error: "Post is not type 'video'" }, { status: 400 });

  if (await hasRunningJobForPost(supabase, postId)) {
    const existingJob = await getJobForPost(supabase, postId);
    return NextResponse.json(
      { error: "A generation job is already running for this post", jobId: existingJob?.id ?? null },
      { status: 409 },
    );
  }

  const job = await createJob(supabase, postId);

  void import("@/lib/video-worker").then(({ runVideoPipeline }) =>
    runVideoPipeline(job.id, postId, videoId, videoTitle, videoUrl).catch((err) => {
      console.error(`[video-start] job ${job.id} failed:`, err);
    }),
  );

  return NextResponse.json({ jobId: job.id });
}
