import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { LIST_COLUMNS, type ChatListItem } from "@/features/chat/types";
import type { SkillSummary } from "@/features/skills/api";
import { ChatApp } from "@/features/chat/components/ChatApp";

export const dynamic = "force-dynamic";

// /chat and /chat/<id> (docs/CHAT.md → "UI"). One page for both, so moving between chats stays on the client
// (history.pushState); the list and skills are fetched here for the first paint, the client keeps them fresh.
export default async function ChatPage() {
  const supabase = await createClient();
  const [chats, skills] = await Promise.all([
    supabase
      .from("chats")
      .select(LIST_COLUMNS)
      .is("trashed_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase.from("skills").select("name,title,description").eq("enabled", true).order("title", { ascending: true }),
  ]);
  if (chats.error) throw chats.error;

  return (
    <Suspense>
      <ChatApp initialChats={(chats.data ?? []) as ChatListItem[]} initialSkills={(skills.data ?? []) as SkillSummary[]} />
    </Suspense>
  );
}
