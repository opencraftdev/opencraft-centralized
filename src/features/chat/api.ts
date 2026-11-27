// Chat data access from the browser (docs/CHAT.md). Everything goes through the user's Supabase session
// (RLS: is_allowed_user()); sending uses the chat_send RPC, the worker does the rest.
import { createClient } from "@/lib/supabase/client";
import type { DriveFile } from "@/lib/drive/types";
import { LIST_COLUMNS, type Chat, type ChatListItem, type ChatMessage } from "./types";

const sb = () => createClient();

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const CHAT_COLUMNS = `${LIST_COLUMNS},consumed_at,run_steps,stream_text,started_at,cancel_requested_at,error_msg`;
const MESSAGE_COLUMNS = "id,chat_id,role,content,steps,duration_ms,stopped,error,attachments,author_email,created_at";

export async function listChats(): Promise<ChatListItem[]> {
  return check(
    await sb()
      .from("chats")
      .select(LIST_COLUMNS)
      .is("trashed_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(300),
  ) as ChatListItem[];
}

export async function fetchChat(id: string): Promise<Chat | null> {
  return check(
    await sb().from("chats").select(CHAT_COLUMNS).eq("id", id).is("trashed_at", null).maybeSingle(),
  ) as Chat | null;
}

/** The chat's messages, oldest first; `after` = only those created after it (cheap refresh while a run goes). */
export async function fetchMessages(chatId: string, after?: string | null): Promise<ChatMessage[]> {
  let q = sb().from("chat_messages").select(MESSAGE_COLUMNS).eq("chat_id", chatId);
  if (after) q = q.gt("created_at", after);
  return check(await q.order("created_at", { ascending: true }).limit(1000)) as ChatMessage[];
}

/** Sends a message (creates the chat when `chatId` is null). Returns the chat id. */
export async function sendMessage(chatId: string | null, content: string): Promise<string> {
  return check(await sb().rpc("chat_send", { p_chat_id: chatId, p_content: content })) as string;
}

/** Stop: flags the chat; the worker stops a running run within ~2 s. A chat that is still `queued` never reached the
 * worker, so the UI ends it itself (guarded by status='queued': a run the worker claimed meanwhile is left to it). */
export async function stopChat(chat: Chat) {
  const client = sb();
  check(await client.from("chats").update({ cancel_requested_at: new Date().toISOString() }).eq("id", chat.id));
  if (chat.status !== "queued") return;
  check(
    await client
      .from("chats")
      .update({ status: "idle", cancel_requested_at: null, run_steps: null, stream_text: null })
      .eq("id", chat.id)
      .eq("status", "queued"),
  );
}

/** "Kirim sekarang": messages still waiting (after a stop / failure) go to the agent. */
export async function sendPendingNow(chatId: string) {
  check(
    await sb()
      .from("chats")
      .update({ status: "queued", error_msg: null, cancel_requested_at: null, updated_at: new Date().toISOString() })
      .eq("id", chatId)
      .neq("status", "running"),
  );
}

/** "Coba lagi" after a failed answer: re-queue and resend the user messages of the failed run by moving consumed_at
 * back to the answer before them (null = from the start). */
export async function retryChat(chatId: string, consumedAt: string | null) {
  check(
    await sb()
      .from("chats")
      .update({
        status: "queued",
        consumed_at: consumedAt,
        error_msg: null,
        cancel_requested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId)
      .neq("status", "running"),
  );
}

export async function renameChat(id: string, title: string) {
  check(await sb().from("chats").update({ title }).eq("id", id));
}
export async function setChatPinned(id: string, pinned: boolean) {
  check(await sb().from("chats").update({ pinned }).eq("id", id));
}
export async function trashChat(id: string) {
  check(await sb().from("chats").update({ trashed_at: new Date().toISOString() }).eq("id", id));
}

/** The drive_files rows of a chat's attachments (file card + preview). */
export async function fetchFiles(ids: string[]): Promise<DriveFile[]> {
  if (!ids.length) return [];
  return check(await sb().from("drive_files").select("*").in("id", ids)) as DriveFile[];
}

// ── Sharing (docs/ACCOUNTS.md → "Shared chats"): added = in, nothing to accept ──

/** Adds people to a chat (anyone in the chat may). */
export async function addChatMembers(chatId: string, emails: string[]) {
  if (!emails.length) return;
  check(
    await sb()
      .from("chat_members")
      .upsert(emails.map((email) => ({ chat_id: chatId, email: email.toLowerCase() })), { onConflict: "chat_id,email", ignoreDuplicates: true }),
  );
}

/** Removes a person (the owner may remove anyone; a member may remove themselves = leave). */
export async function removeChatMember(chatId: string, email: string) {
  check(await sb().from("chat_members").delete().eq("chat_id", chatId).eq("email", email.toLowerCase()));
}

/** Live chat list: `onChange` on any visible change to chats / members / messages; `onShared` when someone adds
 * `myEmail` to a chat. Returns unsubscribe. */
export function subscribeChats(myEmail: string, onChange: () => void, onShared: (row: { chat_id: string; added_by: string | null }) => void) {
  const c = sb();
  const ch = c
    .channel(`chats-live-${myEmail}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_members" }, (p) => {
      onChange();
      const row = p.new as { chat_id?: string; email?: string; added_by?: string | null };
      if (p.eventType === "INSERT" && row.chat_id && row.email === myEmail && row.added_by !== myEmail)
        onShared({ chat_id: row.chat_id, added_by: row.added_by ?? null });
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, onChange)
    .subscribe();
  return () => {
    void c.removeChannel(ch);
  };
}
