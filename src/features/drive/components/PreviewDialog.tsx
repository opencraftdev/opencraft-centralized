"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import type { DriveFile } from "@/lib/drive/types";
import { toastError } from "@/components/ui/Toast";
import { getFileLinks, replyToJob, retryJob, DOC_TYPE_LABEL } from "../api";
import { fileIcon, isBusy, StatusBadge } from "./DriveItems";
import { formatBytes, formatDateTime } from "../format";

type Links = { viewUrl: string | null; downloadUrl: string | null };

function previewable(f: DriveFile): boolean {
  const mime = f.mime_type ?? "";
  return (
    mime === "application/pdf" ||
    mime.startsWith("image/") ||
    mime.startsWith("text/") ||
    f.name.toLowerCase().endsWith(".pdf")
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
}: {
  file: DriveFile | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [links, setLinks] = useState<Links | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const ready = file?.status === "ready";
  const linkKey = file && ready ? `${file.id}:${file.storage_path ?? ""}` : null;

  useEffect(() => {
    setLinks(null);
    if (!linkKey || !file) return;
    let cancelled = false;
    setLoadingLinks(true);
    getFileLinks(file.id)
      .then((l) => !cancelled && setLinks(l))
      .catch((e) => !cancelled && toastError((e as Error).message))
      .finally(() => !cancelled && setLoadingLinks(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey]);

  useEffect(() => {
    setReply("");
  }, [file?.id]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "end" });
  }, [file?.messages?.length, file?.status]);

  if (!file) return null;
  const { Icon, color } = fileIcon(file);
  const generated = file.source === "generated";
  const messages = file.messages ?? [];

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await replyToJob(file, reply);
      setReply("");
      onChanged();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

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
        <HelpOutlineRounded sx={{ fontSize: 44, color: "#B06000" }} />
        <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>Agen butuh jawaban Anda</Typography>
        <Typography sx={{ fontSize: "0.875rem", maxWidth: 460, whiteSpace: "pre-wrap" }}>{file.agent_message}</Typography>
      </Center>
    );
  } else if (file.status === "failed") {
    body = (
      <Center>
        <ErrorOutlineRounded sx={{ fontSize: 44, color: "#B3261E" }} />
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
  } else if (loadingLinks) {
    body = (
      <Center>
        <CircularProgress size={32} />
      </Center>
    );
  } else if (links?.viewUrl && previewable(file)) {
    body = (
      <Box
        component="iframe"
        src={links.viewUrl}
        title={file.name}
        sx={{ width: "100%", height: "100%", border: "none", bgcolor: "#fff", display: "block" }}
      />
    );
  } else {
    body = (
      <Center>
        <Icon sx={{ fontSize: 64, color }} />
        <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>
          {links?.viewUrl ? "Pratinjau tidak tersedia untuk file ini" : "File belum tersedia"}
        </Typography>
        {links?.downloadUrl && (
          <Button variant="contained" startIcon={<DownloadRounded />} href={links.downloadUrl} sx={{ borderRadius: "9999px" }}>
            Download
          </Button>
        )}
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, height: 56, flexShrink: 0 }}>
          <Icon sx={{ fontSize: 22, color }} />
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file.name}
          </Typography>
          <StatusBadge file={file} />
          {links?.viewUrl && (
            <Tooltip title="Buka di tab baru">
              <IconButton component="a" href={links.viewUrl} target="_blank" rel="noopener noreferrer">
                <OpenInNewRounded />
              </IconButton>
            </Tooltip>
          )}
          {links?.downloadUrl && (
            <Tooltip title="Download">
              <IconButton component="a" href={links.downloadUrl}>
                <DownloadRounded />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Tutup">
            <IconButton onClick={onClose}>
              <CloseRounded />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: "flex", gap: 1.5, px: 1.5, pb: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0, bgcolor: "#fff", borderRadius: "12px", overflow: "hidden" }}>{body}</Box>

          {/* side panel: details + conversation */}
          <Box
            sx={{
              width: 360,
              flexShrink: 0,
              bgcolor: "#fff",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: "1px solid #E0E3E7" }}>
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
            </Box>

            {generated ? (
              <>
                <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, px: 2.5, pt: 1.5 }}>Percakapan</Typography>
                <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, py: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                  {messages.map((m, i) => (
                    <Box
                      key={i}
                      sx={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "88%",
                        bgcolor: m.role === "user" ? "#D3E3FD" : "#F0F4F9",
                        color: "#1F1F1F",
                        borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        px: 1.5,
                        py: 1,
                      }}
                    >
                      <Typography sx={{ fontSize: "0.8125rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</Typography>
                      <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368", mt: 0.5 }} suppressHydrationWarning>
                        {m.role === "user" ? "Anda" : "Agen"} · {formatDateTime(m.at)}
                      </Typography>
                    </Box>
                  ))}
                  {isBusy(file) && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#5F6368", fontSize: "0.8125rem" }}>
                      <CircularProgress size={12} /> Agen sedang bekerja…
                    </Box>
                  )}
                  <div ref={chatEnd} />
                </Box>
                {file.status === "needs_input" && (
                  <Box sx={{ p: 1.5, borderTop: "1px solid #E0E3E7", display: "flex", gap: 1, alignItems: "flex-end" }}>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={6}
                      autoFocus
                      placeholder="Tulis jawaban…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: "20px" } }}
                    />
                    <IconButton color="primary" onClick={sendReply} disabled={sending || !reply.trim()} aria-label="Kirim">
                      {sending ? <CircularProgress size={18} /> : <SendRounded />}
                    </IconButton>
                  </Box>
                )}
                {file.status === "failed" && (
                  <Box sx={{ p: 1.5, borderTop: "1px solid #E0E3E7" }}>
                    <Button fullWidth variant="outlined" startIcon={<ReplayRounded />} onClick={retry} sx={{ borderRadius: "9999px" }}>
                      Coba lagi
                    </Button>
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{ flex: 1 }} />
            )}
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
