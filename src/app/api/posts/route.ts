import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPost, listPosts } from "@/lib/posts";
import { z } from "zod";
import type { PostStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") as PostStatus | null;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);

  const posts = await listPosts(supabase, { status: status ?? undefined, limit, offset });
  return NextResponse.json({ posts });
}

const CreateSchema = z.object({
  type: z.enum(["engage", "educate", "video"]),
  dateSlot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const post = await createPost(supabase, parsed.data);
  return NextResponse.json({ post }, { status: 201 });
}
