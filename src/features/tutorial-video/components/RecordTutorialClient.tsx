"use client";

import { useCallback, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import MovieOutlined from "@mui/icons-material/MovieOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import { CreditsMeter } from "./CreditsMeter";
import { RecorderDownload } from "./RecorderDownload";
import { RecentRenders } from "./RecentRenders";
import { PRESENTERS, DEFAULT_PRESENTER_ID } from "../presenters";
import type { CreditUsage, TutorialVideoRow, UploadSignature } from "../types";

const MAX_BYTES = 100 * 1024 * 1024; // single-request Cloudinary upload ceiling
const POLL_MS = 4000;
const MAX_POLLS = 200; // ~13 min safety cap

type Phase = "idle" | "uploading" | "rendering" | "done" | "error";

const CARD_SX = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid #E8EAED",
} as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Direct, signed upload to Cloudinary with progress (XHR — fetch can't report
// upload progress). The file never touches our serverless function.
function uploadToCloudinary(
  file: File,
  sign: UploadSignature,
  onProgress: (fraction: number) => void,
): Promise<{ publicId: string; duration?: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sign.apiKey);
    form.append("timestamp", String(sign.timestamp));
    form.append("folder", sign.folder);
    form.append("signature", sign.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve({ publicId: json.public_id, duration: json.duration });
        } catch {
          reject(new Error("Could not parse Cloudinary response"));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(form);
  });
}

