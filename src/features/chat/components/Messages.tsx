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
import ErrorRounded from "@mui/icons-material/ErrorRounded";
import InsertDriveFileRounded from "@mui/icons-material/InsertDriveFileRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import StopCircleRounded from "@mui/icons-material/StopCircleRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import type { DriveFile } from "@/lib/drive/types";
import { driveContentUrl, driveViewUrl } from "@/lib/drive/links";
import { toastError } from "@/components/ui/Toast";
import { fileIcon } from "@/features/drive/components/DriveItems";
import { formatBytes, formatDateTime } from "@/features/drive/format";
import type { SkillSummary } from "@/features/skills/api";
import type { Chat, ChatAttachment, ChatMessage, ChatStep } from "../types";
import type { Member } from "@/features/tasks/types";
import { MemberAvatar } from "@/features/tasks/components/bits";
import { QuoteBlock, splitQuote } from "./Quote";
import { ImageThumbs, splitImages } from "../images";
import { ChatMarkdown } from "./Markdown";
import { FoldedSteps, LiveSteps } from "./Steps";
import { SkillChip, splitSkill } from "./Composer";

// The conversation (docs/CHAT.md → "UI" → Thread), Gemini-style (light): user bubbles on the right; answers as plain
// Markdown in the column with a row of small actions under them (copy, "Coba lagi", folded steps; time on hover) and
// attached files; the live run; messages not sent to the agent yet.

const textSx = {
  fontSize: "0.8125rem",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
} as const;

/** Shown when the pointer is over the message (Gemini shows no timestamps inline). */
const timeSx = {
  fontSize: "0.6875rem",
  color: "#5E5E5E",
  mt: 0.5,
  px: 0.5,
  opacity: 0,
  transition: "opacity .15s",
  "@media (hover: none)": { display: "none" },
} as const;

const actionSx = { color: "#444746", width: 26, height: 26, "&:hover": { bgcolor: "rgba(68,71,70,0.08)" } } as const;

/** The user's text; a leading "/name" of a known skill shows as its chip. */
function UserText({ content, skills }: { content: string; skills: SkillSummary[] }) {
  const { skill, text: afterSkill } = splitSkill(content, skills);
  const { quote, rest: text } = splitQuote(afterSkill);
  return (
    <>
      {skill && (
        <Box sx={{ mb: text.trim() ? 0.75 : 0, display: "flex" }}>
          <SkillChip skill={skill} />
        </Box>
      )}
      {quote && <QuoteBlock text={quote} />}
      {text.trim() && text}
    </>
  );
}

export function UserBubble({
  m,
  skills,
  author,
}: {
  m: ChatMessage;
  skills: SkillSummary[];
  author?: { name: string; member?: Member }; // shown in a shared chat
}) {
  const { text, images } = splitImages(m.content);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", "&:hover .msg-time": { opacity: 1 } }}>
      {author && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5, px: 0.5 }}>
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 500, color: "#444746" }}>{author.name}</Typography>
          <MemberAvatar member={author.member} size={16} />
        </Box>
      )}
      {images.length > 0 && (
        <Box sx={{ maxWidth: "min(85%, 600px)", mb: 0.75 }}>
          <ImageThumbs images={images} />
        </Box>
      )}
      <Box sx={{ maxWidth: "min(85%, 600px)", bgcolor: "#E9EEF6", color: "#1F1F1F", borderRadius: "18px 4px 18px 18px", px: 1.5, py: 1, ...textSx }}>
        <UserText content={text} skills={skills} />
      </Box>
      <Typography className="msg-time" suppressHydrationWarning sx={timeSx}>
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
        sx={actionSx}
      >
        {copied ? <CheckRounded sx={{ fontSize: 15, color: "#146C2E" }} /> : <ContentCopyRounded sx={{ fontSize: 14 }} />}
      </IconButton>
    </Tooltip>
  );
}

