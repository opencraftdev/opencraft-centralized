"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import { useCommandPoller } from "@/features/sosmed/hooks/useCommandPoller";
import { PublishSection } from "./PublishSection";
import { SuggestList } from "./SuggestList";
import type { ContentPost } from "@/lib/types";
import type { VideoSuggestItem } from "@/lib/sosmed/types";

const STEP_LABELS = ["Suggest", "Draft", "Approve", "Publish"];

function deriveStep(post: ContentPost, hasSuggestList: boolean): number {
  if (post.status === "published") return 4;
  if (post.status === "accepted") return 3;
  if (post.textContent) return 2;
  if (hasSuggestList) return 1;
  return 0;
}

export function VideoStepper({ initialPost }: { initialPost: ContentPost }) {
  const [post, setPost] = useState<ContentPost>(initialPost);
  const [commandId, setCommandId] = useState<number | null>(null);
  const [suggestItems, setSuggestItems] = useState<VideoSuggestItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [fireError, setFireError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const lastCommandRef = useRef<string | null>(null);

  const hasSuggestList = suggestItems.length > 0;
  const activeStep = deriveStep(post, hasSuggestList);

  const { status: cmdStatus, error: cmdError, logText, isPolling } = useCommandPoller(commandId);

  // Append new log lines
  useEffect(() => {
    if (logText) {
      const lines = logText.split("\n").filter(Boolean);
      setLogLines(lines);
      setTimeout(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      }, 50);
    }
  }, [logText]);

  // Handle command completion.
  // Don't reset commandId here on success — it would flip cmdStatus back to null,
  // re-trigger this effect, and the previous cleanup would abort the post fetch.
  // On failure we can reset because no fetch is in flight to abort.
  useEffect(() => {
    if (cmdStatus !== "completed" && cmdStatus !== "done" && cmdStatus !== "failed") return;
    if (cmdStatus === "failed") {
      setCommandId(null);
      return;
    }
    const wasCommand = lastCommandRef.current;
    let alive = true;
    const ctrl = new AbortController();
    fetch(`/api/posts/${post.id}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => { if (alive && data.post) setPost(data.post); })
      .catch(() => {});
    if (wasCommand === "suggest") {
      fetch("/api/sosmed/video-state", { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data) => { if (alive) setSuggestItems(data.items ?? []); })
        .catch((err) => {
          if (alive && err?.name !== "AbortError") setFireError("Failed to load video suggestions");
        });
    }
    return () => { alive = false; ctrl.abort(); };
  }, [cmdStatus, post.id]);

  async function fireCommand(command: "suggest" | "draft" | "approve" | "reset", context?: Record<string, unknown>) {
    setFireError(null);
    setLogLines([]);
    try {
      const res = await fetch("/api/sosmed/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, platform: "video", context: { postId: post.id, ...(context ?? {}) } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (typeof json.command_id !== "number") throw new Error("missing command_id");
      lastCommandRef.current = command;
      setCommandId(json.command_id);
    } catch (err) {
      setFireError(err instanceof Error ? err.message : "Failed to start command");
      throw err;
    }
  }

  async function handleReset() {
    try {
      await fireCommand("reset");
    } catch {
      return;
    }
    setSuggestItems([]);
    setSelectedVideoId(null);
    setLogLines([]);
    setPost((p) => ({ ...p, status: "draft", textContent: null }));
  }

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", px: 3, pt: "76px", pb: 6 }}>
      <Box sx={{ mb: 2 }}>
        <Button component={Link} href={`/posts/${post.id}`} startIcon={<ArrowBackOutlined />} size="small" sx={{ textTransform: "none", color: "#5F6368" }}>
          Back to post
        </Button>
      </Box>

      {/* Step indicator */}
      <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3, mb: 3 }}>
        <Stepper activeStep={Math.min(activeStep, STEP_LABELS.length - 1)} alternativeLabel>
          {STEP_LABELS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
      </Box>

      {/* Error recovery button — always visible when failed */}
      {post.status === "failed" && (
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" color="error" startIcon={<RefreshOutlined />} onClick={handleReset} sx={{ textTransform: "none" }}>
            Recover from state
          </Button>
        </Box>
      )}

      {(cmdError || fireError) && (
        <Typography sx={{ mb: 2, fontSize: "0.875rem", color: "#D93025" }}>{cmdError || fireError}</Typography>
      )}

      {/* Step 0 — Suggest */}
      {activeStep === 0 && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
          <Typography sx={{ fontWeight: 500, fontSize: "1rem", mb: 2 }}>Find video ideas</Typography>
          {!isPolling && (
            <Button
              variant="contained"
              onClick={() => fireCommand("suggest")}
              sx={{ textTransform: "none", borderRadius: "9999px" }}
            >
              Find Video Ideas
            </Button>
          )}
          {isPolling && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
              <CircularProgress size={18} />
              <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>Searching YouTube for video ideas…</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Step 1 — Draft (show video list first, then log once drafting) */}
      {activeStep === 1 && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
          <Typography sx={{ fontWeight: 500, fontSize: "1rem", mb: 2 }}>Draft video content</Typography>
          {suggestItems.length > 0 && !isPolling && !post.textContent && (
            <>
              <SuggestList items={suggestItems} selectedVideoId={selectedVideoId} onSelect={setSelectedVideoId} />
              <Button
                variant="contained"
                disabled={!selectedVideoId}
                onClick={() => selectedVideoId && fireCommand("draft", { videoId: selectedVideoId })}
                sx={{ mt: 2, textTransform: "none", borderRadius: "9999px" }}
              >
                Draft This Video
              </Button>
            </>
          )}
          {isPolling && (
            <Box>
              <LinearProgress sx={{ mb: 1.5, borderRadius: 4, height: 6 }} />
              <Box
                ref={logRef}
                sx={{ height: 200, overflowY: "auto", bgcolor: "#0D1117", borderRadius: "10px", p: 2, fontFamily: "monospace", fontSize: "0.75rem", color: "#E6EDF3" }}
              >
                {logLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                {logLines.length === 0 && <span style={{ color: "#8B949E" }}>Waiting for output…</span>}
              </Box>
            </Box>
          )}
          {!isPolling && !post.textContent && suggestItems.length === 0 && (
            <Typography sx={{ fontSize: "0.875rem", color: "#5F6368" }}>Drafting complete. Refreshing…</Typography>
          )}
        </Box>
      )}

      {/* Step 2 — Approve */}
      {activeStep === 2 && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
          <Typography sx={{ fontWeight: 500, fontSize: "1rem", mb: 2 }}>Review &amp; Approve</Typography>
          {post.headline && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.5 }}>Headline</Typography>
              <Typography sx={{ fontWeight: 500 }}>{post.headline}</Typography>
            </Box>
          )}
          {post.textContent && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.5 }}>Content</Typography>
              <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#1F1F1F" }}>
                {post.textContent.replace(/```[\s\S]*?```/g, "").trim()}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 2 }}>
            <Button
              variant="contained"
              disabled={isPolling}
              startIcon={isPolling ? <CircularProgress size={14} color="inherit" /> : null}
              onClick={() => fireCommand("approve")}
              sx={{ textTransform: "none", borderRadius: "9999px" }}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={isPolling}
              startIcon={<RefreshOutlined />}
              onClick={handleReset}
              sx={{ textTransform: "none", borderRadius: "9999px" }}
            >
              Reset
            </Button>
          </Box>
        </Box>
      )}

      {/* Step 3 — Publish */}
      {(activeStep === 3 || activeStep === 4) && (
        <Box sx={{ bgcolor: "#fff", borderRadius: "16px", p: 3 }}>
          <Typography sx={{ fontWeight: 500, fontSize: "1rem", mb: 2 }}>Publish</Typography>
          <PublishSection post={post} onPostUpdate={setPost} />
        </Box>
      )}
    </Box>
  );
}
