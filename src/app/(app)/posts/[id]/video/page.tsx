import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/posts";
import { VideoStepper } from "@/features/sosmed/components/VideoStepper";

type Props = { params: Promise<{ id: string }> };

export default async function VideoPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const post = await getPost(supabase, Number(id));
  if (!post) notFound();
  if (post.type !== "video") notFound();
  return <VideoStepper initialPost={post} />;
}
