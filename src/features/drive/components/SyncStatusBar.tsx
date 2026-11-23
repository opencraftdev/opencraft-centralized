"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloudDoneOutlined from "@mui/icons-material/CloudDoneOutlined";
import CloudSyncOutlined from "@mui/icons-material/CloudSyncOutlined";
import SyncProblemOutlined from "@mui/icons-material/SyncProblemOutlined";
import SyncRounded from "@mui/icons-material/SyncRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import type { DriveSyncState } from "@/lib/drive/types";
import { driveFolderUrl } from "@/lib/drive/links";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { fetchSyncState, requestSync } from "../api";
import { formatDateTime, formatRelative } from "../format";

const REFRESH_MS = 15_000;
const WAIT_POLL_MS = 2_000;
const WAIT_MAX_MS = 60_000;
const STALE_MS = 3 * 60_000;

// "Tersinkron dengan Google Drive · 2 mnt lalu" + "Sinkronkan sekarang" + "Buka di Google Drive"
// (docs/DRIVE.md → "Sync status in the UI").
export function SyncStatusBar({
  googleFolderId,
  onSynced,
}: {
  googleFolderId: string | null; // current folder's Google folder; null = root
  onSynced: () => void;
}) {
  const [state, setState] = useState<DriveSyncState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [waiting, setWaiting] = useState(false);
  const waitRef = useRef<{ requestedAt: number; since: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await fetchSyncState();
      setState(s);
      setNow(Date.now());
      return s;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // While a requested sync is pending: poll until last_sync_at passes the request (or 60 s), then refresh files.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      const w = waitRef.current;
      if (!w) return;
      const s = await load();
      const done = s?.last_sync_at && new Date(s.last_sync_at).getTime() >= w.requestedAt;
      const timedOut = Date.now() - w.since > WAIT_MAX_MS;
      if (done || timedOut) {
        waitRef.current = null;
        setWaiting(false);
        onSynced();
        if (done) toastSuccess("Tersinkron dengan Google Drive");
      }
    }, WAIT_POLL_MS);
    return () => clearInterval(t);
  }, [waiting, load, onSynced]);

  const syncNow = async () => {
    if (waiting) return;
    try {
      const at = await requestSync();
      waitRef.current = { requestedAt: new Date(at).getTime(), since: Date.now() };
      setWaiting(true);
    } catch (e) {
      toastError((e as Error).message);
    }
  };

  const last = state?.last_sync_at ?? null;
  const stale = !last || now - new Date(last).getTime() > STALE_MS;
  const warn = Boolean(state?.last_error) || stale;
  const folderId = googleFolderId ?? state?.root_folder_id ?? null;

  const label = waiting
    ? "Menyinkronkan dengan Google Drive…"
    : state?.last_error
      ? "Sinkronisasi Google Drive bermasalah"
      : last
        ? `Tersinkron dengan Google Drive · ${formatRelative(last, now)}`
        : "Belum pernah tersinkron dengan Google Drive";
  const tip = [
    state?.last_error && `Error: ${state.last_error}`,
    last && `Sinkron terakhir: ${formatDateTime(last)}`,
    state?.last_sync_summary && `Perubahan: ${state.last_sync_summary}`,
    !state?.last_error && stale && last && "Sinkron terakhir lebih dari 3 menit lalu.",
  ]
    .filter(Boolean)
    .join("\n");

  const Icon = waiting ? CloudSyncOutlined : warn ? SyncProblemOutlined : CloudDoneOutlined;
  const fg = waiting ? "#0B57D0" : warn ? "#8A5300" : "#146C2E";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap", minWidth: 0 }}>
      <Tooltip
        title={tip ? <span style={{ whiteSpace: "pre-line" }}>{tip}</span> : ""}
        slotProps={{ tooltip: { sx: { maxWidth: 420 } } }}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            height: 28,
            px: 1.25,
            borderRadius: "9999px",
            bgcolor: waiting ? "#E8F0FE" : warn ? "#FEF3D6" : "#E6F4EA",
            color: fg,
            minWidth: 0,
            cursor: tip ? "help" : "default",
          }}
        >
          <Icon sx={{ fontSize: 17, flexShrink: 0 }} />
          <Typography
            suppressHydrationWarning
            sx={{ fontSize: "0.8125rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {state ? label : "Memuat status sinkron…"}
          </Typography>
        </Box>
      </Tooltip>
      <Button
        size="small"
        onClick={syncNow}
        disabled={waiting}
        startIcon={waiting ? <CircularProgress size={14} /> : <SyncRounded />}
        sx={{ borderRadius: "9999px", color: "#0B57D0", flexShrink: 0 }}
      >
        Sinkronkan sekarang
      </Button>
      {folderId && (
        <Button
          size="small"
          href={driveFolderUrl(folderId)}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewRounded />}
          sx={{ borderRadius: "9999px", color: "#444746", flexShrink: 0 }}
        >
          Buka di Google Drive
        </Button>
      )}
    </Box>
  );
}
