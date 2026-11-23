"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import type { DriveDocType, DriveFile, DriveMessage } from "@/lib/drive/types";
import { driveContentUrl, driveViewUrl } from "@/lib/drive/links";
import { toastError } from "@/components/ui/Toast";
import { createGenerateJob, DOC_TYPE_LABEL, replyToJob, retryJob } from "../api";
import { formatBytes, formatDateTime, formatRelative } from "../format";
import { fileIcon, isBusy, StatusBadge } from "./DriveItems";

// Chat tab for creating documents (docs/DRIVE.md → "Chat tab for creating documents").
// One conversation = one drive_files row with source='generated'.

export const NEW_CHAT = "new";

const DOC_TYPES: { key: DriveDocType; label: string; hint: string }[] = [
  { key: "sph", label: "SPH", hint: "Surat penawaran harga" },
  { key: "mou", label: "MoU", hint: "Nota kesepahaman" },
  { key: "deck", label: "Deck", hint: "Presentasi" },
  { key: "other", label: "Lainnya", hint: "Dokumen lain" },
];
const PLACEHOLDER: Record<DriveDocType, string> = {
  sph: "Buatkan SPH untuk PT Maju Jaya, paket chatbot customer service, kontak Bapak Andi…",
  mou: "Buatkan MoU kerja sama dengan PT Contoh tentang…",
  deck: "Buatkan deck presentasi untuk…",
  other: "Ceritakan dokumen yang dibutuhkan…",
};
const NARROW_PX = 720;

const lastActivity = (f: DriveFile) => {
  const m = f.messages?.length ? f.messages[f.messages.length - 1].at : null;
  return m && m > f.created_at ? m : f.created_at;
};

// ── tiny markdown-ish renderer: paragraphs/line breaks, "- " / "* " / "1. " bullets, **bold** ──
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>,
  );
}
function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const bullet = line.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
        if (bullet) {
          return (
            <Box key={i} sx={{ display: "flex", gap: 1, pl: 0.5 }}>
              <Box component="span" sx={{ flexShrink: 0, minWidth: bullet[1] ? 18 : 8, color: "#5F6368" }}>
                {bullet[1] ? `${bullet[1]}.` : "•"}
              </Box>
              <Box component="span" sx={{ minWidth: 0 }}>
                {inline(bullet[2])}
              </Box>
            </Box>
          );
        }
        if (!line.trim()) return <Box key={i} sx={{ height: "0.6em" }} />;
        return <Box key={i}>{inline(line)}</Box>;
      })}
    </>
  );
}

function useNarrow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < NARROW_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, narrow };
}

