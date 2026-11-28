"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChatBubbleRounded from "@mui/icons-material/ChatBubbleRounded";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import PersonAddRounded from "@mui/icons-material/PersonAddRounded";
import { nameOf, personFor, useAccount } from "@/features/accounts/account";
import { MemberAvatar } from "@/features/tasks/components/bits";
import type { Member } from "@/features/tasks/types";
import type { DriveFile } from "@/lib/drive/types";
import { toastError } from "@/components/ui/Toast";
import { PreviewDialog } from "@/features/drive/components/PreviewDialog";
import type { SkillSummary } from "@/features/skills/api";
import { fetchChat, fetchFiles, fetchMessages, retryChat, sendMessage, sendPendingNow, stopChat } from "../api";
import { isRunning, participants, type Chat, type ChatListItem, type ChatMessage } from "../types";
import { Composer, type ComposerHandle } from "./Composer";
import { QuoteChip, SelectionReply, withQuote } from "./Quote";
import { AssistantMessage, LiveAnswer, PendingMessages, UserBubble } from "./Messages";
import { ChatMenu, ChatNavButtons, type ChatAction } from "./ChatList";
import { ChatTimButton } from "@/features/team-chat/TeamChat";

// One chat (docs/CHAT.md → "UI" → Thread). The chat row + new messages are polled every 1.5 s while a run is queued
// or running (the worker writes run_steps / stream_text at most every ~1.5 s); otherwise the list's poll (updated_at /
// status of this chat changing) triggers a reload.

const LIVE_POLL_MS = 1500;
export const COLUMN = 760;

/** Microseconds since the epoch from a Postgres/JS ISO timestamp (keeps Postgres' microseconds). */
export function micros(iso: string): number {
  const frac = /\.(\d+)/.exec(iso)?.[1] ?? "";
  const secs = Date.parse(iso.replace(/\.\d+/, ""));
  return secs * 1000 + Number((frac + "000000").slice(0, 6));
}

/** Messages in reading order. An answer is placed where its run started (created_at − duration), so a message sent
 * while that run went shows after the answer, before the answer it got. */
function readingOrder(list: ChatMessage[]): ChatMessage[] {
  const key = (m: ChatMessage) => micros(m.created_at) - (m.role === "assistant" ? (m.duration_ms ?? 0) * 1000 : 0);
  return [...list].sort((a, b) => key(a) - key(b));
}

function mergeMessages(prev: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  if (!next.length) return prev;
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of next) byId.set(m.id, m);
  return [...byId.values()];
}

