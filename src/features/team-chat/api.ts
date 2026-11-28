// Team chat (docs: supabase/migrations/033_team_messages.sql): one-to-one messages between teammates.
import { createClient } from "@/lib/supabase/client";

export interface TeamMessage {
  id: string;
  thread: string;
  author_email: string;
  body: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

const sb = () => createClient();

/** The conversation key of two people. */
export const threadOf = (a: string, b: string) => [a.toLowerCase(), b.toLowerCase()].sort().join("|");
/** The other person of a thread. */
export const otherOf = (thread: string, me: string) => thread.split("|").find((e) => e !== me) ?? me;

/** Is the table there (migration 033 run)? */
export const isMissingTable = (msg: string) => /team_messages|relation .* does not exist|schema cache/i.test(msg);

/** My recent messages across all threads (newest first): enough for the people list. */
export async function listRecent(limit = 400): Promise<TeamMessage[]> {
  const { data, error } = await sb().from("team_messages").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMessage[];
}

export async function listThread(thread: string): Promise<TeamMessage[]> {
  const { data, error } = await sb().from("team_messages").select("*").eq("thread", thread).order("created_at").limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMessage[];
}

export async function sendMessage(thread: string, body: string): Promise<void> {
  const { error } = await sb().from("team_messages").insert({ thread, body });
  if (error) throw new Error(error.message);
}

export async function editMessage(id: string, body: string): Promise<void> {
  const { error } = await sb().from("team_messages").update({ body, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await sb().from("team_messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Marks the other person's messages in a thread as read. */
export async function markRead(thread: string, me: string): Promise<void> {
  await sb().from("team_messages").update({ read_at: new Date().toISOString() }).eq("thread", thread).neq("author_email", me).is("read_at", null);
}

export function subscribeTeamMessages(onChange: () => void): () => void {
  const c = sb();
  // a unique name per subscription: the panel and an open conversation both listen, and supabase-js reuses a
  // channel with the same name (adding a listener to an already-subscribed channel throws)
  const ch = c.channel(`team-messages-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "team_messages" }, onChange).subscribe();
  return () => {
    void c.removeChannel(ch);
  };
}
