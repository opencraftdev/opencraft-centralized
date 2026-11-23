import { createClient } from "@/lib/supabase/server";
import type { Skill } from "@/features/skills/api";
import { Skills } from "@/features/skills/components/Skills";

export const dynamic = "force-dynamic";

// Skills of the chat agent (docs/CHAT.md → "UI" → /skills).
export default async function SkillsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("skills").select("*").order("title", { ascending: true });
  if (error) throw error;
  return <Skills initialSkills={(data ?? []) as Skill[]} />;
}
