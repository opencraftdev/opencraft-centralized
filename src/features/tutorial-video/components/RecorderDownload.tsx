"use client";

import { useCallback, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import DesktopWindowsOutlined from "@mui/icons-material/DesktopWindowsOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import LaunchOutlined from "@mui/icons-material/LaunchOutlined";

// One "Set up recording" button. On click we fire the desktop app's custom URL
// scheme — carrying the title/presenter the user chose here — and watch for the
// tab losing focus (the OS launching the app). If that doesn't happen quickly the
// app isn't installed → pop a modal and start the download. The button is
// disabled until a title is entered (nothing chosen → nothing to record).
const DEEP_LINK_BASE = process.env.NEXT_PUBLIC_RECORDER_DEEP_LINK || "opencraft-recorder://record";
const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_RECORDER_DOWNLOAD_URL ||
  "https://github.com/opencraftdev/opencraft-recorder/releases/latest/download/opencraft-recorder-mac-arm64.dmg";
const LAUNCH_TIMEOUT_MS = 1500;

function startDownload() {
  const a = document.createElement("a");
  a.href = DOWNLOAD_URL;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function RecorderDownload({
  title,
  presenterName,
  presenterHandle,
}: {
  title: string;
  presenterName: string;
  presenterHandle: string;
}) {
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const doneRef = useRef(false);

  const ready = title.trim().length > 0;

  const buildDeepLink = () =>
    `${DEEP_LINK_BASE}?title=${encodeURIComponent(title.trim())}` +
    `&presenter=${encodeURIComponent(presenterName)}` +
    `&handle=${encodeURIComponent(presenterHandle)}`;

  const setup = useCallback(() => {
    if (!ready) return;
    setSearching(true);
    doneRef.current = false;

    let timer = 0;
    const teardown = () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.clearTimeout(timer);
    };
    const succeed = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      teardown();
      setSearching(false);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") succeed();
    };
    const onBlur = () => succeed();

    timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      teardown();
      setSearching(false);
      setOpen(true); // not found → show modal + start download
      startDownload();
    }, LAUNCH_TIMEOUT_MS);

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.location.href = buildDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, title, presenterName, presenterHandle]);

  return (
    <>
      <Box
        sx={{
          borderRadius: "12px",
          border: "1px solid #C7D7F5",
          bgcolor: "#F0F6FF",
          p: { xs: 2, md: 2.5 },
          mb: 2,
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <DesktopWindowsOutlined sx={{ color: "#0B57D0", fontSize: 28 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: "#1F1F1F" }}>
            Set up screen recording
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
            {ready ? "Records screen + webcam in the desktop app." : "Enter a title first."}
          </Typography>
        </Box>
        <Button
          onClick={setup}
          disabled={!ready || searching}
          variant="contained"
          disableElevation
          startIcon={<LaunchOutlined />}
          sx={{
            bgcolor: "#0B57D0",
            borderRadius: "9999px",
            textTransform: "none",
            fontWeight: 600,
            px: 3,
            "&:hover": { bgcolor: "#0A4BB8" },
            "&.Mui-disabled": { bgcolor: "#C7D3E8", color: "#fff" },
          }}
        >
          {searching ? "Searching…" : "Set up recording"}
        </Button>
      </Box>

      {/* Not found → modal + the download has already started. */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: "16px", p: 1 } } }}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: "1.0625rem" }}>Recorder app not found</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.875rem", color: "#3C4043" }}>
            Your download is starting. Install the app (right-click → Open the first time), then
            click <strong>Set up recording</strong> again.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ textTransform: "none", color: "#5f6368", borderRadius: "9999px" }}>
            Close
          </Button>
          <Button
            onClick={startDownload}
            variant="contained"
            disableElevation
            startIcon={<DownloadOutlined />}
            sx={{ bgcolor: "#0B57D0", borderRadius: "9999px", textTransform: "none", fontWeight: 600, px: 3, "&:hover": { bgcolor: "#0A4BB8" } }}
          >
            Download again
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
