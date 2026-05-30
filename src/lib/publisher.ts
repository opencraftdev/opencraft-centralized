import type { SupabaseClient } from "@supabase/supabase-js";
import { getPost, updatePost } from "./posts";
import type { ContentPost, PublishResult } from "./types";

export async function publishPost(supabase: SupabaseClient, postId: number): Promise<ContentPost> {
  return _dispatch(supabase, postId, undefined);
}

export async function schedulePost(supabase: SupabaseClient, postId: number, scheduledAt: string): Promise<ContentPost> {
  return _dispatch(supabase, postId, scheduledAt);
}

async function _dispatch(supabase: SupabaseClient, postId: number, scheduledAt?: string): Promise<ContentPost> {
  const post = await getPost(supabase, postId);
  if (!post) throw new Error(`Post ${postId} not found`);
  if (!["accepted", "scheduled"].includes(post.status)) {
    throw new Error(`Post ${postId} is in status '${post.status}' — cannot publish`);
  }

  let results: PublishResult[] = [];
  try {
    if (post.type === "engage" || (post.type === "educate" && !post.imagePath)) {
      results = await publishTextPost(post, scheduledAt);
    } else if (post.type === "educate" && post.imagePath) {
      results = await publishImagePost(post, scheduledAt);
    } else if (post.type === "video") {
      results = await publishVideoPost(post, scheduledAt);
    }

    if (scheduledAt) {
      const allSkipped = results.length > 0 && results.every((r) => r.status === "skipped");
      await updatePost(supabase, postId, {
        status: allSkipped ? "failed" : "scheduled",
        scheduledAt: allSkipped ? null : scheduledAt,
        publishResults: results,
      });
    } else {
      const allFailed = results.length > 0 && results.every((r) => r.status === "failed");
      await updatePost(supabase, postId, {
        status: allFailed ? "failed" : "published",
        publishedAt: allFailed ? null : new Date().toISOString(),
        publishResults: results,
      });
    }
  } catch (err) {
    await updatePost(supabase, postId, {
      status: "failed",
      publishResults: [{ platform: "all", uri: "", status: "failed", error: String(err) }],
    });
    throw err;
  }

  return (await getPost(supabase, postId))!;
}

async function publishTextPost(post: ContentPost, scheduledAt?: string): Promise<PublishResult[]> {
  const { publishTextToThreads, publishTextToX } = await import("@src/platforms/zernio");
  const opts = { caption: post.textContent ?? "", hashtags: [] as string[], source: post.source ?? { videoUrl: "", channelTitle: "OpenCraft" }, scheduledAt };
  const [threads, x] = await Promise.all([publishTextToThreads(opts), publishTextToX(opts)]);
  return [
    { platform: "threads", uri: threads.uri, status: threads.status, error: threads.error },
    { platform: "x", uri: x.uri, status: x.status, error: x.error },
  ];
}

async function publishImagePost(post: ContentPost, scheduledAt?: string): Promise<PublishResult[]> {
  const { publishImageToThreads, publishImageToX } = await import("@src/platforms/zernio");
  const caption = (post.textContent ?? "").replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const opts = { imagePath: post.imagePath!, caption, hashtags: [] as string[], source: post.source ?? { videoUrl: "", channelTitle: "OpenCraft" }, scheduledAt };
  const [threads, x] = await Promise.all([publishImageToThreads(opts), publishImageToX(opts)]);
  return [
    { platform: "threads", uri: threads.uri, status: threads.status, error: threads.error },
    { platform: "x", uri: x.uri, status: x.status, error: x.error },
  ];
}

async function publishVideoPost(post: ContentPost, scheduledAt?: string): Promise<PublishResult[]> {
  const { publishVideoToInstagram, publishVideoToThreads, publishVideoToX, uploadMediaFile } = await import("@src/platforms/zernio");
  if (!post.videoPath) throw new Error(`Post ${post.id} has no video file`);

  const mediaUrl = await uploadMediaFile(post.videoPath);
  const base = { videoPath: post.videoPath, mediaUrl, source: post.source ?? { videoUrl: "", channelTitle: "OpenCraft" }, scheduledAt };
  const [ig, threads, x] = await Promise.all([
    publishVideoToInstagram({ ...base, caption: post.captions?.instagram ?? post.textContent ?? "", hashtags: post.hashtags?.instagram ?? [] }),
    publishVideoToThreads({ ...base, caption: post.captions?.threads ?? post.textContent ?? "", hashtags: post.hashtags?.threads ?? [] }),
    publishVideoToX({ ...base, caption: post.captions?.x ?? post.textContent ?? "", hashtags: post.hashtags?.x ?? [] }),
  ]);
  return [
    { platform: "instagram", uri: ig.uri, status: ig.status, error: ig.error },
    { platform: "threads", uri: threads.uri, status: threads.status, error: threads.error },
    { platform: "x", uri: x.uri, status: x.status, error: x.error },
  ];
}
