"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import StopCircleOutlined from "@mui/icons-material/StopCircleOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import type { DriveDocType, DriveFile, DriveMessage, DriveStep } from "@/lib/drive/types";
import { driveContentUrl, driveViewUrl } from "@/lib/drive/links";
import { toastError } from "@/components/ui/Toast";
import { createGenerateJob, DOC_TYPE_LABEL, fetchFile, replyToJob, retryJob, stopJob } from "../api";
import { formatBytes, formatDateTime, formatRelative } from "../format";
import { fileIcon, isBusy, StatusBadge } from "./DriveItems";
import { ChatMarkdown } from "./ChatMarkdown";
import { FoldedSteps, LiveSteps } from "./ChatSteps";
import { Composer, QueuedMessages, useSendQueue, type ComposerHandle } from "./ChatComposer";

// Chat tab for creating documents (docs/DRIVE.md → "Chat tab for creating documents" and "Chat v2").
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
const LIVE_POLL_MS = 1500; // run_steps / stream_text are written at most every ~1.5 s
const COLUMN = 760;

const lastActivity = (f: DriveFile) => {
  const m = f.messages?.length ? f.messages[f.messages.length - 1].at : null;
  return m && m > f.created_at ? m : f.created_at;
};

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

// ── messages ─────────────────────────────────────────────────
function UserBubble({ m }: { m: DriveMessage }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <Box
        sx={{
          maxWidth: "min(85%, 600px)",
          bgcolor: "#E9EEF6",
          color: "#1F1F1F",
          borderRadius: "20px 20px 6px 20px",
          px: 2,
          py: 1.25,
          fontSize: "0.9375rem",
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {m.text}
      </Box>
      <Typography suppressHydrationWarning sx={{ fontSize: "0.6875rem", color: "#5F6368", mt: 0.5, px: 0.5 }}>
        {formatDateTime(m.at)}
      </Typography>
    </Box>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Tooltip title={copied ? "Tersalin" : "Salin"}>
      <IconButton
        size="small"
        aria-label={copied ? "Tersalin" : "Salin jawaban"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            toastError("Gagal menyalin.");
          }
        }}
        sx={{ color: "#5F6368", width: 28, height: 28 }}
      >
        {copied ? <CheckRounded sx={{ fontSize: 16, color: "#146C2E" }} /> : <ContentCopyRounded sx={{ fontSize: 15 }} />}
      </IconButton>
    </Tooltip>
  );
}

function StoppedNote() {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "#5F6368", fontSize: "0.8125rem" }}>
      <StopCircleOutlined sx={{ fontSize: 16 }} />
      Dihentikan
    </Box>
  );
}

// An answer: plain Markdown in the column (no bubble), then its actions (folded steps, copy, time).
function AssistantMessage({ m }: { m: DriveMessage }) {
  const text = m.text?.trim() ?? "";
  return (
    <Box sx={{ minWidth: 0 }}>
      {text && <ChatMarkdown text={text} />}
      {m.stopped && (
        <Box sx={{ mt: text ? 1 : 0 }}>
          <StoppedNote />
        </Box>
      )}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, mt: 0.75, ml: -0.5 }}>
        <FoldedSteps steps={m.steps} durationMs={m.duration_ms} />
        {text && <CopyButton text={text} />}
        <Typography suppressHydrationWarning sx={{ fontSize: "0.6875rem", color: "#9AA0A6", px: 0.5 }}>
          {formatDateTime(m.at)}
        </Typography>
      </Box>
    </Box>
  );
}

// The run in progress: live steps + elapsed time, then the reply streamed so far.
function LiveAnswer({ file }: { file: DriveFile }) {
  const queued = file.status === "queued";
  const steps: DriveStep[] = useMemo(() => {
    const list: DriveStep[] = file.run_steps?.length
      ? file.run_steps
      : file.progress
        ? [{ label: file.progress, at: file.started_at ?? "" }]
        : [];
    return file.cancel_requested_at ? [...list, { label: "Menghentikan…", at: file.cancel_requested_at }] : list;
  }, [file.run_steps, file.progress, file.started_at, file.cancel_requested_at]);
  const text = queued ? "" : file.stream_text?.trim() ?? "";
  return (
    <Box sx={{ minWidth: 0 }}>
      <LiveSteps steps={steps} queued={queued && !file.cancel_requested_at} startedAt={file.started_at} />
      {text && (
        <Box sx={{ mt: 1.5 }}>
          <ChatMarkdown text={text} />
        </Box>
      )}
    </Box>
  );
}

function FileCard({ file, onPreview }: { file: DriveFile; onPreview: () => void }) {
  const { Icon, color } = fileIcon(file);
  const gid = file.google_file_id;
  return (
    <Box sx={{ width: "min(440px, 100%)", border: "1px solid #E0E3E7", borderRadius: "14px", overflow: "hidden", bgcolor: "#fff" }}>
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
          <Button size="small" startIcon={<OpenInNewRounded />} href={driveViewUrl(gid)} target="_blank" rel="noopener noreferrer" sx={{ borderRadius: "9999px" }}>
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
  );
}

