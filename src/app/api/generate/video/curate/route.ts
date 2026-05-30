import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { curateVideos } = await import("@src/news/videoCurator");
    const { loadBrand } = await import("@src/brand/brandLoader");

    const brand = loadBrand();
    const result = await curateVideos(brand);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serialized = result.shortList.map((v: any) => ({
      videoId: v.video.videoId,
      url: v.video.url,
      channelTitle: v.video.channelTitle,
      channelHandle: v.channel?.handle ?? v.channel?.channelHandle ?? "",
      videoTitle: v.video.title,
      publishedAt: v.video.publishedAt,
      durationSec: v.video.durationSec,
      score: v.score,
    }));

    return NextResponse.json({ shortList: serialized });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
