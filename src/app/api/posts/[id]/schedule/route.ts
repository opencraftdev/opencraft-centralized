import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/posts";
import { schedulePost } from "@/lib/publisher";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const Schema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
});

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = await getPost(supabase, Number(id));
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!["accepted", "scheduled"].includes(post.status)) {
    return NextResponse.json({ error: `Post is in status '${post.status}' — must be accepted first` }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    const updated = await schedulePost(supabase, Number(id), parsed.data.scheduledAt);
    return NextResponse.json({ post: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