// ── thread ───────────────────────────────────────────────────
function Thread({
  file: listed,
  onBack,
  onPreview,
  onChanged,
}: {
  file: DriveFile;
  onBack?: () => void;
  onPreview: (id: string) => void;
  onChanged: () => Promise<void> | void;
}) {
  // While a run is live this row is polled on its own (fast); the list prop refreshes slower. Newest wins.
  const [live, setLive] = useState<DriveFile | null>(null);
  const file = live && live.id === listed.id && live.updated_at >= listed.updated_at ? live : listed;
  const busy = isBusy(file);

  const reload = useCallback(async () => {
    try {
      const row = await fetchFile(listed.id);
      if (row) setLive(row);
      return row;
    } catch {
      return null; // transient; the next tick retries
    }
  }, [listed.id]);

  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  useEffect(() => {
    if (!busy) return;
    let alive = true;
    const t = setInterval(async () => {
      const row = await reload();
      if (alive && row && !isBusy(row)) void onChangedRef.current(); // run ended: refresh the list too
    }, LIVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [busy, reload]);

  const messages = useMemo(() => {
    const list = [...(file.messages ?? [])];
    // Older worker versions may set agent_message without appending it to messages.
    const last = list[list.length - 1];
    if ((file.status === "needs_input" || file.status === "ready") && file.agent_message && last?.role !== "assistant") {
      list.push({ role: "assistant", text: file.agent_message, at: file.updated_at });
    }
    return list;
  }, [file.messages, file.status, file.agent_message, file.updated_at]);
  const lastMsg = messages[messages.length - 1];
  const endedStopped = !busy && lastMsg?.role === "assistant" && Boolean(lastMsg.stopped);

  // ── send / queue / stop ──
  const queue = useSendQueue(file.id);
  const composer = useRef<ComposerHandle>(null);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  useEffect(() => {
    if (!busy) setStopping(false);
  }, [busy]);

  const pinned = useRef(true);
  const submit = useCallback(
    async (text: string) => {
      setSending(true);
      try {
        await replyToJob(file, text);
        pinned.current = true;
        await reload();
        await onChangedRef.current();
        return true;
      } catch (e) {
        toastError((e as Error).message);
        return false;
      } finally {
        setSending(false);
      }
    },
    [file, reload],
  );

  // Waiting messages go out as one message (the worker resumes with the last user message only).
  const sendQueued = useCallback(
    async (extra?: string) => {
      const items = queue.take();
      const text = [...items.map((q) => q.text), ...(extra ? [extra] : [])].join("\n\n").trim();
      if (!text) return true;
      const ok = await submit(text);
      if (!ok) queue.restore(items);
      return ok;
    },
    [queue, submit],
  );

  const send = async (text: string) => {
    if (busy) {
      queue.add(text);
      pinned.current = true;
      return true;
    }
    return sendQueued(text);
  };

  // A run that ends ready / needs_input sends the waiting messages; failed / stopped keeps them ("Kirim sekarang").
  const wasBusy = useRef(busy);
  useEffect(() => {
    const ended = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (ended && !endedStopped && (file.status === "ready" || file.status === "needs_input") && queue.items.length) {
      void sendQueued();
    }
  }, [busy, endedStopped, file.status, queue.items.length, sendQueued]);
  const paused =
    busy || !queue.items.length
      ? null
      : file.status === "failed"
        ? "Jawaban gagal — pesan belum dikirim"
        : endedStopped
          ? "Dihentikan — pesan belum dikirim"
          : "Pesan belum dikirim";

  const stop = async () => {
    setStopping(true);
    try {
      await stopJob(file);
      await reload();
      await onChangedRef.current();
    } catch (e) {
      setStopping(false);
      toastError((e as Error).message);
    }
  };
  const retry = async () => {
    try {
      await retryJob(file);
      pinned.current = true;
      await reload();
      await onChangedRef.current();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  // ── scroll: stay at the bottom while pinned ──
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [file.id, messages.length, file.status, file.stream_text, file.run_steps?.length, queue.items.length]);

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
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, sm: 3 }, py: 3 }}
      >
        <Box sx={{ maxWidth: COLUMN, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
          {messages.map((m, i) =>
            m.role === "user" ? <UserBubble key={`${i}-${m.at}`} m={m} /> : <AssistantMessage key={`${i}-${m.at}`} m={m} />,
          )}
          {busy && <LiveAnswer file={file} />}
          {file.status === "ready" && <FileCard file={file} onPreview={() => onPreview(file.id)} />}
          {file.status === "failed" && (
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
          )}
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, sm: 3 }, pb: 2, pt: 1, flexShrink: 0 }}>
        <Box sx={{ maxWidth: COLUMN, mx: "auto" }}>
          <QueuedMessages
            items={queue.items}
            paused={paused}
            sending={sending}
            onUpdate={queue.update}
            onRemove={(id) => {
              queue.remove(id);
              composer.current?.focus();
            }}
            onSendNow={() => void sendQueued()}
          />
          {file.status === "needs_input" && !queue.items.length && (
            <Typography sx={{ fontSize: "0.75rem", color: "#7A4F01", mb: 0.75, px: 1 }}>Agen menunggu jawaban Anda.</Typography>
          )}
          <Composer
            ref={composer}
            chatId={file.id}
            placeholder={
              file.status === "ready"
                ? "Minta revisi, mis. “ganti harga paket jadi Rp5 jt”…"
                : file.status === "needs_input"
                  ? "Tulis jawaban…"
                  : "Tulis pesan…"
            }
            running={busy}
            stopping={stopping || Boolean(file.cancel_requested_at)}
            autoFocus={file.status === "needs_input"}
            onSend={send}
            onStop={() => void stop()}
          />
        </Box>
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
          <Composer chatId={NEW_CHAT} placeholder={PLACEHOLDER[docType]} autoFocus onSend={(text) => onCreate(docType, text)} />
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
    <Box ref={ref} sx={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", position: "relative" }}>
      {(!narrow || !showThread) && (
        <Box sx={{ width: narrow ? "100%" : 320, flexShrink: 0, borderRight: narrow ? "none" : "1px solid #E0E3E7", minHeight: 0 }}>
          <ConversationList items={items} activeId={activeId} now={now} onSelect={(id) => onSelect(id)} onNew={() => onSelect(NEW_CHAT)} />
        </Box>
      )}
      {showThread && <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>{pane}</Box>}
    </Box>
  );
}