// ── composer ─────────────────────────────────────────────────
function Composer({
  placeholder,
  disabled,
  disabledHint,
  autoFocus,
  onSend,
}: {
  placeholder: string;
  disabled?: boolean;
  disabledHint?: string;
  autoFocus?: boolean;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const blocked = disabled || sending;
  const send = async () => {
    if (!text.trim() || blocked) return;
    setSending(true);
    try {
      if (await onSend(text.trim())) setText("");
    } finally {
      setSending(false);
    }
  };
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        pl: 2,
        pr: 0.75,
        py: 0.75,
        borderRadius: "24px",
        bgcolor: disabled ? "#F1F3F4" : "#F0F4F9",
        border: "1px solid transparent",
        "&:focus-within": { bgcolor: "#fff", borderColor: "#C4C7C5" },
      }}
    >
      <InputBase
        multiline
        maxRows={8}
        autoFocus={autoFocus}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={disabled ? disabledHint : placeholder}
        sx={{ flex: 1, py: 0.75, fontSize: "0.9375rem", lineHeight: 1.5 }}
        inputProps={{ "aria-label": "Tulis pesan" }}
      />
      <Tooltip title="Kirim (Enter)">
        <span>
          <IconButton
            onClick={send}
            disabled={blocked || !text.trim()}
            aria-label="Kirim"
            sx={{
              width: 40,
              height: 40,
              bgcolor: "#0B57D0",
              color: "#fff",
              "&:hover": { bgcolor: "#0842A0" },
              "&.Mui-disabled": { bgcolor: "#E3E3E3", color: "#9AA0A6" },
            }}
          >
            {sending ? <CircularProgress size={18} color="inherit" /> : <ArrowUpwardRounded />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

// ── conversation list ────────────────────────────────────────
function ConversationList({
  items,
  activeId,
  now,
  onSelect,
  onNew,
}: {
  items: DriveFile[];
  activeId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pt: 2, pb: 1.5 }}>
        <Typography sx={{ flex: 1, fontSize: "1.125rem", color: "#1F1F1F" }}>Chat Dokumen</Typography>
        <Button
          size="small"
          variant={activeId === NEW_CHAT ? "contained" : "outlined"}
          disableElevation
          startIcon={<AddRounded />}
          onClick={onNew}
          sx={{ borderRadius: "9999px", flexShrink: 0 }}
        >
          Chat baru
        </Button>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1, pb: 1 }}>
        {items.length === 0 ? (
          <Box sx={{ textAlign: "center", color: "#5F6368", px: 2, py: 6 }}>
            <ChatBubbleOutlineRounded sx={{ fontSize: 40, color: "#C4C7C5", mb: 1 }} />
            <Typography sx={{ fontSize: "0.875rem" }}>Belum ada percakapan.</Typography>
          </Box>
        ) : (
          items.map((f) => {
            const active = f.id === activeId;
            const { Icon, color } = fileIcon(f);
            return (
              <Box
                key={f.id}
                component="button"
                type="button"
                onClick={() => onSelect(f.id)}
                sx={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.5,
                  px: 1.5,
                  py: 1.25,
                  mb: "2px",
                  border: "none",
                  borderRadius: "12px",
                  bgcolor: active ? "#D3E3FD" : "transparent",
                  fontFamily: "inherit",
                  textAlign: "left",
                  cursor: "pointer",
                  "&:hover": { bgcolor: active ? "#D3E3FD" : "rgba(68,71,70,0.08)" },
                }}
              >
                <Icon sx={{ fontSize: 22, color, mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <Typography
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        color: "#1F1F1F",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {f.name}
                    </Typography>
                    <Typography suppressHydrationWarning sx={{ fontSize: "0.75rem", color: "#5F6368", flexShrink: 0 }}>
                      {formatRelative(lastActivity(f), now)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, minHeight: 20 }}>
                    <Typography sx={{ fontSize: "0.75rem", color: "#444746", flexShrink: 0 }}>
                      {f.doc_type ? DOC_TYPE_LABEL[f.doc_type] : "Dokumen"}
                    </Typography>
                    {f.status === "ready" ? (
                      <Typography sx={{ fontSize: "0.75rem", color: "#146C2E", fontWeight: 500 }}>Siap</Typography>
                    ) : (
                      <StatusBadge file={f} />
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}

// ── message bubbles ──────────────────────────────────────────
function Bubble({ m }: { m: DriveMessage }) {
  const user = m.role === "user";
  return (
    <Box sx={{ display: "flex", justifyContent: user ? "flex-end" : "flex-start", gap: 1 }}>
      {!user && <AgentAvatar />}
      <Box sx={{ maxWidth: "min(78%, 640px)", minWidth: 0 }}>
        <Box
          sx={{
            bgcolor: user ? "#0B57D0" : "#F0F4F9",
            color: user ? "#fff" : "#1F1F1F",
            borderRadius: user ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            px: 1.75,
            py: 1.1,
            fontSize: "0.9375rem",
            lineHeight: 1.55,
            wordBreak: "break-word",
            whiteSpace: user ? "pre-wrap" : "normal",
          }}
        >
          {user ? m.text : <RichText text={m.text} />}
        </Box>
        <Typography
          suppressHydrationWarning
          sx={{ fontSize: "0.6875rem", color: "#5F6368", mt: 0.5, px: 0.5, textAlign: user ? "right" : "left" }}
        >
          {formatDateTime(m.at)}
        </Typography>
      </Box>
    </Box>
  );
}

function AgentAvatar() {
  return (
    <Box
      sx={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #8E5CF5, #0B57D0)",
        color: "#fff",
        mt: 0.25,
      }}
    >
      <AutoAwesomeRounded sx={{ fontSize: 16 }} />
    </Box>
  );
}

function Typing({ file }: { file: DriveFile }) {
  const text = file.progress || (file.status === "queued" ? "Menunggu giliran di antrean…" : "Agen sedang menyusun dokumen…");
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <AgentAvatar />
      <Box>
        <Box
          sx={{
            display: "inline-flex",
            gap: 0.6,
            alignItems: "center",
            bgcolor: "#F0F4F9",
            borderRadius: "18px 18px 18px 4px",
            px: 2,
            py: 1.5,
            "@keyframes chatDot": { "0%, 80%, 100%": { opacity: 0.25, transform: "translateY(0)" }, "40%": { opacity: 1, transform: "translateY(-3px)" } },
          }}
          aria-label="Agen sedang mengetik"
        >
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#5F6368", animation: `chatDot 1.2s ${i * 0.16}s infinite ease-in-out` }}
            />
          ))}
        </Box>
        <Typography sx={{ fontSize: "0.75rem", color: "#0B57D0", mt: 0.5, px: 0.5 }}>{text}</Typography>
      </Box>
    </Box>
  );
}

function FileCard({ file, onPreview }: { file: DriveFile; onPreview: () => void }) {
  const { Icon, color } = fileIcon(file);
  const gid = file.google_file_id;
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Box sx={{ width: 30, flexShrink: 0 }} />
      <Box sx={{ width: "min(420px, 100%)", border: "1px solid #E0E3E7", borderRadius: "14px", overflow: "hidden", bgcolor: "#fff" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "#F0F4F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon sx={{ fontSize: 24, color }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {file.name}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>
              {[file.doc_number, file.size_bytes != null ? formatBytes(file.size_bytes) : null].filter(Boolean).join(" · ") || "Dokumen siap"}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, px: 1, pb: 1 }}>
          <Button size="small" startIcon={<VisibilityOutlined />} onClick={onPreview} sx={{ borderRadius: "9999px" }}>
            Pratinjau
          </Button>
          {gid && (
            <Button
              size="small"
              startIcon={<OpenInNewRounded />}
              href={driveViewUrl(gid)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ borderRadius: "9999px" }}
            >
              Buka di Google Drive
            </Button>
          )}
          {gid && (
            <Button size="small" startIcon={<DownloadRounded />} href={driveContentUrl(file.id, true)} sx={{ borderRadius: "9999px" }}>
              Download
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ── thread ───────────────────────────────────────────────────
function Thread({
  file,
  onBack,
  onPreview,
  onChanged,
}: {
  file: DriveFile;
  onBack?: () => void;
  onPreview: (id: string) => void;
  onChanged: () => Promise<void> | void;
}) {
  const busy = isBusy(file);
  const messages = useMemo(() => {
    const list = [...(file.messages ?? [])];
    // Older worker versions may set agent_message without appending it to messages.
    const last = list[list.length - 1];
    if ((file.status === "needs_input" || file.status === "ready") && file.agent_message && last?.role !== "assistant") {
      list.push({ role: "assistant", text: file.agent_message, at: file.updated_at });
    }
    return list;
  }, [file.messages, file.status, file.agent_message, file.updated_at]);

  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    pinned.current = true;
  }, [file.id]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [file.id, messages.length, file.status, file.progress]);

  const send = async (text: string) => {
    try {
      await replyToJob(file, text);
      pinned.current = true;
      await onChanged();
      return true;
    } catch (e) {
      toastError((e as Error).message);
      return false;
    }
  };
  const retry = async () => {
    try {
      await retryJob(file);
      pinned.current = true;
      await onChanged();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: onBack ? 1 : 2.5, minHeight: 60, borderBottom: "1px solid #E0E3E7", flexShrink: 0 }}>
        {onBack && (
          <IconButton onClick={onBack} aria-label="Kembali ke daftar">
            <ArrowBackRounded />
          </IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file.name}
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>
            {file.doc_type ? DOC_TYPE_LABEL[file.doc_type] : "Dokumen"}
            {file.doc_number ? ` · ${file.doc_number}` : ""}
          </Typography>
        </Box>
        {file.status === "ready" ? null : <StatusBadge file={file} />}
      </Box>

      <Box
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 1.5, sm: 3 }, py: 2.5 }}
      >
        <Box sx={{ maxWidth: 820, mx: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {messages.map((m, i) => (
            <Bubble key={`${i}-${m.at}`} m={m} />
          ))}
          {busy && <Typing file={file} />}
          {file.status === "ready" && <FileCard file={file} onPreview={() => onPreview(file.id)} />}
          {file.status === "failed" && (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Box sx={{ width: 30, flexShrink: 0 }} />
              <Box sx={{ border: "1px solid #F4C7C3", bgcolor: "#FCE8E6", borderRadius: "14px", p: 1.5, maxWidth: 520 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", color: "#B3261E" }}>
                  <ErrorOutlineRounded sx={{ fontSize: 20, mt: 0.1 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 500 }}>Gagal membuat dokumen</Typography>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#601410", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {file.error_msg || "Terjadi kesalahan."}
                    </Typography>
                  </Box>
                </Box>
                <Button size="small" variant="contained" disableElevation startIcon={<ReplayRounded />} onClick={retry} sx={{ borderRadius: "9999px", mt: 1.25, ml: 3.5 }}>
                  Coba lagi
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, sm: 3 }, pb: 2, pt: 1, flexShrink: 0 }}>
        <Box sx={{ maxWidth: 820, mx: "auto" }}>
          {file.status === "needs_input" && (
            <Typography sx={{ fontSize: "0.75rem", color: "#7A4F01", mb: 0.75, px: 1 }}>Agen menunggu jawaban Anda.</Typography>
          )}
          <Composer
            key={file.id}
            placeholder={
              file.status === "ready"
                ? "Minta revisi, mis. “ganti harga paket jadi Rp5 jt”…"
                : file.status === "needs_input"
                  ? "Tulis jawaban…"
                  : "Tulis pesan…"
            }
            disabled={busy}
            disabledHint="Tunggu agen selesai…"
            autoFocus={file.status === "needs_input"}
            onSend={send}
          />
        </Box>
      </Box>
    </Box>
  );
}

// ── new chat ─────────────────────────────────────────────────
function NewChat({
  destination,
  onBack,
  onCreate,
}: {
  destination: (t: DriveDocType) => string;
  onBack?: () => void;
  onCreate: (docType: DriveDocType, text: string) => Promise<boolean>;
}) {
  const [docType, setDocType] = useState<DriveDocType>("sph");
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {onBack && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, minHeight: 56, borderBottom: "1px solid #E0E3E7" }}>
          <IconButton onClick={onBack} aria-label="Kembali ke daftar">
            <ArrowBackRounded />
          </IconButton>
          <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>Chat baru</Typography>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", px: { xs: 2, sm: 3 }, py: 3 }}>
        <Box sx={{ maxWidth: 640, width: "100%", mx: "auto", textAlign: "center" }}>
          <Box sx={{ display: "inline-flex", mb: 1.5 }}>
            <Box sx={{ transform: "scale(1.5)" }}>
              <AgentAvatar />
            </Box>
          </Box>
          <Typography sx={{ fontSize: "1.5rem", color: "#1F1F1F", mt: 1 }}>Mau buat dokumen apa?</Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", mt: 0.5 }}>
            Ceritakan kebutuhannya. Agen akan bertanya kalau ada yang kurang, lalu menyimpan hasilnya di folder{" "}
            <b>{destination(docType)}</b>.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center", mt: 2.5 }}>
            {DOC_TYPES.map((t) => {
              const active = t.key === docType;
              return (
                <Box
                  key={t.key}
                  component="button"
                  type="button"
                  title={t.hint}
                  aria-pressed={active}
                  onClick={() => setDocType(t.key)}
                  sx={{
                    height: 32,
                    px: 2,
                    borderRadius: "9999px",
                    border: active ? "1px solid #C2E7FF" : "1px solid #C4C7C5",
                    bgcolor: active ? "#C2E7FF" : "#fff",
                    color: active ? "#001D35" : "#444746",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    "&:hover": { bgcolor: active ? "#B4DEFB" : "#F0F4F9" },
                  }}
                >
                  {t.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
      <Box sx={{ px: { xs: 1.5, sm: 3 }, pb: 2, pt: 1 }}>
        <Box sx={{ maxWidth: 820, mx: "auto" }}>
          <Composer placeholder={PLACEHOLDER[docType]} autoFocus onSend={(text) => onCreate(docType, text)} />
          <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368", textAlign: "center", mt: 0.75 }}>
            Enter untuk kirim · Shift+Enter untuk baris baru
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ── view ─────────────────────────────────────────────────────
export function DriveChat({
  conversations,
  selected,
  userId,
  destination,
  onSelect,
  onPreview,
  onChanged,
}: {
  conversations: DriveFile[]; // generated rows, not trashed
  selected: string | null; // file id, NEW_CHAT, or null
  userId: string;
  destination: (t: DriveDocType) => { id: string | null; name: string };
  onSelect: (id: string | null, replace?: boolean) => void;
  onPreview: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const { ref, narrow } = useNarrow<HTMLDivElement>();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setNow(Date.now()), [conversations]);

  const items = useMemo(
    () => [...conversations].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))),
    [conversations],
  );
  const file = selected && selected !== NEW_CHAT ? items.find((f) => f.id === selected) ?? null : null;
  // Desktop: nothing selected = new chat. Mobile: nothing selected = the list.
  const showNew = selected === NEW_CHAT || (!file && !narrow);
  const activeId = file ? file.id : showNew ? NEW_CHAT : null;
  const showThread = Boolean(file) || showNew;

  const create = async (docType: DriveDocType, text: string) => {
    try {
      const dest = destination(docType);
      const id = await createGenerateJob({ docType, prompt: text, folderId: dest.id, userId });
      onSelect(id, true);
      await onChanged();
      return true;
    } catch (e) {
      toastError((e as Error).message);
      return false;
    }
  };

  const back = narrow ? () => onSelect(null) : undefined;
  const pane = file ? (
    <Thread key={file.id} file={file} onBack={back} onPreview={onPreview} onChanged={onChanged} />
  ) : showNew ? (
    <NewChat destination={(t) => destination(t).name} onBack={back} onCreate={create} />
  ) : null;

  return (
    <Box ref={ref} sx={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
      {(!narrow || !showThread) && (
        <Box sx={{ width: narrow ? "100%" : 320, flexShrink: 0, borderRight: narrow ? "none" : "1px solid #E0E3E7", minHeight: 0 }}>
          <ConversationList items={items} activeId={activeId} now={now} onSelect={(id) => onSelect(id)} onNew={() => onSelect(NEW_CHAT)} />
        </Box>
      )}
      {showThread && <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>{pane}</Box>}
    </Box>
  );
}