const fileBtnSx = { borderRadius: "9999px", color: "#0B57D0", textTransform: "none", fontWeight: 500, fontSize: "0.75rem", py: 0.25, "& .MuiButton-startIcon svg": { fontSize: 16 } } as const;

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
    <Box sx={{ width: "min(340px, 100%)", border: "1px solid #E3E3E3", borderRadius: "14px", overflow: "hidden", bgcolor: "#fff" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: "10px", bgcolor: "#F0F4F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon sx={{ fontSize: 19, color }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "#1F1F1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file?.name ?? att.name}
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "#444746" }}>{meta}</Typography>
        </Box>
      </Box>
      {file && !gone && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, px: 1, pb: 1 }}>
          <Button size="small" startIcon={<VisibilityRounded />} onClick={() => onPreview(file.id)} sx={fileBtnSx}>
            Pratinjau
          </Button>
          {gid && (
            <Button size="small" startIcon={<OpenInNewRounded />} href={driveViewUrl(gid)} target="_blank" rel="noopener noreferrer" sx={fileBtnSx}>
              Buka di Google Drive
            </Button>
          )}
          {gid && (
            <Button size="small" startIcon={<DownloadRounded />} href={driveContentUrl(file.id, true)} sx={fileBtnSx}>
              Download
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

/** Answer content lines up with the name, past the 20px logo + 6px gap. */
const AI_INDENT = "26px";

/** The answerer's name over each answer: the OpenCraft logo + "AI Ocraft". */
export function AiName() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
      <Box component="img" src="/ocraft-ai.png" alt="" sx={{ width: 20, height: 20, display: "block" }} />
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#1F1F1F" }}>AI Ocraft</Typography>
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
    <Box data-answer sx={{ minWidth: 0, "&:hover .msg-time": { opacity: 1 } }}>
      <AiName />
      <Box sx={{ pl: AI_INDENT, minWidth: 0 }}>
        {text && <ChatMarkdown text={text} bubbles />}
        {m.stopped && (
          <Box sx={{ mt: text ? 1.5 : 0, display: "inline-flex", alignItems: "center", gap: 0.5, color: "#444746", fontSize: "0.75rem" }}>
            <StopCircleRounded sx={{ fontSize: 15 }} />
            Dihentikan
          </Box>
        )}
        {m.error && (
          <Box sx={{ mt: text ? 1.5 : 0, display: "flex", alignItems: "flex-start", gap: 1, color: "#B3261E", minWidth: 0 }}>
            <ErrorRounded sx={{ fontSize: 16, mt: 0.2 }} />
            <Typography sx={{ fontSize: "0.8125rem", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.error}</Typography>
          </Box>
        )}
        {atts.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: text || m.error ? 1.25 : 0 }}>
            {atts.map((a) => (
              <FileCard key={a.file_id} att={a} file={files.get(a.file_id)} onPreview={onPreview} />
            ))}
          </Box>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.25, mt: 0.5, ml: -0.5 }}>
          {text && <CopyButton text={text} />}
          {onRetry && (
            <Button
                size="small"
                startIcon={<ReplayRounded sx={{ fontSize: "15px !important" }} />}
                onClick={onRetry}
                sx={{ borderRadius: "9999px", height: 26, px: 1, fontSize: "0.75rem", color: "#0B57D0", textTransform: "none", fontWeight: 500 }}
              >
                Coba lagi
              </Button>
          )}
          <FoldedSteps steps={m.steps ?? undefined} durationMs={m.duration_ms ?? undefined} />
          <Typography className="msg-time" suppressHydrationWarning sx={{ ...timeSx, mt: 0 }}>
            {formatDateTime(m.created_at)}
          </Typography>
        </Box>
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
      <AiName />
      <Box sx={{ pl: AI_INDENT, minWidth: 0 }}>
        <LiveSteps steps={steps} queued={queued && !chat.cancel_requested_at} startedAt={chat.started_at} />
        {text && (
          <Box sx={{ mt: 1.25 }}>
            <ChatMarkdown text={text} bubbles />
          </Box>
        )}
      </Box>
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
            borderRadius: "18px 4px 18px 18px",
            px: 1.5,
            py: 1,
            color: "#444746",
            ...textSx,
          }}
        >
          <UserText content={m.content} skills={skills} />
        </Box>
      ))}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Typography role="status" aria-live="polite" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.75rem", color: "#444746" }}>
          <ScheduleRounded sx={{ fontSize: 14 }} />
          {status}
        </Typography>
        {!running && (
          <Button
            size="small"
            disableElevation
            startIcon={<SendRounded sx={{ fontSize: "16px !important" }} />}
            disabled={sending}
            onClick={onSendNow}
            sx={{ borderRadius: "9999px", height: 28, px: 1.5, fontSize: "0.75rem", bgcolor: "#D3E3FD", color: "#041E49", textTransform: "none", fontWeight: 500, "&:hover": { bgcolor: "#C2D7FA" } }}
          >
            Kirim sekarang
          </Button>
        )}
      </Box>
    </Box>
  );
}
