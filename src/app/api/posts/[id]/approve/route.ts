import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPost, updatePost } from "@/lib/posts";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = await getPost(supabase, Number(id));
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!["draft"].includes(post.status)) {
    return NextResponse.json({ error: `Cannot approve post in status '${post.status}'` }, { status: 409 });
  }

  const newStatus = post.scheduledAt ? "scheduled" : "accepted";
  const updated = await updatePost(supabase, Number(id), { status: newStatus });
  return NextResponse.json({ post: updated });
}
