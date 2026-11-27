"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import { toastError, toastInfo, toastSuccess } from "@/components/ui/Toast";
import { nameOf, useAccount, usePeople } from "@/features/accounts/account";
import { ConfirmDialog, NameDialog } from "@/features/drive/components/DriveDialogs";
import { listEnabledSkills, type SkillSummary } from "@/features/skills/api";
import { listChats, removeChatMember, renameChat, sendMessage, setChatPinned, subscribeChats, trashChat } from "../api";
import type { ChatListItem } from "../types";
import { ChatList, type ChatAction } from "./ChatList";
import { NewChat } from "./NewChat";
import { ShareDialog } from "./ShareDialog";
import { Thread } from "./Thread";

// /chat (docs/CHAT.md → "UI"): one white card. On a wide screen the chat list is a slim panel inside it, on the left
// (soft grey fading to white, collapsible; when collapsed, History/+ buttons bring it back); on a narrow screen
// the list is a drawer.
// URLs: /chat (new), /chat/<id>, /chat?skill=<name> (?new=1 still works). Moving between chats uses
// history.pushState (no server round trip).

const NARROW_PX = 720;
const LIST_PX = 248;
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
  const [sharing, setSharing] = useState<string | null>(null); // chat id
  const { email: myEmail } = useAccount();
  const people = usePeople();
  const { ref, narrow } = useNarrow<HTMLDivElement>();

  const refresh = useCallback(async () => {
    try {
      setChats(await listChats());
    } catch {
      /* transient; the next poll retries */
    }
  }, []);

  // live (Supabase realtime): someone shared a chat with me, wrote in a shared chat, renamed it… (debounced)
  const peopleRef = useRef(people);
  peopleRef.current = people;
  useEffect(() => {
    if (!myEmail) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void refresh(), 300);
    };
    const unsub = subscribeChats(myEmail, soon, async ({ chat_id, added_by }) => {
      const list = await listChats().catch(() => null);
      if (list) setChats(list);
      const c = list?.find((x) => x.id === chat_id);
      toastInfo(`${nameOf(added_by, peopleRef.current)} membagikan chat${c ? ` "${c.title}"` : ""} denganmu`);
    });
    return () => {
      if (t) clearTimeout(t);
      unsub();
    };
  }, [myEmail, refresh]);

  // list every ~5 s while the tab is visible (fallback when realtime drops); skills again when the tab comes back (edited on /skills meanwhile)
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
  const panelShown = !isNarrow && !collapsed;
  // narrow: the list is a drawer; wide: the panel (History/+ show only while it is collapsed)
  const openList = panelShown ? undefined : () => (isNarrow ? setDrawer(true) : toggleCollapsed(false));
  const closeList = () => setDrawer(false);
  const newChat = () => {
    closeList();
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
    else if (action === "share") setSharing(c.id);
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
        closeList();
        go(`/chat/${id}`);
      }}
      onNew={newChat}
      onAction={onAction}
      onCollapse={inDrawer ? closeList : () => toggleCollapsed(true)}
      collapseLabel={inDrawer ? "Tutup riwayat chat" : "Sembunyikan riwayat chat"}
    />
  );

  return (
    <Box
      ref={ref}
      sx={{
        height: "100%",
        display: "flex",
        bgcolor: "#F0F4F9",
        px: { xs: 1, md: 2 },
        pb: { xs: 1, md: 2 },
        pt: 1,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, bgcolor: "#fff", borderRadius: "16px", overflow: "hidden", display: "flex" }}>
        {narrow !== null && panelShown && (
          <Box sx={{ width: LIST_PX, flexShrink: 0, minHeight: 0, borderRight: "1px solid #F0F2F5", animation: "oc-rise 240ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
            {list(false)}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {narrow !== null &&
          (chatId ? (
            <Thread
              key={chatId}
              chatId={chatId}
              listed={listed}
              skills={skills}
              onOpenList={openList}
              onNew={newChat}
              onChanged={refresh}
              onAction={onAction}
              people={people}
            />
          ) : (
            <NewChat skills={skills} prefillSkill={prefillSkill} onOpenList={openList} onNew={newChat} onSend={create} />
          ))}
        </Box>
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
      <ShareDialog
        chat={sharing ? chats.find((c) => c.id === sharing) ?? null : null}
        people={people}
        onClose={() => setSharing(null)}
        onChanged={refresh}
        onLeft={(c) => {
          setSharing(null);
          if (c.id === chatId) go("/chat", true);
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={deleting && deleting.owner_email !== myEmail ? "Keluar dari chat?" : "Hapus chat?"}
        body={
          deleting && deleting.owner_email !== myEmail ? (
            <>
              <b>{deleting.title}</b> hilang dari daftarmu. Chat ini tetap ada untuk {nameOf(deleting.owner_email, people)} dan anggota lain.
            </>
          ) : (deleting?.chat_members?.length ?? 0) > 0 ? (
            <>
              <b>{deleting?.title}</b> akan dihapus untuk semua anggota chat ini. File yang pernah dilampirkan tetap ada di Document.
            </>
          ) : (
            <>
              <b>{deleting?.title}</b> akan dihapus dari daftar chat. File yang pernah dilampirkan tetap ada di Document.
            </>
          )
        }
        confirmLabel={deleting && deleting.owner_email !== myEmail ? "Keluar" : "Hapus"}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const c = deleting;
          if (c) {
            try {
              if (c.owner_email === myEmail) {
                await trashChat(c.id);
                toastSuccess("Chat dihapus");
              } else {
                await removeChatMember(c.id, myEmail);
                toastSuccess("Kamu keluar dari chat");
              }
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
