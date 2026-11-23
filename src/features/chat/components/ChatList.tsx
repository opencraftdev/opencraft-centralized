"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineOutlined from "@mui/icons-material/DriveFileRenameOutlineOutlined";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import PushPinOutlined from "@mui/icons-material/PushPinOutlined";
import PushPinRounded from "@mui/icons-material/PushPinRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { formatRelative } from "@/features/drive/format";
import type { ChatListItem, ChatStatus } from "../types";

// Left pane of /chat (docs/CHAT.md → "UI"): pinned first, then newest; search by title; row menu.

export type ChatAction = "rename" | "pin" | "delete";

/** Ganti nama / Sematkan / Hapus — the row menu and the thread header's menu. */
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
  const act = (a: ChatAction) => {
    onClose();
    if (chat) onAction(a, chat);
  };
  return (
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor && chat)}
      onClose={onClose}
      slotProps={{ paper: { sx: { minWidth: 200, borderRadius: "8px" } } }}
    >
      <MenuItem onClick={() => act("rename")}>
        <ListItemIcon>
          <DriveFileRenameOutlineOutlined fontSize="small" />
        </ListItemIcon>
        <ListItemText>Ganti nama</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => act("pin")}>
        <ListItemIcon>{chat?.pinned ? <PushPinRounded fontSize="small" /> : <PushPinOutlined fontSize="small" />}</ListItemIcon>
        <ListItemText>{chat?.pinned ? "Lepas sematan" : "Sematkan"}</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => act("delete")} sx={{ color: "#B3261E" }}>
        <ListItemIcon>
          <DeleteOutlineRounded fontSize="small" sx={{ color: "#B3261E" }} />
        </ListItemIcon>
        <ListItemText>Hapus</ListItemText>
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

export function ChatList({
  chats,
  activeId,
  newActive,
  now,
  onSelect,
  onNew,
  onAction,
}: {
  chats: ChatListItem[];
  activeId: string | null;
  newActive: boolean;
  now: number;
  onSelect: (id: string) => void;
  onNew: () => void;
  onAction: (action: ChatAction, chat: ChatListItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ anchor: HTMLElement; chat: ChatListItem } | null>(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  }, [chats, query]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pt: 2, pb: 1.25 }}>
        <Typography sx={{ flex: 1, fontSize: "1.125rem", color: "#1F1F1F" }}>Chat</Typography>
        <Button
          size="small"
          variant={newActive ? "contained" : "outlined"}
          disableElevation
          startIcon={<AddRounded />}
          onClick={onNew}
          sx={{ borderRadius: "9999px", flexShrink: 0 }}
        >
          Chat baru
        </Button>
      </Box>
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            height: 40,
            px: 1.5,
            borderRadius: "9999px",
            bgcolor: "#F0F4F9",
            "&:focus-within": { bgcolor: "#fff", boxShadow: "inset 0 0 0 1px #0B57D0" },
          }}
        >
          <SearchRounded sx={{ fontSize: 20, color: "#5F6368" }} />
          <InputBase
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari chat"
            inputProps={{ "aria-label": "Cari chat" }}
            sx={{ flex: 1, fontSize: "0.875rem" }}
          />
          {query && (
            <IconButton size="small" aria-label="Hapus pencarian" onClick={() => setQuery("")}>
              <CloseRounded sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>
      </Box>
      <Box component="nav" aria-label="Daftar chat" sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1, pb: 1 }}>
        {shown.length === 0 ? (
          <Box sx={{ textAlign: "center", color: "#5F6368", px: 2, py: 6 }}>
            <ChatBubbleOutlineRounded sx={{ fontSize: 40, color: "#C4C7C5", mb: 1 }} />
            <Typography sx={{ fontSize: "0.875rem" }}>{query ? "Tidak ada chat yang cocok." : "Belum ada chat."}</Typography>
          </Box>
        ) : (
          shown.map((c) => {
            const active = c.id === activeId;
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
                  mb: "2px",
                  borderRadius: "12px",
                  bgcolor: active ? "#D3E3FD" : "transparent",
                  "&:hover": { bgcolor: active ? "#D3E3FD" : "rgba(68,71,70,0.08)" },
                  "& .row-more": { opacity: { xs: 1, md: active || menu?.chat.id === c.id ? 1 : 0 } },
                  "&:hover .row-more, &:focus-within .row-more": { opacity: 1 },
                }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onSelect(c.id)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    pl: 1.5,
                    pr: 0.5,
                    py: 1.25,
                    border: "none",
                    bgcolor: "transparent",
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    borderRadius: "12px",
                  }}
                >
                  {c.pinned && <PushPinRounded sx={{ fontSize: 14, color: "#5F6368", flexShrink: 0 }} />}
                  <Typography
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: "0.875rem",
                      fontWeight: active ? 600 : 500,
                      color: "#1F1F1F",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.title || "Chat baru"}
                  </Typography>
                  <StatusDot status={c.status} />
                  <Typography suppressHydrationWarning sx={{ fontSize: "0.75rem", color: "#5F6368", flexShrink: 0 }}>
                    {formatRelative(c.updated_at, now)}
                  </Typography>
                </Box>
                <IconButton
                  className="row-more"
                  size="small"
                  aria-label={`Menu ${c.title}`}
                  aria-haspopup="menu"
                  onClick={(e) => setMenu({ anchor: e.currentTarget, chat: c })}
                  sx={{ mr: 0.5, color: "#444746", flexShrink: 0 }}
                >
                  <MoreVertRounded sx={{ fontSize: 18 }} />
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
