import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPost, updatePost } from "@/lib/posts";
import { z } from "zod";

const Schema = z.object({
  postId: z.number().int().positive(),
  feedback: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { postId, feedback } = parsed.data;
  const post = await getPost(supabase, postId);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.type !== "engage") return NextResponse.json({ error: "Post is not type 'engage'" }, { status: 400 });

  try {
    const { generateEngageQuestion } = await import("@src/agent/engageWriter");
    const text = await generateEngageQuestion(feedback);
    await updatePost(supabase, postId, { textContent: text });
    return NextResponse.json({ text, postId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
