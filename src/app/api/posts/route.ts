import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPosts } from "@/lib/posts";
import { createPost } from "@/lib/sosmed/posts";
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

const createSchema = z.object({
  type: z.enum(["engage", "educate", "video"]),
  dateSlot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const post = await createPost(admin, { userId: user.id, type: parsed.data.type, dateSlot: parsed.data.dateSlot });
  return NextResponse.json({ post }, { status: 201 });
}
