import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/posts";
import { PostDetailShell } from "@/features/sosmed/components/PostDetailShell";

type Props = { params: Promise<{ id: string }> };

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const post = await getPost(supabase, Number(id));
  if (!post) notFound();
  return <PostDetailShell initialPost={post} />;
}