export function RecordTutorialClient({
  initialVideos,
  initialUsage,
}: {
  initialVideos: TutorialVideoRow[];
  initialUsage: CreditUsage | null;
}) {
  const [title, setTitle] = useState("");
  const [presenterId, setPresenterId] = useState(DEFAULT_PRESENTER_ID);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<TutorialVideoRow | null>(null);
  const [videos, setVideos] = useState<TutorialVideoRow[]>(initialVideos);
  const [usage, setUsage] = useState<CreditUsage | null>(initialUsage);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "uploading" || phase === "rendering";

  const refreshSidebars = useCallback(async () => {
    try {
      const [vRes, uRes] = await Promise.all([
        fetch("/api/tutorial-video"),
        fetch("/api/tutorial-video/usage"),
      ]);
      if (vRes.ok) setVideos((await vRes.json()).videos ?? []);
      if (uRes.ok) setUsage((await uRes.json()).usage ?? null);
    } catch {
      /* non-critical */
    }
  }, []);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setErrorMsg("Please choose a video file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setErrorMsg("File is over 100 MB — please trim or compress it first.");
      return;
    }
    setErrorMsg(null);
    setFile(f);
  };

  const start = async () => {
    if (!file || !presenterId || !title.trim()) return;
    setErrorMsg(null);
    setResult(null);
    setUploadPct(0);
    setPhase("uploading");

    try {
      // 1. Signature for the direct upload.
      const signRes = await fetch("/api/tutorial-video/sign", { method: "POST" });
      if (!signRes.ok) throw new Error((await signRes.json()).error ?? "Could not sign upload");
      const sign = (await signRes.json()) as UploadSignature;

      // 2. Upload straight to Cloudinary.
      const { publicId, duration } = await uploadToCloudinary(file, sign, setUploadPct);

      // 3. Kick off the render + record the job.
      setPhase("rendering");
      const createRes = await fetch("/api/tutorial-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePublicId: publicId, presenterId, title: title.trim(), duration }),
      });
      if (!createRes.ok) throw new Error((await createRes.json()).error ?? "Could not start render");
      const { id } = (await createRes.json()) as { id: string };

      // 4. Poll until the render finishes.
      for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_MS);
        const sRes = await fetch(`/api/tutorial-video/${id}`);
        if (!sRes.ok) continue;
        const v = (await sRes.json()).video as TutorialVideoRow;
        if (v.status === "done") {
          setResult(v);
          setPhase("done");
          setFile(null);
          await refreshSidebars();
          return;
        }
        if (v.status === "failed") {
          throw new Error(v.error ?? "Render failed");
        }
      }
      throw new Error("Render timed out — check the recent renders list shortly.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setPhase("error");
      await refreshSidebars();
    }
  };

  const cleanup = async (id: string) => {
    await fetch(`/api/tutorial-video/${id}`, { method: "DELETE" });
    setResult(null);
    setPhase("idle");
    await refreshSidebars();
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
    setUploadPct(0);
    setTitle("");
  };

  // The right column lists only finished renders.
  const completedVideos = videos.filter((v) => v.status === "done");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        alignItems: "flex-start",
        gap: 3,
      }}
    >
      {/* LEFT: credits + create */}
      <Box sx={{ width: "100%", flex: { md: "1 1 0" }, minWidth: 0 }}>
        <Box sx={{ mb: 2 }}>
          <CreditsMeter usage={usage} />
        </Box>

        {/* Upload / render card */}
        <Box sx={{ ...CARD_SX, p: { xs: 2, md: 3 } }}>
        {(phase === "idle" || phase === "error") && (
          <>
            <TextField
              label="Video title"
              placeholder="e.g. How to deploy on Vercel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              size="small"
              autoFocus
              sx={{ mb: 2 }}
            />
            <TextField
              select
              label="Presenter shown on the opening (bottom-left)"
              value={presenterId}
              onChange={(e) => setPresenterId(e.target.value)}
              fullWidth
              size="small"
              disabled={!title.trim()}
              helperText={!title.trim() ? "Enter a title first" : undefined}
              sx={{ mb: 2 }}
            >
              {PRESENTERS.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} · {p.handle}
                </MenuItem>
              ))}
            </TextField>

            {/* Setting up screen recording = download the desktop recorder. */}
            <RecorderDownload
              title={title}
              presenterName={PRESENTERS.find((p) => p.id === presenterId)?.name ?? ""}
              presenterHandle={PRESENTERS.find((p) => p.id === presenterId)?.handle ?? ""}
            />

            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#5f6368", letterSpacing: "0.04em", mb: 1 }}>
              UPLOAD YOUR RECORDING
            </Typography>
            <Box
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              sx={{
                border: "2px dashed",
                borderColor: dragOver ? "#0B57D0" : "#DADCE0",
                borderRadius: "12px",
                bgcolor: dragOver ? "#F0F6FF" : "#FAFBFC",
                p: 4,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 120ms",
              }}
            >
              <CloudUploadOutlined sx={{ fontSize: 40, color: "#5f6368", mb: 1 }} />
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#1F1F1F" }}>
                {file ? file.name : "Drop your tutorial recording here, or click to browse"}
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mt: 0.5 }}>
                MP4 / MOV / WebM · up to 100 MB
              </Typography>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </Box>

            {errorMsg && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errorMsg}
              </Alert>
            )}

            <Box sx={{ display: "flex", gap: 1.5, mt: 2.5 }}>
              <Button
                variant="contained"
                disableElevation
                disabled={!title.trim() || !file || !presenterId}
                onClick={start}
                startIcon={<MovieOutlined />}
                sx={{
                  bgcolor: "#0B57D0",
                  borderRadius: "9999px",
                  textTransform: "none",
                  fontWeight: 600,
                  px: 3,
                  "&:hover": { bgcolor: "#0A4BB8" },
                }}
              >
                Render video
              </Button>
              {file && (
                <Button
                  onClick={() => setFile(null)}
                  sx={{ textTransform: "none", color: "#5f6368", borderRadius: "9999px" }}
                >
                  Clear
                </Button>
              )}
            </Box>
          </>
        )}

        {phase === "uploading" && (
          <Box sx={{ py: 2 }}>
            <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, mb: 1 }}>
              Uploading… {Math.round(uploadPct * 100)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={uploadPct * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                "& .MuiLinearProgress-bar": { bgcolor: "#0B57D0" },
              }}
            />
          </Box>
        )}

        {phase === "rendering" && (
          <Box sx={{ py: 2 }}>
            <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, mb: 1 }}>
              Rendering on Cloudinary — adding your name, logo and outro…
            </Typography>
            <LinearProgress
              sx={{ height: 8, borderRadius: 4, "& .MuiLinearProgress-bar": { bgcolor: "#0B57D0" } }}
            />
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mt: 1 }}>
              This can take a minute or two depending on length. You can leave this tab open.
            </Typography>
          </Box>
        )}

        {phase === "done" && result?.output_url && (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Done! Your branded tutorial is ready.
            </Alert>
            <Box
              component="video"
              src={result.output_url}
              controls
              sx={{
                display: "block",
                mx: "auto",
                height: "min(60vh, 520px)",
                aspectRatio: "9 / 16",
                borderRadius: "12px",
                bgcolor: "#000",
              }}
            />
            <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
              <Button
                component="a"
                href={result.output_url}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                disableElevation
                startIcon={<DownloadOutlined />}
                sx={{
                  bgcolor: "#0B57D0",
                  borderRadius: "9999px",
                  textTransform: "none",
                  fontWeight: 600,
                  px: 3,
                  "&:hover": { bgcolor: "#0A4BB8" },
                }}
              >
                Download MP4
              </Button>
              <Button
                onClick={() => cleanup(result.id)}
                startIcon={<DeleteOutlined />}
                sx={{ textTransform: "none", color: "#5f6368", borderRadius: "9999px" }}
              >
                Delete from Cloudinary (free credits)
              </Button>
              <Button
                onClick={reset}
                sx={{ textTransform: "none", color: "#0B57D0", borderRadius: "9999px" }}
              >
                Render another
              </Button>
            </Box>
            <Typography sx={{ fontSize: "0.75rem", color: "#5f6368", mt: 1.5 }}>
              Tip: download the file, then delete it from Cloudinary and post natively to your
              platform — that keeps you inside the free tier.
            </Typography>
          </Box>
        )}
        </Box>
      </Box>

      {/* RIGHT: completed renders only — folders per presenter, Drive-style */}
      <Box sx={{ width: "100%", flex: { md: "1 1 0" }, minWidth: 0 }}>
        <Box sx={{ ...CARD_SX, p: { xs: 2, md: 3 } }}>
          <RecentRenders videos={completedVideos} onChanged={refreshSidebars} />
        </Box>
      </Box>
    </Box>
  );
}
