"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import DriveFileRenameOutlineRounded from "@mui/icons-material/DriveFileRenameOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import PushPinRounded from "@mui/icons-material/PushPinRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import LayersRounded from "@mui/icons-material/LayersRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import CreateNewFolderRounded from "@mui/icons-material/CreateNewFolderRounded";
import DriveFileMoveRounded from "@mui/icons-material/DriveFileMoveRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import Collapse from "@mui/material/Collapse";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import ViewSidebarRounded from "@mui/icons-material/ViewSidebarRounded";
import GroupRounded from "@mui/icons-material/GroupRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PersonAddRounded from "@mui/icons-material/PersonAddRounded";
import { useAccount } from "@/features/accounts/account";
import { participants, type ChatListItem, type ChatStatus } from "../types";
import type { ChatGroup } from "../api";

// Left pane of /chat (docs/CHAT.md → "UI"), styled like Gemini's sidebar (light): "Chat baru" row, search toggle,
// "Terbaru" with single-line titles as pills; pinned first, then newest; ⋮ row menu.

export type ChatAction = "rename" | "pin" | "share" | "delete";

/** Ganti nama / Sematkan / Bagikan / Hapus (owner) or Keluar (member) — the row menu and the thread header's menu. */
export function ChatMenu({
  anchor,
  chat,
  onClose,
  onAction,
  groups,
  groupId,
  onMove,
  onNewGroup,
}: {
  anchor: HTMLElement | null;
  chat: ChatListItem | null;
  onClose: () => void;
  onAction: (action: ChatAction, chat: ChatListItem) => void;
  /** With these: a "Pindahkan ke grup" item (groups: the caller's folders; groupId: where this chat is now). */
  groups?: ChatGroup[] | null;
  groupId?: string | null;
  onMove?: (chat: ChatListItem, groupId: string | null) => void;
  onNewGroup?: (chat: ChatListItem) => void;
}) {
  const { email } = useAccount();
  const [moveMenu, setMoveMenu] = useState<{ anchor: HTMLElement; chat: ChatListItem } | null>(null);
  const moveTo = (g: string | null) => {
    const c = moveMenu?.chat;
    setMoveMenu(null);
    if (c && onMove) onMove(c, g);
  };
  const owner = !chat || chat.owner_email === email;
  const act = (a: ChatAction) => {
    onClose();
    if (chat) onAction(a, chat);
  };
  return (
    <>
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor && chat)}
      onClose={onClose}
      slotProps={{
        paper: { sx: { minWidth: 200, borderRadius: "16px", py: 0.5, boxShadow: "0 1px 3px rgba(0,0,0,.15), 0 4px 8px 3px rgba(0,0,0,.08)" } },
      }}
    >
      <MenuItem onClick={() => act("rename")}>
        <ListItemIcon>
          <DriveFileRenameOutlineRounded fontSize="small" />
        </ListItemIcon>
        <ListItemText>Ganti nama</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => act("pin")}>
        <ListItemIcon>{chat?.pinned ? <PushPinRounded fontSize="small" /> : <PushPinRounded fontSize="small" />}</ListItemIcon>
        <ListItemText>{chat?.pinned ? "Lepas sematan" : "Sematkan"}</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => act("share")}>
        <ListItemIcon>
          <PersonAddRounded fontSize="small" />
        </ListItemIcon>
        <ListItemText>Bagikan</ListItemText>
      </MenuItem>
      {groups && onMove && (
        <MenuItem
          onClick={() => {
            if (anchor && chat) setMoveMenu({ anchor, chat });
            onClose();
          }}
        >
          <ListItemIcon>
            <DriveFileMoveRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Pindahkan ke grup</ListItemText>
        </MenuItem>
      )}
      <Divider />
      <MenuItem onClick={() => act("delete")} sx={{ color: "#B3261E" }}>
        <ListItemIcon>
          {owner ? <DeleteRounded fontSize="small" sx={{ color: "#B3261E" }} /> : <LogoutRounded fontSize="small" sx={{ color: "#B3261E" }} />}
        </ListItemIcon>
        <ListItemText>{owner ? "Hapus" : "Keluar dari chat"}</ListItemText>
      </MenuItem>
    </Menu>
    <Menu
      anchorEl={moveMenu?.anchor ?? null}
      open={Boolean(moveMenu)}
      onClose={() => setMoveMenu(null)}
      slotProps={{ paper: { sx: { minWidth: 220, maxWidth: 300, borderRadius: "16px", py: 0.5, boxShadow: "0 1px 3px rgba(0,0,0,.15), 0 4px 8px 3px rgba(0,0,0,.08)" } } }}
    >
      <Typography sx={{ px: 2, pt: 0.75, pb: 0.5, fontSize: "0.75rem", fontWeight: 500, color: "#5F6368" }}>Pindahkan ke grup</Typography>
      {(groups ?? []).map((g) => (
        <MenuItem key={g.id} onClick={() => moveTo(g.id)} selected={groupId === g.id}>
          <ListItemIcon>
            <LayersRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText slotProps={{ primary: { noWrap: true } }}>{g.name}</ListItemText>
          {groupId === g.id && <CheckRounded fontSize="small" sx={{ ml: 1, color: "#0B57D0" }} />}
        </MenuItem>
      ))}
      {groupId && (
        <MenuItem onClick={() => moveTo(null)}>
          <ListItemIcon>
            <CloseRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Keluarkan dari grup</ListItemText>
        </MenuItem>
      )}
      <Divider />
      <MenuItem
        onClick={() => {
          const c = moveMenu?.chat;
          setMoveMenu(null);
          if (c && onNewGroup) onNewGroup(c);
        }}
      >
        <ListItemIcon>
          <CreateNewFolderRounded fontSize="small" />
        </ListItemIcon>
        <ListItemText>Grup baru…</ListItemText>
      </MenuItem>
    </Menu>
    </>
  );
}

