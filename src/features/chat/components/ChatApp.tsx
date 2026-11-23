"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { ConfirmDialog, NameDialog } from "@/features/drive/components/DriveDialogs";
import { listEnabledSkills, type SkillSummary } from "@/features/skills/api";
import { listChats, renameChat, sendMessage, setChatPinned, trashChat } from "../api";
import type { ChatListItem } from "../types";
import { ChatList, type ChatAction } from "./ChatList";
import { NewChat } from "./NewChat";
import { Thread } from "./Thread";

// /chat (docs/CHAT.md → "UI"), laid out like Gemini's web chat (light): the chat list is a #F0F4F9 side column
// (collapsible) next to the open chat (or a new one) on a white card; on a narrow screen the list is a drawer.
// URLs: /chat (new), /chat/<id>, /chat?skill=<name> (?new=1 still works). Moving between chats uses
// history.pushState (no server round trip).

const NARROW_PX = 720;
const LIST_PX = 280;
const COLLAPSED_KEY = "chat:list-collapsed";
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

  const [chats, setChats] = useState(initialChats);
  const [skills, setSkills] = useState(initialSkills);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState<ChatListItem | null>(null);
  const [deleting, setDeleting] = useState<ChatListItem | null>(null);
  const { ref, narrow } = useNarrow<HTMLDivElement>();

  const refresh = useCallback(async () => {
    try {
      setChats(await listChats());
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
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
  }, []);
  const toggleCollapsed = (v: boolean) => {
    setCollapsed(v);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0");
    } catch {}
  };

  const listed = chatId ? chats.find((c) => c.id === chatId) ?? null : null;
  const isNarrow = narrow === true;
  const showNew = !chatId;
  const listShown = !isNarrow && !collapsed;
  // narrow: the list is a drawer; wide: a column that can be collapsed (remembered per browser)
  const openList = isNarrow ? () => setDrawer(true) : collapsed ? () => toggleCollapsed(false) : undefined;
  const newChat = () => {
    setDrawer(false);
    go("/chat");
  };

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

  const list = (inDrawer: boolean) => (
    <ChatList
      chats={chats}
      activeId={chatId}
      newActive={showNew}
      onSelect={(id) => {
        setDrawer(false);
        go(`/chat/${id}`);
      }}
      onNew={newChat}
      onAction={onAction}
      onCollapse={inDrawer ? () => setDrawer(false) : () => toggleCollapsed(true)}
      collapseLabel={inDrawer ? "Tutup daftar chat" : "Sembunyikan daftar chat"}
    />
  );

  return (
    <Box
      ref={ref}
      sx={{
        height: "100%",
        display: "flex",
        bgcolor: "#F0F4F9",
        pr: { xs: 1, md: 2 },
        pl: { xs: 1, md: listShown ? 0 : 2 },
        pb: { xs: 1, md: 2 },
        pt: 1,
      }}
    >
      {narrow !== null && listShown && <Box sx={{ width: LIST_PX, flexShrink: 0, minHeight: 0, mr: 1 }}>{list(false)}</Box>}
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, bgcolor: "#fff", borderRadius: "16px", overflow: "hidden" }}>
        {narrow !== null &&
          (chatId ? (
            <Thread
              key={chatId}
              chatId={chatId}
              listed={listed}
              skills={skills}
              onOpenList={openList}
              onNew={listShown ? undefined : newChat}
              onChanged={refresh}
              onAction={onAction}
            />
          ) : (
            <NewChat skills={skills} prefillSkill={prefillSkill} onOpenList={openList} onSend={create} />
          ))}
      </Box>
      {isNarrow && (
        <Drawer
          open={drawer}
          onClose={() => setDrawer(false)}
          sx={{ zIndex: (t) => t.zIndex.modal }} // above the app's top bar, like Gemini's mobile drawer
          slotProps={{ paper: { sx: { width: "min(320px, 86vw)", bgcolor: "#F0F4F9", borderRadius: "0 16px 16px 0" } } }}
        >
          {list(true)}
        </Drawer>
      )}

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
