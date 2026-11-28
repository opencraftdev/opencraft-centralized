import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSlug } from "@/features/tasks/slug";
import { GoToLogin } from "./GoToLogin";

export const dynamic = "force-dynamic";

// /t/<slug> — a task's share link. Public so WhatsApp can read the preview (task title, project, deadline);
// a signed-in teammate is sent straight to the task, anyone else to the login (and back here after it).

type Row = { id: string; title: string; updated_at: string; due_date: string | null; project_id: string | null; status: string };

async function findTask(slug: string) {
  try {
    const db = createAdminClient();
    const { data } = await db.from("tasks").select("id,title,updated_at,due_date,project_id,status");
    const t = resolveSlug(slug, (data ?? []) as Row[]);
    if (!t) return null;
    let project: string | null = null;
    if (t.project_id) {
      const { data: p } = await db.from("task_projects").select("name").eq("id", t.project_id).maybeSingle();
      project = (p?.name as string | undefined) ?? null;
    }
    return { ...t, project };
  } catch {
    return null;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await findTask(slug);
  const base = { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://internal.ocraft.id") };
  const image = { url: "/og-task.png", width: 600, height: 600, alt: "OpenCraft" };
  if (!t) return { ...base, title: "Task · OpenCraft", openGraph: { title: "Task · OpenCraft", images: [image] } };
  const due = t.due_date ? `Deadline ${Number(t.due_date.slice(8, 10))} ${MONTHS[Number(t.due_date.slice(5, 7)) - 1]}` : null;
  const description = [t.project, due, t.status === "done" ? "Selesai" : null].filter(Boolean).join(" · ") || "Task di OpenCraft";
  return {
    ...base,
    title: `${t.title} · OpenCraft`,
    description,
    openGraph: { title: t.title, description, siteName: "OpenCraft", type: "website", images: [image] },
    twitter: { card: "summary", title: t.title, description, images: [image.url] },
  };
}

export default async function TaskLink({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <GoToLogin next={`/t/${slug}`} />; // a page (not a redirect) so link previews still get the title
  const t = await findTask(slug);
  redirect(t ? `/tasks?task=${t.id}` : "/tasks");
}
