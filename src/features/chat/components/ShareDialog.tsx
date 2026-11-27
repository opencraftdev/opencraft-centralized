"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { nameOf, personFor, useAccount } from "@/features/accounts/account";
import { MemberAvatar } from "@/features/tasks/components/bits";
import type { Member } from "@/features/tasks/types";
import { addChatMembers, removeChatMember } from "../api";
import { participants, type ChatListItem } from "../types";

// "Bagikan chat" (docs/ACCOUNTS.md → "Shared chats"): pick teammates; they are in right away (no invitation to accept)
// and the chat appears live in their list. The owner can remove people; a member can leave.

export function ShareDialog({
  chat,
  people,
  onClose,
  onChanged,
  onLeft,
}: {
  chat: ChatListItem | null;
  people: Member[];
  onClose: () => void;
  onChanged: () => void;
  onLeft: (chat: ChatListItem) => void;
}) {
  const { email: myEmail } = useAccount();
  const [busy, setBusy] = useState<string | null>(null);
  if (!chat) return <Dialog open={false} />;

  const inChat = participants(chat);
  const isOwner = chat.owner_email === myEmail;
  const others = people.filter((p) => p.email && !inChat.includes(p.email));

  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toastSuccess(ok);
      onChanged();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const personRow = (email: string, action: React.ReactNode, note?: string) => {
    const m = personFor(email, people);
    return (
      <Box key={email} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
        <MemberAvatar member={m} size={36} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.9375rem", color: "#1F1F1F", fontWeight: 500 }}>
            {nameOf(email, people)}
            {email === myEmail && <Box component="span" sx={{ color: "#5E5E5E", fontWeight: 400 }}> (kamu)</Box>}
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "#5E5E5E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {note ?? (m.role || email)}
          </Typography>
        </Box>
        {action}
      </Box>
    );
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: "28px", bgcolor: "#fff" } } }}>
      <Box sx={{ display: "flex", alignItems: "center", pl: 3, pr: 1.5, pt: 2, pb: 0.5 }}>
        <Typography component="h2" sx={{ flex: 1, fontSize: "1.375rem", color: "#1F1F1F" }}>
          Bagikan chat
        </Typography>
        <IconButton aria-label="Tutup" onClick={onClose} sx={{ color: "#444746" }}>
          <CloseRounded />
        </IconButton>
      </Box>
      <Typography sx={{ px: 3, fontSize: "0.8125rem", color: "#5E5E5E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {chat.title || "Chat baru"}
      </Typography>

      <Box sx={{ px: 3, pt: 2 }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#444746", textTransform: "uppercase", letterSpacing: ".04em" }}>
          Di chat ini
        </Typography>
        {inChat.map((email) =>
          personRow(
            email,
            email === chat.owner_email ? (
              <Typography sx={{ fontSize: "0.75rem", color: "#5E5E5E", pr: 1 }}>Pemilik</Typography>
            ) : email === myEmail ? (
              <Button
                size="small"
                disabled={busy !== null}
                onClick={() => void run(email, async () => {
                  await removeChatMember(chat.id, email);
                  onLeft(chat);
                }, "Kamu keluar dari chat")}
                sx={{ borderRadius: "9999px", color: "#B3261E" }}
              >
                Keluar
              </Button>
            ) : isOwner ? (
              <Button
                size="small"
                disabled={busy !== null}
                onClick={() => void run(email, () => removeChatMember(chat.id, email))}
                sx={{ borderRadius: "9999px", color: "#444746" }}
              >
                {busy === email ? <CircularProgress size={14} /> : "Hapus"}
              </Button>
            ) : null,
          ),
        )}
      </Box>

      <Box sx={{ px: 3, pt: 1.5, pb: 3 }}>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#444746", textTransform: "uppercase", letterSpacing: ".04em" }}>
          Tambahkan anggota
        </Typography>
        {others.length === 0 ? (
          <Typography sx={{ fontSize: "0.875rem", color: "#5E5E5E", py: 1.5 }}>
            {people.length ? (
              <>
                <CheckRounded sx={{ fontSize: 16, verticalAlign: "-3px", mr: 0.5 }} />
                Semua anggota sudah ada di chat ini.
              </>
            ) : (
              "Memuat anggota…"
            )}
          </Typography>
        ) : (
          others.map((p) =>
            personRow(
              p.email!,
              <Button
                size="small"
                variant="outlined"
                disabled={busy !== null}
                startIcon={busy === p.email ? <CircularProgress size={14} /> : <AddRounded />}
                onClick={() => void run(p.email!, () => addChatMembers(chat.id, [p.email!]), `${p.name} ditambahkan`)}
                sx={{ borderRadius: "9999px", borderColor: "#C4C7C5", color: "#0B57D0", flexShrink: 0 }}
              >
                Tambah
              </Button>,
            ),
          )
        )}
        <Typography sx={{ fontSize: "0.75rem", color: "#5E5E5E", mt: 1.5, lineHeight: 1.5 }}>
          Anggota langsung masuk tanpa perlu menerima undangan, dan bisa melihat seluruh riwayat serta ikut mengirim pesan.
        </Typography>
      </Box>
    </Dialog>
  );
}