export function Thread({
  chatId,
  listed,
  skills,
  onOpenList,
  onNew,
  onChanged,
  onAction,
  people,
}: {
  chatId: string;
  listed: ChatListItem | null; // this chat's row in the (polled) list
  skills: SkillSummary[];
  onOpenList?: () => void; // the list is hidden (collapsed panel, or a phone's drawer): show History/+ buttons
  onNew: () => void;
  onChanged: () => void; // refresh the list
  onAction: (action: ChatAction, chat: ChatListItem) => void;
  people: Member[]; // team members with a login (names + photos)
}) {
  const { email: myEmail } = useAccount();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [files, setFiles] = useState<Map<string, DriveFile>>(new Map());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const composer = useRef<ComposerHandle>(null);
  const pinned = useRef(true);
  const lastAt = useRef<string | null>(null);

  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  /** full = all messages again; otherwise only the ones after the newest we have. */
  const reload = useCallback(
    async (full = false) => {
      try {
        const [row, msgs] = await Promise.all([fetchChat(chatId), fetchMessages(chatId, full ? null : lastAt.current)]);
        if (!row) {
          setState("missing");
          return null;
        }
        setChat(row);
        setMessages((prev) => (full ? msgs : mergeMessages(prev, msgs)));
        if (msgs.length) {
          const newest = msgs.reduce((a, m) => (micros(m.created_at) > micros(a) ? m.created_at : a), msgs[0].created_at);
          if (full || !lastAt.current || micros(newest) > micros(lastAt.current)) lastAt.current = newest;
        }
        setState("ready");
        return row;
      } catch {
        return null; // transient; the next tick / reload retries
      }
    },
    [chatId],
  );

  useEffect(() => {
    lastAt.current = null;
    pinned.current = true;
    void reload(true);
  }, [reload]);

  const running = chat ? isRunning(chat) : false;

  // live poll while a run is queued / running
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const row = await reload();
      if (alive && row && !isRunning(row)) {
        await reload(true); // run ended: settle the whole thread once
        onChangedRef.current();
      }
    }, LIVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [running, reload]);
  useEffect(() => {
    if (!running) setStopping(false);
  }, [running]);

  // the list saw this chat change (another tab, the worker): reload
  useEffect(() => {
    if (!listed || !chat || running) return;
    if (listed.updated_at !== chat.updated_at || listed.status !== chat.status) void reload(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listed?.updated_at, listed?.status]);

  // attached files → their drive_files rows (card + preview)
  const attIds = useMemo(
    () => [...new Set(messages.flatMap((m) => (m.attachments ?? []).map((a) => a.file_id)))].sort().join(","),
    [messages],
  );
  const loadFiles = useCallback(async () => {
    const ids = attIds ? attIds.split(",") : [];
    if (!ids.length) return;
    try {
      const rows = await fetchFiles(ids);
      setFiles(new Map(rows.map((f) => [f.id, f])));
    } catch {
      /* cards show "Memuat…" until the next try */
    }
  }, [attIds]);
  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  // ── derived ──
  const ordered = useMemo(() => readingOrder(messages), [messages]);
  const { shown, pending } = useMemo(() => {
    if (!chat || chat.status === "queued") return { shown: ordered, pending: [] as ChatMessage[] };
    const since = chat.consumed_at ? micros(chat.consumed_at) : -Infinity;
    const isPending = (m: ChatMessage) => m.role === "user" && micros(m.created_at) > since;
    return { shown: ordered.filter((m) => !isPending(m)), pending: ordered.filter(isPending) };
  }, [ordered, chat]);

  // "Coba lagi": the newest answer failed → resend the user messages before it (back to the answer before them)
  const retryInfo = useMemo(() => {
    if (chat?.status !== "failed") return null;
    let i = shown.length - 1;
    while (i >= 0 && shown[i].role !== "assistant") i--;
    if (i < 0 || !shown[i].error) return null;
    const failedId = shown[i].id;
    let j = i - 1;
    while (j >= 0 && shown[j].role === "user") j--;
    return { failedId, consumedAt: j >= 0 ? shown[j].created_at : null };
  }, [chat?.status, shown]);

  // ── actions ──
  const after = async () => {
    pinned.current = true;
    await reload();
    onChangedRef.current();
  };
  const [quote, setQuote] = useState<string | null>(null);
  const send = async (text: string) => {
    try {
      await sendMessage(chatId, withQuote(text, quote));
      setQuote(null);
      await after();
      return true;
    } catch (e) {
      toastError((e as Error).message);
      return false;
    }
  };
  const stop = async () => {
    if (!chat) return;
    setStopping(true);
    try {
      await stopChat(chat);
      await after();
    } catch (e) {
      setStopping(false);
      toastError((e as Error).message);
    }
  };
  const sendNow = async () => {
    setSending(true);
    try {
      await sendPendingNow(chatId);
      await after();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSending(false);
    }
  };
  const retry = async () => {
    if (!retryInfo) return;
    try {
      await retryChat(chatId, retryInfo.consumedAt);
      await after();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  // ── scroll: stay at the bottom while pinned ──
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [state, messages.length, chat?.status, chat?.stream_text, chat?.run_steps?.length, pending.length]);

  const title = listed?.title ?? chat?.title ?? "";
  const row = listed ?? chat;
  const inChat = row ? participants(row) : [];
  const shared = inChat.length > 1;
  const author = (m: ChatMessage) =>
    shared && m.author_email
      ? { name: m.author_email === myEmail ? "Kamu" : nameOf(m.author_email, people), member: personFor(m.author_email, people) }
      : undefined;
  const previewFile = previewId ? files.get(previewId) ?? null : null;
  // ‹ › in the preview go through every file of this chat, in message order
  const previewSet = [...new Set(messages.flatMap((m) => (m.attachments ?? []).map((a) => a.file_id)))]
    .map((id) => files.get(id))
    .filter((f): f is DriveFile => Boolean(f));

  return (
    <Box sx={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {onOpenList && <ChatNavButtons onHistory={onOpenList} onNew={onNew} />}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: { xs: onOpenList ? 1 : 2, sm: onOpenList ? 7 : 2.5 }, pr: 1, minHeight: 56, flexShrink: 0 }}>
        {onOpenList && <ChatNavButtons inline onHistory={onOpenList} onNew={onNew} />}
        <Typography
          component="h1"
          sx={{ flex: 1, minWidth: 0, pl: 1, fontSize: "1rem", fontWeight: 400, color: "#1F1F1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {state === "loading" && !title ? "Memuat…" : title || "Chat baru"}
        </Typography>
        {chat?.status === "failed" && (
          <Box component="span" sx={{ px: 1, height: 22, display: "inline-flex", alignItems: "center", borderRadius: "9999px", bgcolor: "#FCE8E6", color: "#B3261E", fontSize: "0.75rem", fontWeight: 500, flexShrink: 0 }}>
            Gagal
          </Box>
        )}
        {running && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: "#0B57D0", flexShrink: 0, px: 0.5 }}>
            <CircularProgress size={12} thickness={5} sx={{ color: "#0B57D0" }} />
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, display: { xs: "none", sm: "block" } }}>
              {chat?.status === "queued" ? "Menunggu giliran" : "Sedang menjawab"}
            </Typography>
          </Box>
        )}
        {row && (
          <Tooltip title={shared ? `Dibagikan: ${inChat.map((e) => nameOf(e, people)).join(", ")}` : "Bagikan chat"}>
            <Box
              component="button"
              type="button"
              aria-label="Bagikan chat"
              onClick={() => onAction("share", row)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                height: 36,
                pl: shared ? 0.75 : 1,
                pr: 1.25,
                mr: 0.5,
                border: "1px solid #C4C7C5",
                borderRadius: "9999px",
                bgcolor: "#fff",
                color: "#0B57D0",
                fontFamily: "inherit",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: "pointer",
                flexShrink: 0,
                "&:hover": { bgcolor: "#F6FAFE" },
                "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 2 },
              }}
            >
              {shared ? (
                <Box sx={{ display: "inline-flex", "& > *:not(:first-of-type)": { ml: "-6px" } }}>
                  {inChat.slice(0, 4).map((e) => (
                    <MemberAvatar key={e} member={personFor(e, people)} size={24} ring="#fff" />
                  ))}
                </Box>
              ) : (
                <PersonAddRounded sx={{ fontSize: 18 }} />
              )}
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Bagikan
              </Box>
            </Box>
          </Tooltip>
        )}
        {(listed || chat) && (
          <IconButton aria-label="Menu chat" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: "#444746" }}>
            <MoreVertRounded />
          </IconButton>
        )}
      </Box>

      <Box
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, sm: 3 }, pt: 2, pb: 4 }}
      >
        {state === "loading" ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        ) : state === "missing" ? (
          <Box sx={{ textAlign: "center", color: "#5F6368", py: 8 }}>
            <ChatBubbleRounded sx={{ fontSize: 40, color: "#C4C7C5", mb: 1 }} />
            <Typography sx={{ fontSize: "0.9375rem" }}>Chat tidak ditemukan atau sudah dihapus.</Typography>
            {onNew && (
              <Button onClick={onNew} sx={{ mt: 1.5, borderRadius: "9999px" }}>
                Chat baru
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ maxWidth: COLUMN, mx: "auto", display: "flex", flexDirection: "column", gap: 2.5 }}>
            {shown.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} m={m} skills={skills} author={author(m)} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  m={m}
                  files={files}
                  onPreview={setPreviewId}
                  onRetry={retryInfo?.failedId === m.id ? () => void retry() : undefined}
                />
              ),
            )}
            {chat && running && <LiveAnswer chat={chat} />}
            {chat?.status === "failed" && !retryInfo && chat.error_msg && (
              <Typography sx={{ fontSize: "0.875rem", color: "#B3261E" }}>{chat.error_msg}</Typography>
            )}
            <PendingMessages items={pending} running={running} skills={skills} sending={sending} onSendNow={() => void sendNow()} />
          </Box>
        )}
      </Box>

      <SelectionReply
        scope={scroller}
        onReply={(t) => {
          setQuote(t);
          composer.current?.focus();
        }}
      />

      {state !== "missing" && (
        <Box sx={{ px: { xs: 1, sm: 3 }, pb: 1, pt: 0.5, flexShrink: 0 }}>
          <Box sx={{ maxWidth: COLUMN, mx: "auto" }}>
            {quote && <QuoteChip text={quote} onClear={() => setQuote(null)} />}
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Composer
                  ref={composer}
                  draftId={chatId}
                  skills={skills}
                  placeholder="Tanya OpenCraft"
                  running={running}
                  stopping={stopping || Boolean(chat?.cancel_requested_at)}
                  onSend={send}
                  onStop={() => void stop()}
                />
              </Box>
              <ChatTimButton inline />
            </Box>
            <Typography sx={{ textAlign: "center", fontSize: "0.75rem", color: "#444746", mt: 1, lineHeight: 1.5 }}>
              AI bisa membuat kesalahan, periksa kembali hasilnya.
            </Typography>
          </Box>
        </Box>
      )}

      <ChatMenu
        anchor={menuAnchor}
        chat={listed ?? chat}
        onClose={() => setMenuAnchor(null)}
        onAction={onAction}
      />
      <PreviewDialog
        file={previewFile}
        files={previewSet}
        onNavigate={(f) => setPreviewId(f.id)}
        onClose={() => setPreviewId(null)}
        onChanged={() => void loadFiles()}
      />
    </Box>
  );
}
