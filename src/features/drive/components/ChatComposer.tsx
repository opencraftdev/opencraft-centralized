"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import StopRounded from "@mui/icons-material/StopRounded";

// Composer + browser-side send queue for the document chat (docs/DRIVE.md → "Chat v2").
// Draft and queue live in localStorage per chat; every access is guarded (private mode, blocked storage).

// ── storage ──────────────────────────────────────────────────
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep it in memory only */
  }
}
const draftKey = (chatId: string) => `drive-chat:draft:${chatId}`;
const queueKey = (chatId: string) => `drive-chat:queue:${chatId}`;

export function clearDraft(chatId: string) {
  writeJson(draftKey(chatId), null);
}

// ── send queue ───────────────────────────────────────────────
export interface QueuedMessage {
  id: string;
  text: string;
}

export function useSendQueue(chatId: string) {
  const [items, setItems] = useState<QueuedMessage[]>([]);
  useEffect(() => setItems(readJson<QueuedMessage[]>(queueKey(chatId), [])), [chatId]);
  const save = useCallback(
    (next: QueuedMessage[]) => {
      setItems(next);
      writeJson(queueKey(chatId), next);
    },
    [chatId],
  );
  const add = useCallback(
    (text: string) => save([...readJson<QueuedMessage[]>(queueKey(chatId), []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text }]),
    [chatId, save],
  );
  const update = useCallback(
    (id: string, text: string) => save(readJson<QueuedMessage[]>(queueKey(chatId), []).map((q) => (q.id === id ? { ...q, text } : q))),
    [chatId, save],
  );
  const remove = useCallback(
    (id: string) => save(readJson<QueuedMessage[]>(queueKey(chatId), []).filter((q) => q.id !== id)),
    [chatId, save],
  );
  /** Takes every waiting message out of the queue (the caller sends them as one message). */
  const take = useCallback(() => {
    const all = readJson<QueuedMessage[]>(queueKey(chatId), []);
    save([]);
    return all;
  }, [chatId, save]);
  return { items, add, update, remove, take, restore: save };
}

