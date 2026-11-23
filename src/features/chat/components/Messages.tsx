"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import InsertDriveFileRounded from "@mui/icons-material/InsertDriveFileRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import StopCircleOutlined from "@mui/icons-material/StopCircleOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import type { DriveFile } from "@/lib/drive/types";
import { driveContentUrl, driveViewUrl } from "@/lib/drive/links";
import { toastError } from "@/components/ui/Toast";
import { fileIcon } from "@/features/drive/components/DriveItems";
import { formatBytes, formatDateTime } from "@/features/drive/format";
import type { SkillSummary } from "@/features/skills/api";
import type { Chat, ChatAttachment, ChatMessage, ChatStep } from "../types";
import { ChatMarkdown } from "./Markdown";
import { FoldedSteps, LiveSteps } from "./Steps";
import { SkillChip, splitSkill } from "./Composer";

// The conversation (docs/CHAT.md → "UI" → Thread): user bubbles; answers as Markdown in the column with folded steps,
// copy, time and attached files; the live run; messages not sent to the agent yet.

const textSx = {
  fontSize: "0.9375rem",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
} as const;

/** The user's text; a leading "/name" of a known skill shows as its chip. */
function UserText({ content, skills }: { content: string; skills: SkillSummary[] }) {
  const { skill, text } = splitSkill(content, skills);
  return (
    <>
      {skill && (
        <Box sx={{ mb: text.trim() ? 0.75 : 0, display: "flex" }}>
          <SkillChip skill={skill} />
        </Box>
      )}
      {text.trim() && text}
    </>
  );
}

export function UserBubble({ m, skills }: { m: ChatMessage; skills: SkillSummary[] }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <Box sx={{ maxWidth: "min(85%, 600px)", bgcolor: "#E9EEF6", color: "#1F1F1F", borderRadius: "20px 20px 6px 20px", px: 2, py: 1.25, ...textSx }}>
        <UserText content={m.content} skills={skills} />
      </Box>
      <Typography suppressHydrationWarning sx={{ fontSize: "0.6875rem", color: "#5F6368", mt: 0.5, px: 0.5 }}>
        {formatDateTime(m.created_at)}
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

/** An attached file: same actions as the Drive file card (Pratinjau, Buka di Google Drive, Download). */
export function FileCard({ att, file, onPreview }: { att: ChatAttachment; file: DriveFile | undefined; onPreview: (id: string) => void }) {
  const { Icon, color } = file ? fileIcon(file) : { Icon: InsertDriveFileRounded, color: "#5F6368" };
  const gid = file?.google_file_id ?? null;
  const gone = Boolean(file?.trashed_at);
  const meta = file
    ? gone
      ? "Ada di Sampah"
      : [file.doc_number, file.size_bytes != null ? formatBytes(file.size_bytes) : null].filter(Boolean).join(" · ") || "Tersimpan di Drive"
    : "Memuat…";
  return (
    <Box sx={{ width: "min(440px, 100%)", border: "1px solid #E0E3E7", borderRadius: "14px", overflow: "hidden", bgcolor: "#fff" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "#F0F4F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon sx={{ fontSize: 24, color }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file?.name ?? att.name}
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>{meta}</Typography>
        </Box>
      </Box>
      {file && !gone && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, px: 1, pb: 1 }}>
          <Button size="small" startIcon={<VisibilityOutlined />} onClick={() => onPreview(file.id)} sx={{ borderRadius: "9999px" }}>
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
      )}
    </Box>
  );
}