export function StatusDot({ status }: { status: ChatStatus }) {
  if (status === "idle") return null;
  const failed = status === "failed";
  return (
    <Box
      component="span"
      role="img"
      aria-label={failed ? "Gagal" : status === "queued" ? "Menunggu giliran" : "Sedang menjawab"}
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: failed ? "#B3261E" : "#0B57D0",
        ...(failed
          ? {}
          : {
              animation: "chatPulse 1.4s ease-in-out infinite",
              "@keyframes chatPulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }),
      }}
    />
  );
}

/** Gemini's "toggle sidebar" glyph: a panel with a bar on the left. */
export function SidebarIcon() {
  return <ViewSidebarRounded sx={{ fontSize: 22, transform: "scaleX(-1)" }} />;
}

/**
 * Riwayat chat (opens the list) above Chat baru (+), labelled on hover. From sm up they stand in a column at the
 * chat card's top left; on a phone they sit in the header row (`inline`).
 */
export function ChatNavButtons({
  onHistory,
  onNew,
  historyOpen,
  inline,
}: {
  onHistory: (anchor: HTMLElement) => void;
  onNew: () => void;
  historyOpen?: boolean;
  inline?: boolean;
}) {
  const tip = inline ? "bottom" : "right";
  return (
    <Box
      sx={
        inline
          ? { display: { xs: "flex", sm: "none" }, alignItems: "center", gap: 0.5 }
          : { display: { xs: "none", sm: "flex" }, flexDirection: "column", gap: 0.5, position: "absolute", top: 8, left: 8, zIndex: 2 }
      }
    >
      <Tooltip title="Riwayat chat" placement={tip}>
        <IconButton
          aria-label="Riwayat chat"
          aria-haspopup="dialog"
          aria-expanded={historyOpen}
          onClick={(e) => onHistory(e.currentTarget)}
          sx={{ ...iconBtn, ...(historyOpen ? { bgcolor: "#D3E3FD", color: "#041E49", "&:hover": { bgcolor: "#D3E3FD" } } : {}) }}
        >
          <HistoryRounded sx={{ fontSize: 22 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Chat baru" placement={tip}>
        <IconButton aria-label="Chat baru" onClick={onNew} sx={iconBtn}>
          <AddRounded sx={{ fontSize: 24 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

const CLOSED_GROUPS_KEY = "chat:groups-closed";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ px: 1.5, pt: 1, pb: 0.75, fontSize: "0.875rem", fontWeight: 500, color: "#444746" }}>{children}</Typography>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: "0.8125rem", color: "#5E5E5E", px: 1.5, py: 1 }}>{children}</Typography>;
}

const iconBtn = { color: "#444746", width: 40, height: 40, "&:hover": { bgcolor: "rgba(68,71,70,0.08)" } } as const;

export function ChatList({
  chats,
  activeId,
  newActive,
  onSelect,
  onNew,
  onAction,
  onCollapse,
  collapseLabel,
  popover,
  groups = null,
  placement = {},
  onMove,
  onGroupAction,
}: {
  chats: ChatListItem[];
  activeId: string | null;
  newActive: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onAction: (action: ChatAction, chat: ChatListItem) => void;
  onCollapse?: () => void;
  collapseLabel?: string;
  /** Shown in the "Riwayat chat" popover: white, search open, no "Chat baru" row (the header has a + button). */
  popover?: boolean;
  /** The caller's chat groups (null: not available, e.g. migration 030 not run) and chat id → group id. */
  groups?: ChatGroup[] | null;
  placement?: Record<string, string>;
  onMove?: (chat: ChatListItem, groupId: string | null) => void;
  /** "new" (optionally moving `chat` into it), "rename", "delete". */
  onGroupAction?: (action: "new" | "rename" | "delete", group: ChatGroup | null, chat?: ChatListItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(Boolean(popover));
  const [menu, setMenu] = useState<{ anchor: HTMLElement; chat: ChatListItem } | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [groupMenu, setGroupMenu] = useState<{ anchor: HTMLElement; group: ChatGroup } | null>(null);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  useEffect(() => {
    try {
      setClosedGroups(JSON.parse(window.localStorage.getItem(CLOSED_GROUPS_KEY) ?? "[]"));
    } catch {}
  }, []);
  const toggleGroup = (id: string) =>
    setClosedGroups((l) => {
      const next = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
      try {
        window.localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  const grouping = groups !== null && Boolean(onMove);
  const known = new Set((groups ?? []).map((g) => g.id));
  const loose = chats.filter((c) => !grouping || !known.has(placement[c.id]));
  const searchingNow = Boolean(query.trim());
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  }, [chats, query]);

  const toggleSearch = () => {
    if (searching) {
      setSearching(false);
      setQuery("");
    } else {
      setSearching(true);
      requestAnimationFrame(() => searchInput.current?.focus());
    }
  };

  const renderRow = (c: ChatListItem) => {
        const active = c.id === activeId;
        const menuOn = menu?.chat.id === c.id;
        return (
          <Box
            key={c.id}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ anchor: e.currentTarget as HTMLElement, chat: c });
            }}
            sx={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              height: 40,
              borderRadius: "9999px",
              bgcolor: active ? "#D3E3FD" : menuOn ? "rgba(68,71,70,0.08)" : "transparent",
              "&:hover": { bgcolor: active ? "#D3E3FD" : "rgba(68,71,70,0.08)" },
              "& .row-more": { display: { xs: "inline-flex", md: active || menuOn ? "inline-flex" : "none" } },
              "&:hover .row-more, &:focus-within .row-more": { display: "inline-flex" },
              "&:hover .row-dot, &:focus-within .row-dot": { display: { md: "none" } },
            }}
          >
            <Box
              component="button"
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(c.id)}
              onDoubleClick={() => onAction("rename", c)}
              title={c.title}
              sx={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: 1,
                pl: 1.5,
                pr: 1,
                border: "none",
                bgcolor: "transparent",
                fontFamily: "inherit",
                textAlign: "left",
                cursor: "pointer",
                borderRadius: "9999px",
                "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
              }}
            >
              {c.pinned && <PushPinRounded aria-label="Disematkan" sx={{ fontSize: 14, color: active ? "#041E49" : "#444746", flexShrink: 0, transform: "rotate(45deg)" }} />}
              <Typography
                component="span"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: "0.875rem",
                  fontWeight: active ? 500 : 400,
                  color: active ? "#041E49" : "#1F1F1F",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.title || "Chat baru"}
              </Typography>
              {participants(c).length > 1 && (
                <Tooltip title={`Dibagikan · ${participants(c).length} orang`}>
                  <GroupRounded aria-label="Chat bersama" sx={{ fontSize: 16, color: active ? "#041E49" : "#5E5E5E", flexShrink: 0 }} />
                </Tooltip>
              )}
              <Box className="row-dot" component="span" sx={{ display: "inline-flex", pr: 0.75 }}>
                <StatusDot status={c.status} />
              </Box>
            </Box>
            <IconButton
              className="row-more"
              size="small"
              aria-label={`Menu ${c.title}`}
              aria-haspopup="menu"
              onClick={(e) => setMenu({ anchor: e.currentTarget, chat: c })}
              sx={{ mr: 0.5, width: 32, height: 32, color: active ? "#041E49" : "#444746", flexShrink: 0 }}
            >
              <MoreVertRounded sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, bgcolor: popover ? "#fff" : "#F0F4F9" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 2, pr: 1, pt: 1, pb: popover ? 0.5 : 1, minHeight: popover ? 48 : 56 }}>
        <Typography component="h2" sx={{ flex: 1, fontSize: popover ? "1rem" : "1.25rem", fontWeight: popover ? 500 : 400, color: "#1F1F1F", letterSpacing: 0 }}>
          {popover ? "Riwayat chat" : "Chat"}
        </Typography>
        {groups !== null && onGroupAction && (
          <Tooltip title="Grup baru">
            <IconButton aria-label="Grup baru" onClick={() => onGroupAction("new", null)} sx={iconBtn}>
              <CreateNewFolderRounded sx={{ fontSize: 21 }} />
            </IconButton>
          </Tooltip>
        )}
        {!popover && (
        <Tooltip title="Cari chat">
          <IconButton aria-label="Cari chat" aria-pressed={searching} onClick={toggleSearch} sx={iconBtn}>
            <SearchRounded sx={{ fontSize: 22 }} />
          </IconButton>
        </Tooltip>
        )}
        {onCollapse && (
          <Tooltip title={collapseLabel ?? "Sembunyikan"}>
            <IconButton aria-label={collapseLabel ?? "Sembunyikan"} onClick={onCollapse} sx={iconBtn}>
              {popover ? <CloseRounded sx={{ fontSize: 22 }} /> : <SidebarIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {searching && (
        <Box sx={{ px: 1, pb: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              height: 44,
              pl: 1.75,
              pr: 0.5,
              borderRadius: "9999px",
              bgcolor: popover ? "#F0F4F9" : "#fff",
              "&:focus-within": { boxShadow: "inset 0 0 0 1px #0B57D0" },
            }}
          >
            <SearchRounded sx={{ fontSize: 20, color: "#444746" }} />
            <InputBase
              inputRef={searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") toggleSearch();
              }}
              placeholder="Cari chat"
              inputProps={{ "aria-label": "Cari chat" }}
              sx={{ flex: 1, fontSize: "0.875rem", color: "#1F1F1F" }}
            />
            {!popover && (
              <IconButton size="small" aria-label="Tutup pencarian" onClick={toggleSearch} sx={{ color: "#444746" }}>
                <CloseRounded sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        </Box>
      )}

      <Box sx={{ px: 1, display: popover ? "none" : "block" }}>
        <Box
          component="button"
          type="button"
          onClick={onNew}
          aria-current={newActive ? "page" : undefined}
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            height: 44,
            px: 1.5,
            border: "none",
            borderRadius: "9999px",
            bgcolor: newActive ? "#D3E3FD" : "transparent",
            color: newActive ? "#041E49" : "#1F1F1F",
            fontFamily: "inherit",
            fontSize: "0.875rem",
            fontWeight: 500,
            textAlign: "left",
            cursor: "pointer",
            "&:hover": { bgcolor: newActive ? "#D3E3FD" : "rgba(68,71,70,0.08)" },
            "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
          }}
        >
          <EditRounded sx={{ fontSize: 20, color: newActive ? "#041E49" : "#444746" }} />
          Chat baru
        </Box>
      </Box>

      <Box component="nav" aria-label="Daftar chat" sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1, pb: 1.5, pt: popover ? 0.5 : 1.5 }}>
        {searchingNow ? (
          <>
            <SectionTitle>Hasil pencarian</SectionTitle>
            {shown.length === 0 ? <Empty>Tidak ada chat yang cocok.</Empty> : shown.map(renderRow)}
          </>
        ) : (
          <>
            {grouping && (groups?.length ?? 0) > 0 && (
              <Box sx={{ mb: 1 }}>
                {groups!.map((g) => {
                  const items = chats.filter((c) => placement[c.id] === g.id);
                  const isOpen = !closedGroups.includes(g.id);
                  return (
                    <Box key={g.id}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          height: 40,
                          borderRadius: "9999px",
                          "&:hover": { bgcolor: "rgba(68,71,70,0.08)" },
                          "& .row-more": { display: { xs: "inline-flex", md: groupMenu?.group.id === g.id ? "inline-flex" : "none" } },
                          "&:hover .row-more, &:focus-within .row-more": { display: "inline-flex" },
                        }}
                      >
                        <Box
                          component="button"
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => toggleGroup(g.id)}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                            pl: 1.5,
                            border: "none",
                            bgcolor: "transparent",
                            fontFamily: "inherit",
                            textAlign: "left",
                            cursor: "pointer",
                            borderRadius: "9999px",
                            color: "#1F1F1F",
                            "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
                          }}
                        >
                          <LayersRounded sx={{ fontSize: 19, color: "#444746", flexShrink: 0 }} />
                          <Typography component="span" sx={{ flex: 1, minWidth: 0, fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {g.name}
                          </Typography>
                          <ExpandMoreRounded sx={{ fontSize: 18, color: "#5F6368", transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform 200ms" }} />
                        </Box>
                        <IconButton
                          className="row-more"
                          size="small"
                          aria-label={`Menu grup ${g.name}`}
                          aria-haspopup="menu"
                          onClick={(e) => setGroupMenu({ anchor: e.currentTarget, group: g })}
                          sx={{ mr: 0.5, width: 32, height: 32, color: "#444746", flexShrink: 0 }}
                        >
                          <MoreVertRounded sx={{ fontSize: 20 }} />
                        </IconButton>
                      </Box>
                      <Collapse in={isOpen} timeout={220}>
                        <Box sx={{ ml: 2.4, pl: 0.75, borderLeft: "1px solid #DADCE0", mb: 0.5 }}>
                          {items.length ? items.map(renderRow) : <Empty>Belum ada chat. Pindahkan lewat menu ⋮ di chat.</Empty>}
                        </Box>
                      </Collapse>
                    </Box>
                  );
                })}
              </Box>
            )}
            <SectionTitle>Terbaru</SectionTitle>
            {loose.length === 0 ? <Empty>{chats.length ? "Semua chat sudah masuk grup." : "Belum ada chat."}</Empty> : loose.map(renderRow)}
          </>
        )}
      </Box>
      <ChatMenu
        anchor={menu?.anchor ?? null}
        chat={menu?.chat ?? null}
        onClose={() => setMenu(null)}
        onAction={onAction}
        groups={grouping ? groups : null}
        groupId={menu ? placement[menu.chat.id] ?? null : null}
        onMove={onMove}
        onNewGroup={(c) => onGroupAction?.("new", null, c)}
      />
      <Menu
        anchorEl={groupMenu?.anchor ?? null}
        open={Boolean(groupMenu)}
        onClose={() => setGroupMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 200, borderRadius: "16px", py: 0.5, boxShadow: "0 1px 3px rgba(0,0,0,.15), 0 4px 8px 3px rgba(0,0,0,.08)" } } }}
      >
        <MenuItem
          onClick={() => {
            const g = groupMenu?.group ?? null;
            setGroupMenu(null);
            onGroupAction?.("rename", g);
          }}
        >
          <ListItemIcon>
            <DriveFileRenameOutlineRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Ganti nama grup</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const g = groupMenu?.group ?? null;
            setGroupMenu(null);
            onGroupAction?.("delete", g);
          }}
          sx={{ color: "#B3261E" }}
        >
          <ListItemIcon>
            <DeleteRounded fontSize="small" sx={{ color: "#B3261E" }} />
          </ListItemIcon>
          <ListItemText>Hapus grup</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
