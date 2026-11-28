import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSlug } from "@/features/tasks/slug";
import { GoToLogin } from "./GoToLogin";

export const dynamic = "force-dynamic";

// /t/<slug> — a task's share link. Public so WhatsApp can read the preview (task title, project, deadline);
// a signed-in teammate is sent straight to the task, anyone else to the login (and back here after it).

type Row = { id: string; title: string; updated_at: string; due_date: string | null; project_id: string | null; status: string; description: string | null };

/** Stored brief/comment text → one plain line: no mention tokens, formatting tags, file blocks or reply markers. */
function plain(s: string): string {
  return s
    .replace(/^\[\[reply:[0-9a-f-]+\]\]\s*/, "")
    .replace(/@\[([^\]]+)\]\((?:member|task|project):[0-9a-f-]+\)/g, "@$1")
    .replace(/\[\[file:[0-9a-f-]{36}\]\]/g, " ")
    .replace(/\[(?:\/?(?:b|i|u|c)|c=#[0-9a-fA-F]{6})\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const clip = (s: string, n = 150) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

async function findTask(slug: string) {
  try {
    const db = createAdminClient();
    const { data } = await db.from("tasks").select("id,title,updated_at,due_date,project_id,status,description");
    const t = resolveSlug(slug, (data ?? []) as Row[]);
    if (!t) return null;
    let project: string | null = null;
    if (t.project_id) {
      const { data: p } = await db.from("task_projects").select("name").eq("id", t.project_id).maybeSingle();
      project = (p?.name as string | undefined) ?? null;
    }
    // preview text: the brief, or the latest comment when there is no brief
    let snippet = plain(t.description ?? "");
    if (!snippet) {
      const { data: c } = await db.from("task_comments").select("body").eq("task_id", t.id).order("created_at", { ascending: false }).limit(1);
      snippet = plain((c?.[0]?.body as string | undefined) ?? "");
      if (snippet === "Lampiran") snippet = "";
    }
    return { ...t, project, snippet: snippet ? clip(snippet) : "" };
  } catch {
    return null;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await findTask(slug);
  const base = { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://internal.ocraft.id") };
  const image = { url: "/og-task.png?v=2", width: 200, height: 200, alt: "OpenCraft" } // small → WhatsApp shows it as a side thumbnail;
  if (!t) return { ...base, title: "Task · OpenCraft", openGraph: { title: "Task · OpenCraft", images: [image] } };
  const due = t.due_date ? `Deadline ${Number(t.due_date.slice(8, 10))} ${MONTHS[Number(t.due_date.slice(5, 7)) - 1]}` : null;
  const meta = [t.project, due, t.status === "done" ? "Selesai" : null].filter(Boolean).join(" · ");
  const description = t.snippet || meta || "Task di OpenCraft";
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
