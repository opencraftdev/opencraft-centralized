import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPost, updatePost, deletePost } from "@/lib/posts";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = await getPost(supabase, Number(id));
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
}

const PatchSchema = z.object({
  textContent: z.string().optional(),
  headline: z.string().optional(),
  userFeedback: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
}).strict();

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const post = await updatePost(supabase, Number(id), parsed.data);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const post = await getPost(supabase, Number(id));
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const zernioIds = (post.publishResults ?? [])
    .filter((r) => r.status === "ok" && r.uri.startsWith("zernio://"))
    .map((r) => r.uri.replace("zernio://", ""))
    .filter((zId) => zId && !zId.startsWith("dry-run"));

  if (zernioIds.length > 0 && process.env.ZERNIO_API_KEY) {
    const authHeader = `Bearer ${process.env.ZERNIO_API_KEY}`;
    await Promise.allSettled(
      zernioIds.map((zId) =>
        fetch(`https://zernio.com/api/v1/posts/${zId}`, { method: "DELETE", headers: { Authorization: authHeader } })
      )
    );
  }

  await deletePost(supabase, Number(id));
  return NextResponse.json({ ok: true });
}
