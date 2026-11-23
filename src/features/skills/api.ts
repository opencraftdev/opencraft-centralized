// Skills (docs/CHAT.md → "Skills sync"): rows in `skills`, mirrored by the worker into the chat agent's
// .claude/skills/<name>/SKILL.md within ~30 s.
import { createClient } from "@/lib/supabase/client";

export interface Skill {
  id: string;
  name: string; // slug: folder name and "/name" in the chat
  title: string;
  description: string; // one sentence: when the AI uses it
  body: string; // SKILL.md Markdown
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** What the chat's "/" menu and suggestion chips need. */
export type SkillSummary = Pick<Skill, "name" | "title" | "description">;

export const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

const sb = () => createClient();

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === "23505") throw new Error("Nama skill sudah dipakai.");
    throw new Error(res.error.message);
  }
  return res.data;
}

export async function listSkills(): Promise<Skill[]> {
  return check(await sb().from("skills").select("*").order("title", { ascending: true })) as Skill[];
}

export async function listEnabledSkills(): Promise<SkillSummary[]> {
  return check(
    await sb().from("skills").select("name,title,description").eq("enabled", true).order("title", { ascending: true }),
  ) as SkillSummary[];
}

export async function createSkill(s: Pick<Skill, "name" | "title" | "description" | "body" | "enabled">, userId?: string) {
  check(await sb().from("skills").insert({ ...s, created_by: userId ?? null }));
}

export async function updateSkill(id: string, patch: Partial<Pick<Skill, "title" | "description" | "body" | "enabled">>) {
  check(await sb().from("skills").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id));
}

export async function deleteSkill(id: string) {
  check(await sb().from("skills").delete().eq("id", id));
}
