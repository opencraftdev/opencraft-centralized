"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import ChatBubbleRounded from "@mui/icons-material/ChatBubbleRounded";
import ErrorRounded from "@mui/icons-material/ErrorRounded";
import HelpRounded from "@mui/icons-material/HelpRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import type { DriveFile } from "@/lib/drive/types";
import { toastError } from "@/components/ui/Toast";
import { retryJob, DOC_TYPE_LABEL } from "../api";
import { driveContentUrl, driveViewUrl } from "@/lib/drive/links";
import { fileIcon, isBusy, StatusBadge } from "./DriveItems";
import { formatBytes, formatDateTime } from "../format";

// What the preview iframe can show (via /api/drive/files/:id/content): browser-native types, plus
// Google Docs/Sheets/Slides and Office files, which the server turns into PDF.
const OFFICE = /(officedocument|msword|ms-excel|ms-powerpoint)/;
function canPreview(mime: string | null, name: string) {
  const m = mime ?? "";
  return (
    /^(application\/pdf|image\/|video\/|audio\/|text\/(plain|csv))/.test(m) ||
    (m.startsWith("application/vnd.google-apps.") && !m.endsWith(".folder") && !m.endsWith(".shortcut")) ||
    OFFICE.test(m) ||
    /\.pdf$/i.test(name)
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        textAlign: "center",
        px: 4,
        color: "#444746",
      }}
    >
      {children}
    </Box>
  );
}

