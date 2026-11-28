"use client";

import { useMemo, useRef, useState } from "react";
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
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import PushPinRounded from "@mui/icons-material/PushPinRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import GroupRounded from "@mui/icons-material/GroupRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PersonAddRounded from "@mui/icons-material/PersonAddRounded";
import { useAccount } from "@/features/accounts/account";
import { participants, type ChatListItem, type ChatStatus } from "../types";

// Left pane of /chat (docs/CHAT.md → "UI"), styled like Gemini's sidebar (light): "Chat baru" row, search toggle,
// "Terbaru" with single-line titles as pills; pinned first, then newest; ⋮ row menu.

export type ChatAction = "rename" | "pin" | "share" | "delete";

/** Ganti nama / Sematkan / Bagikan / Hapus (owner) or Keluar (member) — the row menu and the thread header's menu. */
export function ChatMenu({
  anchor,
  chat,
  onClose,
  onAction,
}: {
  anchor: HTMLElement | null;
  chat: ChatListItem | null;
  onClose: () => void;
  onAction: (action: ChatAction, chat: ChatListItem) => void;
}) {
  const { email } = useAccount();
  const owner = !chat || chat.owner_email === email;
  const act = (a: ChatAction) => {
    onClose();
    if (chat) onAction(a, chat);
  };
  return (
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
      <Divider />
      <MenuItem onClick={() => act("delete")} sx={{ color: "#B3261E" }}>
        <ListItemIcon>
          {owner ? <DeleteRounded fontSize="small" sx={{ color: "#B3261E" }} /> : <LogoutRounded fontSize="small" sx={{ color: "#B3261E" }} />}
        </ListItemIcon>
        <ListItemText>{owner ? "Hapus" : "Keluar dari chat"}</ListItemText>
      </MenuItem>
    </Menu>
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

/** Hide the history panel: a chevron pointing left (it shows a chevron right when closed). */
export function SidebarIcon() {
  return <ChevronLeftRounded sx={{ fontSize: 24 }} />;
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
      <Tooltip title={inline ? "Riwayat chat" : "Tampilkan Chat History"} placement={tip}>
        <IconButton
          aria-label={inline ? "Riwayat chat" : "Tampilkan Chat History"}
          aria-haspopup="dialog"
          aria-expanded={historyOpen}
          onClick={(e) => onHistory(e.currentTarget)}
          sx={{ ...iconBtn, ...(historyOpen ? { bgcolor: "#D3E3FD", color: "#041E49", "&:hover": { bgcolor: "#D3E3FD" } } : {}) }}
        >
          {inline ? <HistoryRounded sx={{ fontSize: 22 }} /> : <ChevronRightRounded sx={{ fontSize: 24 }} />}
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

const HOVER = "#ECEFF3"; // row hover on the soft list background

const iconBtn = { color: "#444746", width: 36, height: 36, "&:hover": { bgcolor: "rgba(68,71,70,0.08)" } } as const;

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
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(Boolean(popover));
  const [menu, setMenu] = useState<{ anchor: HTMLElement; chat: ChatListItem } | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: popover ? "#fff" : "linear-gradient(180deg, #F3F5F8 0%, #FAFBFC 45%, #FFFFFF 100%)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 2, pr: 0.75, pt: 0.75, pb: 0.5, minHeight: 48 }}>
        <Typography component="h2" sx={{ flex: 1, fontSize: "1rem", fontWeight: 500, color: "#1F1F1F", letterSpacing: 0 }}>
          {popover ? "Riwayat chat" : "Chat"}
        </Typography>
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
            height: 38,
            px: 1.25,
            border: "none",
            borderRadius: "9999px",
            bgcolor: newActive ? "#D3E3FD" : "transparent",
            color: newActive ? "#041E49" : "#1F1F1F",
            fontFamily: "inherit",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textAlign: "left",
            cursor: "pointer",
            "&:hover": { bgcolor: newActive ? "#D3E3FD" : HOVER },
            "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
          }}
        >
          <AddRounded sx={{ fontSize: 22, color: newActive ? "#041E49" : "#444746" }} />
          Chat baru
        </Box>
      </Box>

      <Typography sx={{ px: 2.25, pt: popover ? 1 : 2, pb: 0.75, fontSize: "0.75rem", fontWeight: 500, color: "#5F6368" }}>
        {query.trim() ? "Hasil pencarian" : "Chat History"}
      </Typography>

      <Box component="nav" aria-label="Daftar chat" sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1, pb: 1.5 }}>
        {shown.length === 0 ? (
          <Typography sx={{ fontSize: "0.875rem", color: "#5E5E5E", px: 1.5, py: 1 }}>
            {query ? "Tidak ada chat yang cocok." : "Belum ada chat."}
          </Typography>
        ) : (
          shown.map((c) => {
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
                  height: 34,
                  borderRadius: "9999px",
                  bgcolor: active ? "#D3E3FD" : menuOn ? HOVER : "transparent",
                  transition: "background-color 150ms",
                  "&:hover": { bgcolor: active ? "#D3E3FD" : HOVER },
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
                      fontSize: "0.8125rem",
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
          })
        )}
      </Box>
      <ChatMenu anchor={menu?.anchor ?? null} chat={menu?.chat ?? null} onClose={() => setMenu(null)} onAction={onAction} />
    </Box>
  );
}