// ── queued messages (above the box) ──────────────────────────
export function QueuedMessages({
  items,
  paused,
  sending,
  onUpdate,
  onRemove,
  onSendNow,
}: {
  items: QueuedMessage[];
  paused: string | null; // why the queue waits after the run ended, or null while it waits for the run
  sending: boolean;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onSendNow: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (!items.length) return null;
  const status = paused ?? (items.length > 1 ? `${items.length} pesan menunggu jawaban selesai` : "Menunggu jawaban selesai");
  return (
    <Box component="section" aria-label="Pesan menunggu" sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, mb: 1.25, maxHeight: "40dvh", overflowY: "auto" }}>
      {items.map((it) =>
        editing === it.id ? (
          <Box
            key={it.id}
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              onUpdate(it.id, draft.trim());
              setEditing(null);
            }}
            sx={{ width: "min(85%, 560px)", border: "1px solid #0B57D0", borderRadius: "16px", p: 1, bgcolor: "#fff" }}
          >
            <InputBase
              multiline
              minRows={2}
              maxRows={8}
              autoFocus
              fullWidth
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(null);
                } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault();
                  (e.currentTarget.closest("form") as HTMLFormElement | null)?.requestSubmit();
                }
              }}
              inputProps={{ "aria-label": "Ubah pesan yang menunggu" }}
              sx={{ px: 1, py: 0.5, fontSize: "0.9375rem", lineHeight: 1.5 }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
              <Button size="small" onClick={() => setEditing(null)} sx={{ borderRadius: "9999px" }}>
                Batal
              </Button>
              <Button size="small" type="submit" variant="contained" disableElevation disabled={!draft.trim()} sx={{ borderRadius: "9999px" }}>
                Simpan
              </Button>
            </Box>
          </Box>
        ) : (
          <Box key={it.id} sx={{ display: "flex", alignItems: "flex-start", gap: 0.25, maxWidth: "min(85%, 560px)" }}>
            <Box sx={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <Tooltip title="Ubah">
                <IconButton
                  size="small"
                  aria-label="Ubah pesan"
                  onClick={() => {
                    setDraft(it.text);
                    setEditing(it.id);
                  }}
                  sx={{ color: "#5F6368" }}
                >
                  <EditOutlined sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Jangan kirim">
                <IconButton size="small" aria-label="Hapus pesan" onClick={() => onRemove(it.id)} sx={{ color: "#5F6368" }}>
                  <CloseRounded sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box
              sx={{
                minWidth: 0,
                border: "1px dashed #C4C7C5",
                borderRadius: "18px",
                px: 1.75,
                py: 1,
                color: "#444746",
                fontSize: "0.9375rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                display: "-webkit-box",
                WebkitLineClamp: 6,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {it.text}
            </Box>
          </Box>
        ),
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Typography role="status" aria-live="polite" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.75rem", color: "#5F6368" }}>
          <ScheduleRounded sx={{ fontSize: 14 }} />
          {status}
        </Typography>
        {paused && (
          <Button size="small" variant="contained" disableElevation disabled={sending || editing != null} onClick={onSendNow} sx={{ borderRadius: "9999px", height: 28 }}>
            Kirim sekarang
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ── composer ─────────────────────────────────────────────────
export interface ComposerHandle {
  focus: () => void;
}

export const Composer = forwardRef<
  ComposerHandle,
  {
    chatId: string; // draft key
    placeholder: string;
    running?: boolean; // a run is in progress: Stop shows, sends go to the queue
    stopping?: boolean;
    autoFocus?: boolean;
    onSend: (text: string) => Promise<boolean>;
    onStop?: () => void;
  }
>(function Composer({ chatId, placeholder, running, stopping, autoFocus, onSend, onStop }, ref) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), []);

  // draft per chat
  useEffect(() => setText(readJson<string>(draftKey(chatId), "")), [chatId]);
  const change = (v: string) => {
    setText(v);
    writeJson(draftKey(chatId), v);
  };

  const canSend = text.trim().length > 0 && !sending;
  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      if (await onSend(text.trim())) change("");
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  return (
    <Box
      onClick={(e) => {
        if (e.target === e.currentTarget) input.current?.focus();
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "24px",
        border: "1px solid #C4C7C5",
        bgcolor: "#fff",
        cursor: "text",
        transition: "border-color .15s",
        "&:focus-within": { borderColor: "#0B57D0" },
      }}
    >
      <InputBase
        multiline
        minRows={1}
        maxRows={10}
        autoFocus={autoFocus}
        inputRef={input}
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter new line; never while an IME is composing (keyCode 229 for older Safari).
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder={running ? "Tulis pesan berikutnya — dikirim setelah jawaban selesai" : placeholder}
        sx={{ px: 2.25, pt: 1.5, pb: 0.5, fontSize: "0.9375rem", lineHeight: 1.5 }}
        inputProps={{ "aria-label": "Tulis pesan" }}
      />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.75, px: 1, pb: 1 }}>
        {running && (
          <Tooltip title="Hentikan">
            <span>
              <IconButton
                onClick={onStop}
                disabled={stopping}
                aria-label="Hentikan"
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "#1F1F1F",
                  color: "#fff",
                  "&:hover": { bgcolor: "#444746" },
                  "&.Mui-disabled": { bgcolor: "#E3E3E3", color: "#9AA0A6" },
                }}
              >
                {stopping ? <CircularProgress size={16} color="inherit" /> : <StopRounded sx={{ fontSize: 20 }} />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        {(!running || text.trim()) && (
          <Tooltip title={running ? "Antrekan (Enter)" : "Kirim (Enter)"}>
            <span>
              <IconButton
                onClick={() => void send()}
                disabled={!canSend}
                aria-label={running ? "Antrekan pesan" : "Kirim"}
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: "#0B57D0",
                  color: "#fff",
                  "&:hover": { bgcolor: "#0842A0" },
                  "&.Mui-disabled": { bgcolor: "#E3E3E3", color: "#9AA0A6" },
                }}
              >
                {sending ? <CircularProgress size={16} color="inherit" /> : <ArrowUpwardRounded sx={{ fontSize: 20 }} />}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
});