export function PreviewDialog({
  file,
  onClose,
  onChanged,
  files,
  onNavigate,
}: {
  file: DriveFile | null;
  onClose: () => void;
  onChanged: () => void;
  /** The set this file belongs to (e.g. one comment's attachments): adds ‹ › buttons and ←/→ keys. */
  files?: DriveFile[];
  onNavigate?: (f: DriveFile) => void;
}) {
  const [frameLoading, setFrameLoading] = useState(true);

  useEffect(() => {
    setFrameLoading(true);
  }, [file?.id, file?.google_file_id]);

  const set = files && onNavigate && file ? files : null;
  const idx = set && file ? set.findIndex((f) => f.id === file.id) : -1;
  const prev = set && idx > 0 ? set[idx - 1] : null;
  const next = set && idx >= 0 && idx < set.length - 1 ? set[idx + 1] : null;

  // ←/→ move through the set (not while typing, or while a video/audio player has the focus)
  useEffect(() => {
    if (!file || !set) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|VIDEO|AUDIO)$/.test(t.tagName))) return;
      const to = e.key === "ArrowLeft" ? prev : next;
      if (!to) return;
      e.preventDefault();
      onNavigate?.(to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, set, prev, next, onNavigate]);

  if (!file) return null;
  const { Icon, color } = fileIcon(file);
  const generated = file.source === "generated";
  const gid = file.status === "ready" ? file.google_file_id : null;

  const retry = async () => {
    try {
      await retryJob(file);
      onChanged();
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  let body: React.ReactNode;
  if (isBusy(file)) {
    body = (
      <Center>
        <CircularProgress size={36} sx={{ color: "#0B57D0" }} />
        <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#0B57D0" }}>Sedang dibuat…</Typography>
        <Typography sx={{ fontSize: "0.8125rem" }}>
          {file.status === "queued" ? "Menunggu giliran di antrean." : "Agen sedang menyusun dokumen."} Halaman ini
          akan memperbarui otomatis.
        </Typography>
      </Center>
    );
  } else if (file.status === "needs_input") {
    body = (
      <Center>
        <HelpRounded sx={{ fontSize: 44, color: "#B06000" }} />
        <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>Agen butuh jawaban Anda</Typography>
        <Typography sx={{ fontSize: "0.875rem", maxWidth: 460, whiteSpace: "pre-wrap" }}>{file.agent_message}</Typography>
      </Center>
    );
  } else if (file.status === "failed") {
    body = (
      <Center>
        <ErrorRounded sx={{ fontSize: 44, color: "#B3261E" }} />
        <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>Gagal dibuat</Typography>
        <Typography sx={{ fontSize: "0.8125rem", maxWidth: 460, whiteSpace: "pre-wrap" }}>
          {file.error_msg || "Terjadi kesalahan."}
        </Typography>
        {generated && (
          <Button variant="contained" startIcon={<ReplayRounded />} onClick={retry} sx={{ borderRadius: "9999px", mt: 1 }}>
            Coba lagi
          </Button>
        )}
      </Center>
    );
  } else if (gid && canPreview(file.mime_type, file.name)) {
    body = (
      <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
        {frameLoading && (
          <Box sx={{ position: "absolute", inset: 0 }}>
            <Center>
              <CircularProgress size={32} sx={{ color: "#0B57D0" }} />
              <Typography sx={{ fontSize: "0.8125rem" }}>Memuat pratinjau…</Typography>
            </Center>
          </Box>
        )}
        {/^image\/(png|jpeg|gif|webp|avif|bmp)/.test(file.mime_type ?? "") ? (
          // Images: fit the whole picture inside the preview area.
          <Box
            component="img"
            key={gid}
            src={driveContentUrl(file.id)}
            alt={file.name}
            onLoad={() => setFrameLoading(false)}
            onError={() => setFrameLoading(false)}
            sx={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", display: "block", p: 2, boxSizing: "border-box" }}
          />
        ) : (file.mime_type ?? "").startsWith("video/") ? (
          <Box
            component="video"
            key={gid}
            src={driveContentUrl(file.id)}
            controls
            playsInline
            onLoadedData={() => setFrameLoading(false)}
            onError={() => setFrameLoading(false)}
            sx={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", display: "block", bgcolor: "#000" }}
          />
        ) : (
          <Box
            component="iframe"
            key={gid}
            src={driveContentUrl(file.id)}
            title={file.name}
            onLoad={() => setFrameLoading(false)}
            sx={{ position: "relative", width: "100%", height: "100%", border: "none", bgcolor: "transparent", display: "block" }}
          />
        )}
      </Box>
    );
  } else if (gid) {
    body = (
      <Center>
        <Icon sx={{ fontSize: 64, color }} />
        <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>Pratinjau tidak tersedia untuk jenis file ini</Typography>
        <Typography sx={{ fontSize: "0.8125rem" }}>Unduh file atau buka di Google Drive.</Typography>
      </Center>
    );
  } else {
    body = (
      <Center>
        <Icon sx={{ fontSize: 64, color }} />
        <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>File belum tersedia</Typography>
      </Center>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth={false}
      slotProps={{ paper: { sx: { width: "min(1280px, 94vw)", height: "90vh", m: 2, borderRadius: "16px", overflow: "hidden" } } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "#F0F4F9" }}>
        {/* header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1.5 }, pl: 2, pr: { xs: 0.5, sm: 2 }, height: 56, flexShrink: 0 }}>
          <Icon sx={{ fontSize: 22, color }} />
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file.name}
          </Typography>
          {set && set.length > 1 && (
            <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
              {idx + 1} / {set.length}
            </Typography>
          )}
          <StatusBadge file={file} />
          {gid && (
            <>
              <Button
                size="small"
                startIcon={<OpenInNewRounded />}
                href={driveViewUrl(gid)}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ borderRadius: "9999px", flexShrink: 0, display: { xs: "none", sm: "inline-flex" } }}
              >
                Buka di Google Drive
              </Button>
              <IconButton
                href={driveViewUrl(gid)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buka di Google Drive"
                sx={{ display: { xs: "inline-flex", sm: "none" } }}
              >
                <OpenInNewRounded />
              </IconButton>
              <Button
                size="small"
                variant="contained"
                disableElevation
                startIcon={<DownloadRounded />}
                href={driveContentUrl(file.id, true)}
                sx={{ borderRadius: "9999px", flexShrink: 0, display: { xs: "none", sm: "inline-flex" } }}
              >
                Download
              </Button>
              <IconButton href={driveContentUrl(file.id, true)} aria-label="Download" sx={{ display: { xs: "inline-flex", sm: "none" } }}>
                <DownloadRounded />
              </IconButton>
            </>
          )}
          <Tooltip title="Tutup">
            <IconButton onClick={onClose} aria-label="Tutup">
              <CloseRounded />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: "flex", gap: 1.5, px: 1.5, pb: 1.5 }}>
          <Box sx={{ position: "relative", flex: 1, minWidth: 0, bgcolor: "#fff", borderRadius: "12px", overflow: "hidden", "&:hover .pv-nav": { opacity: 1 } }}>
            <Box key={file.id} sx={{ height: "100%", animation: "oc-rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
              {body}
            </Box>
            {set && set.length > 1 && (
              <>
                <NavArrow side="left" disabled={!prev} onClick={() => prev && onNavigate?.(prev)} />
                <NavArrow side="right" disabled={!next} onClick={() => next && onNavigate?.(next)} />
              </>
            )}
          </Box>

          {/* side panel: details (hidden on small screens, where the file gets the whole width) */}
          <Box
            sx={{
              width: 320,
              flexShrink: 0,
              bgcolor: "#fff",
              borderRadius: "12px",
              display: { xs: "none", md: "flex" },
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, mb: 1 }}>Detail</Typography>
              {[
                ["Jenis", file.doc_type ? DOC_TYPE_LABEL[file.doc_type] : file.mime_type ?? "—"],
                ["Nomor", file.doc_number],
                ["Ukuran", file.size_bytes != null ? formatBytes(file.size_bytes) : null],
                ["Dibuat", formatDateTime(file.created_at)],
                ["Diubah", formatDateTime(file.updated_at)],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <Box key={k} sx={{ display: "flex", gap: 1, fontSize: "0.8125rem", py: 0.25 }}>
                    <Typography sx={{ width: 64, fontSize: "inherit", color: "#5F6368" }}>{k}</Typography>
                    <Typography sx={{ flex: 1, fontSize: "inherit", wordBreak: "break-word" }} suppressHydrationWarning>
                      {v}
                    </Typography>
                  </Box>
                ))}
              {file.chat_id && (
                <Button
                  component={Link}
                  href={`/chat/${file.chat_id}`}
                  size="small"
                  variant="outlined"
                  startIcon={<ChatBubbleRounded />}
                  sx={{ borderRadius: "9999px", mt: 1.5 }}
                >
                  Buka chat
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}

/** ‹ / › over the preview: previous / next file of the set. */
function NavArrow({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const label = side === "left" ? "File sebelumnya (←)" : "File berikutnya (→)";
  return (
    <Tooltip title={disabled ? "" : label}>
      <span style={{ position: "absolute", top: "50%", [side]: 12, transform: "translateY(-50%)", zIndex: 2 }}>
        <IconButton
          className="pv-nav"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          sx={{
            width: 44,
            height: 44,
            bgcolor: "rgba(255,255,255,.92)",
            color: "#1F1F1F",
            boxShadow: "0 2px 10px rgba(0,0,0,.18)",
            opacity: { xs: 1, md: 0.85 },
            transition: "opacity 150ms, transform 150ms",
            "&:hover": { bgcolor: "#fff", transform: "scale(1.06)" },
            "&.Mui-disabled": { opacity: 0, pointerEvents: "none" },
          }}
        >
          {side === "left" ? <ChevronLeftRounded sx={{ fontSize: 28 }} /> : <ChevronRightRounded sx={{ fontSize: 28 }} />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
