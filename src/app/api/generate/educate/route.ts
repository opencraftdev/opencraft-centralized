import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPost, updatePost } from "@/lib/posts";
import { z } from "zod";

const Schema = z.object({
  postId: z.number().int().positive(),
  source: z.enum(["claude", "github"]),
  feedback: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { postId, source, feedback } = parsed.data;
  const post = await getPost(supabase, postId);
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.type !== "educate") return NextResponse.json({ error: "Post is not type 'educate'" }, { status: 400 });

  try {
    const { generateEducateTip, fetchTrendingRepos } = await import("@src/agent/educateWriter");
    const { renderCodeCard } = await import("@src/video/codeCardRenderer");

    let cachedRepos;
    if (source === "github") cachedRepos = await fetchTrendingRepos();

    const text = await generateEducateTip(source, feedback, cachedRepos);

    let imagePath: string | null = null;
    const codeMatch = text.match(/```(\w*)\n([\s\S]*?)```/);
    if (codeMatch) {
      try {
        const card = await renderCodeCard({ code: codeMatch[2]!.trimEnd(), language: codeMatch[1] ?? "" });
        imagePath = card.filePath;
      } catch { /* non-fatal */ }
    }

    await updatePost(supabase, postId, { textContent: text, imagePath });
    return NextResponse.json({ text, imagePath, postId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
