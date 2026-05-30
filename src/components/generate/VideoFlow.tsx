"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import MuiButton from "@mui/material/Button";
import { Button } from "@/components/ui/Button";
import { JobProgressStream } from "./JobProgressStream";

interface ScoredVideo {
  videoId: string;
  url: string;
  channelTitle: string;
  channelHandle?: string;
  videoTitle: string;
  publishedAt: string;
  durationSec: number;
  score: number;
}

interface VideoFlowProps {
  postId: number;
  onCompleted: () => void;
}

type Step = "idle" | "curating" | "pick" | "running" | "done" | "error";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoFlow({ postId, onCompleted }: VideoFlowProps) {
  const [step, setStep] = useState<Step>("idle");
  const [shortList, setShortList] = useState<ScoredVideo[]>([]);
  const [selected, setSelected] = useState<ScoredVideo | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCurate = async () => {
    setStep("curating");
    setError(null);
    try {
      const res = await fetch("/api/generate/video/curate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Curation failed");
      setShortList(data.shortList ?? []);
      setStep("pick");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStep("error");
    }
  };

  const handleStart = async () => {
    if (!selected) return;
    setStep("running");
    setError(null);
    try {
      const res = await fetch("/api/generate/video/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          videoId: selected.videoId,
          videoTitle: selected.videoTitle,
          videoUrl: selected.url,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.jobId) {
        setJobId(data.jobId);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Start failed");
      setJobId(data.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStep("error");
    }
  };

  const handleStreamDone = () => {
    setStep("done");
    onCompleted();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {step === "idle" && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Step 1: Curate today&apos;s AI news videos from the YouTube channel allowlist.
            Uses ~115 YouTube API quota units.
          </Typography>
          <MuiButton variant="contained" size="small" onClick={handleCurate}>
            Curate today&apos;s videos
          </MuiButton>
        </Box>
      )}

      {step === "curating" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Querying YouTube API…</Typography>
        </Box>
      )}

      {step === "pick" && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Step 2: Pick a video to draft. Ranked by brand alignment score.
            {shortList.length > 0 && ` (${shortList.length} found)`}
          </Typography>

          {shortList.length === 0 && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="body2" color="error" sx={{ mb: 0.5 }}>No videos found.</Typography>
              <Typography variant="caption">
                Possible causes: YouTube API quota exhausted, all recent videos already posted,
                or YOUTUBE_API_KEY missing.
              </Typography>
              <MuiButton variant="text" size="small" onClick={() => setStep("idle")} sx={{ display: "block", mt: 1 }}>
                Try again
              </MuiButton>
            </Paper>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 360, overflow: "auto", pr: 0.5 }}>
            {shortList.map((v, i) => (
              <Card
                key={v.videoId}
                variant="outlined"
                sx={{
                  borderColor: selected?.videoId === v.videoId ? "primary.main" : "divider",
                  bgcolor: selected?.videoId === v.videoId ? "rgba(26,115,232,0.04)" : "transparent",
                }}
              >
                <CardActionArea onClick={() => setSelected(v)} sx={{ px: 2, py: 1.5, display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: 16, flexShrink: 0, mt: 0.25, fontWeight: 500 }}>
                    {i + 1}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {v.videoTitle}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                      <Typography variant="caption">{v.channelTitle}</Typography>
                      <Typography variant="caption" color="text.disabled">·</Typography>
                      <Typography variant="caption">{formatDuration(v.durationSec)}</Typography>
                      <Typography variant="caption" color="text.disabled">·</Typography>
                      <Chip label={`score ${v.score}`} size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: "0.625rem" }} />
                    </Box>
                  </Box>
                  {selected?.videoId === v.videoId && (
                    <CheckOutlined sx={{ color: "primary.main", fontSize: 18, flexShrink: 0 }} />
                  )}
                </CardActionArea>
              </Card>
            ))}
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
            <MuiButton variant="contained" size="small" disabled={!selected} onClick={handleStart}>
              Draft selected video
            </MuiButton>
          </Box>
        </Box>
      )}

      {step === "running" && jobId && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Step 3: Running pipeline (download, transcript, summarize, clip, headline, captions, render).
            This takes 5 to 10 minutes.
          </Typography>
          {selected && (
            <Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2 }}>
              <Typography variant="caption">{selected.channelTitle} · {selected.videoTitle.slice(0, 60)}</Typography>
            </Paper>
          )}
          <JobProgressStream jobId={jobId} onDone={handleStreamDone} onError={(e) => { setError(e); setStep("error"); }} />
        </Box>
      )}

      {step === "done" && (
        <Box>
          <Typography variant="body2" sx={{ color: "success.main", fontWeight: 500, mb: 0.5 }}>
            Pipeline complete! Video draft is ready.
          </Typography>
          <Typography variant="caption">
            Scroll down to review the video, headline, and captions, then approve.
          </Typography>
        </Box>
      )}

      {step === "error" && (
        <Box>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          {selected && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Last video: <Box component="span" sx={{ color: "text.primary" }}>{selected.videoTitle.slice(0, 60)}</Box>
              </Typography>
              <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                Transcript and summary are cached. Retry will skip those steps.
              </Typography>
            </Paper>
          )}
          <Box sx={{ display: "flex", gap: 1 }}>
            {selected && (
              <Button variant="primary" size="sm" onClick={() => { setError(null); handleStart(); }}>
                Retry same video
              </Button>
            )}
            {shortList.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => { setStep("pick"); setError(null); }}>
                Pick different video
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setStep("idle"); setError(null); setSelected(null); setShortList([]); }}>
              Start over
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
