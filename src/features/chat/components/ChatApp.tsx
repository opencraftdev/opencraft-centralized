"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { ConfirmDialog, NameDialog } from "@/features/drive/components/DriveDialogs";
import { listEnabledSkills, type SkillSummary } from "@/features/skills/api";
import { listChats, renameChat, sendMessage, setChatPinned, trashChat } from "../api";
import type { ChatListItem } from "../types";
import { ChatList, type ChatAction } from "./ChatList";
import { NewChat } from "./NewChat";
import { Thread } from "./Thread";

// /chat (docs/CHAT.md → "UI"): the chat list on the left, the open chat (or a new one) on the right; on a narrow
// screen one at a time (list ↔ thread). URLs: /chat (new; the list on a phone, /chat?new=1 its new chat),
// /chat/<id>, /chat?skill=<name>. Moving between chats uses history.pushState (no server round trip).

const NARROW_PX = 720;
const LIST_POLL_MS = 5000;

function go(path: string, replace = false) {
  window.history[replace ? "replaceState" : "pushState"](null, "", path);
}

function useNarrow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < NARROW_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, narrow };
}

export function ChatApp({ initialChats, initialSkills }: { initialChats: ChatListItem[]; initialSkills: SkillSummary[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const chatId = pathname.startsWith("/chat/") ? decodeURIComponent(pathname.slice("/chat/".length).split("/")[0]) || null : null;
  const prefillSkill = chatId ? null : params.get("skill");
  const wantsNew = !chatId && (params.has("new") || Boolean(prefillSkill));

  const [chats, setChats] = useState(initialChats);
  const [skills, setSkills] = useState(initialSkills);
  const [now, setNow] = useState(() => Date.now());
  const [renaming, setRenaming] = useState<ChatListItem | null>(null);
  const [deleting, setDeleting] = useState<ChatListItem | null>(null);
  const { ref, narrow } = useNarrow<HTMLDivElement>();

  const refresh = useCallback(async () => {
    try {
      setChats(await listChats());
      setNow(Date.now());
    } catch {
      /* transient; the next poll retries */
    }
  }, []);

  // list every ~5 s while the tab is visible; skills again when the tab comes back (edited on /skills meanwhile)
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, LIST_POLL_MS);
    const onVisible = () => {
      if (document.hidden) return;
      void refresh();
      listEnabledSkills().then(setSkills, () => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  useEffect(() => {
    listEnabledSkills().then(setSkills, () => {});
  }, []);

  const listed = chatId ? chats.find((c) => c.id === chatId) ?? null : null;
  const isNarrow = narrow === true;
  // wide: nothing open = a new chat; narrow: nothing open = the list (unless ?new / ?skill)
  const showNew = !chatId && (!isNarrow || wantsNew);
  const showPane = Boolean(chatId) || showNew;
  const back = isNarrow ? () => go("/chat") : undefined;

  const create = async (text: string) => {
    try {
      const id = await sendMessage(null, text);
      go(`/chat/${id}`, Boolean(prefillSkill) || params.has("new"));
      void refresh();
      return true;
    } catch (e) {
      toastError((e as Error).message);
      return false;
    }
  };

  const onAction = (action: ChatAction, c: ChatListItem) => {
    if (action === "rename") setRenaming(c);
    else if (action === "delete") setDeleting(c);
    else
      void setChatPinned(c.id, !c.pinned)
        .then(() => toastSuccess(c.pinned ? "Sematan dilepas" : "Chat disematkan"))
        .catch((e: Error) => toastError(e.message))
        .finally(refresh);
  };

  return (
    <Box sx={{ height: "100%", display: "flex", px: { xs: 1, md: 2 }, pb: { xs: 1, md: 2 }, pt: 1, bgcolor: "#F0F4F9" }}>
      <Box
        ref={ref}
        sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", bgcolor: "#fff", borderRadius: "16px", overflow: "hidden" }}
      >
        {narrow !== null && (!isNarrow || !showPane) && (
          <Box sx={{ width: isNarrow ? "100%" : 300, flexShrink: 0, borderRight: isNarrow ? "none" : "1px solid #E0E3E7", minHeight: 0 }}>
            <ChatList
              chats={chats}
              activeId={chatId}
              newActive={showNew}
              now={now}
              onSelect={(id) => go(`/chat/${id}`)}
              onNew={() => go(isNarrow ? "/chat?new=1" : "/chat")}
              onAction={onAction}
            />
          </Box>
        )}
        {narrow !== null && showPane && (
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            {chatId ? (
              <Thread key={chatId} chatId={chatId} listed={listed} skills={skills} onBack={back} onChanged={refresh} onAction={onAction} />
            ) : (
              <NewChat skills={skills} prefillSkill={prefillSkill} onBack={back} onSend={create} />
            )}
          </Box>
        )}
      </Box>

      <NameDialog
        open={Boolean(renaming)}
        title="Ganti nama chat"
        initial={renaming?.title ?? ""}
        submitLabel="Simpan"
        onClose={() => setRenaming(null)}
        onSubmit={async (title) => {
          const c = renaming;
          if (c && title !== c.title) {
            try {
              await renameChat(c.id, title);
            } catch (e) {
              toastError((e as Error).message);
            }
            await refresh();
          }
          setRenaming(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus chat?"
        body={
          <>
            <b>{deleting?.title}</b> akan dihapus dari daftar chat. File yang pernah dilampirkan tetap ada di Document.
          </>
        }
        confirmLabel="Hapus"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const c = deleting;
          if (c) {
            try {
              await trashChat(c.id);
              toastSuccess("Chat dihapus");
              if (c.id === chatId) go("/chat", true);
            } catch (e) {
              toastError((e as Error).message);
            }
            await refresh();
          }
          setDeleting(null);
        }}
      />
    </Box>
  );
}