/** An answer: Markdown in the column (no bubble), attached files, then folded steps, copy, time. */
export function AssistantMessage({
  m,
  files,
  onPreview,
  onRetry,
}: {
  m: ChatMessage;
  files: Map<string, DriveFile>;
  onPreview: (id: string) => void;
  onRetry?: () => void; // the newest answer of a failed chat
}) {
  const text = m.content?.trim() ?? "";
  const atts = m.attachments ?? [];
  return (
    <Box sx={{ minWidth: 0 }}>
      {text && <ChatMarkdown text={text} />}
      {m.stopped && (
        <Box sx={{ mt: text ? 1 : 0, display: "inline-flex", alignItems: "center", gap: 0.5, color: "#5F6368", fontSize: "0.8125rem" }}>
          <StopCircleOutlined sx={{ fontSize: 16 }} />
          Dihentikan
        </Box>
      )}
      {m.error && (
        <Box sx={{ mt: text ? 1.25 : 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, color: "#B3261E", minWidth: 0 }}>
            <ErrorOutlineRounded sx={{ fontSize: 18, mt: 0.15 }} />
            <Typography sx={{ fontSize: "0.875rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.error}</Typography>
          </Box>
          {onRetry && (
            <Button size="small" variant="outlined" startIcon={<ReplayRounded />} onClick={onRetry} sx={{ borderRadius: "9999px", height: 30 }}>
              Coba lagi
            </Button>
          )}
        </Box>
      )}
      {atts.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: text || m.error ? 1.5 : 0 }}>
          {atts.map((a) => (
            <FileCard key={a.file_id} att={a} file={files.get(a.file_id)} onPreview={onPreview} />
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5, mt: 0.75, ml: -0.5 }}>
        <FoldedSteps steps={m.steps ?? undefined} durationMs={m.duration_ms ?? undefined} />
        {text && <CopyButton text={text} />}
        <Typography suppressHydrationWarning sx={{ fontSize: "0.6875rem", color: "#9AA0A6", px: 0.5 }}>
          {formatDateTime(m.created_at)}
        </Typography>
      </Box>
    </Box>
  );
}

/** The run in progress: "Menunggu giliran…" while queued, else live steps + elapsed time + the reply so far. */
export function LiveAnswer({ chat }: { chat: Chat }) {
  const queued = chat.status === "queued";
  const steps: ChatStep[] = useMemo(() => {
    const list = chat.run_steps ?? [];
    return chat.cancel_requested_at ? [...list, { label: "Menghentikan…", at: chat.cancel_requested_at }] : list;
  }, [chat.run_steps, chat.cancel_requested_at]);
  const text = queued ? "" : chat.stream_text?.trim() ?? "";
  return (
    <Box sx={{ minWidth: 0 }}>
      <LiveSteps steps={steps} queued={queued && !chat.cancel_requested_at} startedAt={chat.started_at} />
      {text && (
        <Box sx={{ mt: 1.5 }}>
          <ChatMarkdown text={text} />
        </Box>
      )}
    </Box>
  );
}

/** User messages the agent has not received yet: waiting for the running answer, or held after a stop / failure. */
export function PendingMessages({
  items,
  running,
  skills,
  sending,
  onSendNow,
}: {
  items: ChatMessage[];
  running: boolean;
  skills: SkillSummary[];
  sending: boolean;
  onSendNow: () => void;
}) {
  if (!items.length) return null;
  const status = running
    ? items.length > 1
      ? `${items.length} pesan menunggu jawaban selesai`
      : "Menunggu jawaban selesai"
    : items.length > 1
      ? `${items.length} pesan belum terkirim`
      : "Belum terkirim";
  return (
    <Box component="section" aria-label="Pesan menunggu" sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
      {items.map((m) => (
        <Box
          key={m.id}
          sx={{
            maxWidth: "min(85%, 600px)",
            border: "1px dashed #C4C7C5",
            borderRadius: "20px 20px 6px 20px",
            px: 2,
            py: 1.25,
            color: "#444746",
            ...textSx,
          }}
        >
          <UserText content={m.content} skills={skills} />
        </Box>
      ))}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Typography role="status" aria-live="polite" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.75rem", color: "#5F6368" }}>
          <ScheduleRounded sx={{ fontSize: 14 }} />
          {status}
        </Typography>
        {!running && (
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<SendRounded sx={{ fontSize: "16px !important" }} />}
            disabled={sending}
            onClick={onSendNow}
            sx={{ borderRadius: "9999px", height: 28 }}
          >
            Kirim sekarang
          </Button>
        )}
      </Box>
    </Box>
  );
}
