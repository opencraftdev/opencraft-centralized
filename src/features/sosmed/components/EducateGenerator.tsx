"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { useCommandPoller } from "@/features/sosmed/hooks/useCommandPoller";
import { mediaUrl } from "@/components/posts/PostDetail";
import type { ContentPost } from "@/lib/types";

const STEPS = ["Warming up", "Drafting tip", "Writing code example", "Rendering code card", "Finishing up"];

interface Props {
  post: ContentPost;
  onPostUpdate: (post: ContentPost) => void;
  onAccept: () => void;
}

export function EducateGenerator({ post, onPostUpdate, onAccept }: Props) {
  const sourceLocked = !!(post.source as { source?: string } | null)?.source;
  const [source, setSource] = useState<"claude" | "github">("claude");
  const [commandId, setCommandId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState(post.userFeedback ?? "");
  const [stepIndex, setStepIndex] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onPostUpdateRef = useRef(onPostUpdate);
  useEffect(() => { onPostUpdateRef.current = onPostUpdate; });

  const { status: cmdStatus, error: cmdError, isPolling } = useCommandPoller(commandId);
  const [fireError, setFireError] = useState<string | null>(null);

  async function fireGenerate(src: "claude" | "github") {
    setFireError(null);
    setFiring(true);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    try {
      const res = await fetch("/api/sosmed/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "generate",
          platform: "educate",
          context: { source: src, ...(feedback ? { user_feedback: feedback } : {}) },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (typeof json.command_id !== "number") throw new Error("missing command_id");
      setCommandId(json.command_id);
      setStepIndex(0);
      stepTimerRef.current = setInterval(() => {
        setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
      }, 5000);
    } catch (err) {
      setFireError(err instanceof Error ? err.message : "Failed to start generation");
    } finally {
      setFiring(false);
    }
  }

  useEffect(() => {
    if (cmdStatus !== "completed" && cmdStatus !== "done" && cmdStatus !== "failed") return;
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    if (cmdStatus === "failed") return;
    let alive = true;
    const ctrl = new AbortController();
    setCommandId(null);
    fetch(`/api/posts/${post.id}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => { if (alive && data.post) onPostUpdateRef.current(data.post); })
      .catch(() => {});
    return () => { alive = false; ctrl.abort(); };
  }, [cmdStatus, post.id]);

  useEffect(() => () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); }, []);

  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.post) onAccept();
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Failed to accept post");
    } finally {
      setAccepting(false);
    }
  }

  const lockedSource = (post.source as { source?: string } | null)?.source as "claude" | "github" | undefined;
  const effectiveSource = lockedSource ?? source;
  const cleanText = post.textContent?.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim() ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Source picker — hidden after first generate */}
      {!sourceLocked && !isPolling && !cleanText && (
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 1 }}>Source</Typography>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {(["claude", "github"] as const).map((s) => (
              <Box
                key={s}
                onClick={() => setSource(s)}
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: "12px",
                  border: "2px solid",
                  borderColor: source === s ? "#1A73E8" : "#E8EAED",
                  bgcolor: source === s ? "rgba(26,115,232,0.05)" : "#fff",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 140ms",
                  "&:hover": { borderColor: "#1A73E8" },
                }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", color: "#1F1F1F" }}>
                  {s === "claude" ? "Claude" : "GitHub Trending"}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#5F6368", mt: 0.25 }}>
                  {s === "claude" ? "Fresh AI tip" : "Trending repos"}
                </Typography>
              </Box>
            ))}
          </Box>
          <Button
            variant="outlined"
            disabled={isPolling || firing}
            onClick={() => fireGenerate(effectiveSource)}
            sx={{ mt: 1.5, textTransform: "none", borderRadius: "9999px" }}
          >
            Generate tip
          </Button>
        </Box>
      )}

      {/* Progress bar while generating */}
      {isPolling && (
        <Box>
          <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", mb: 1 }}>
            {STEPS[stepIndex]}…
          </Typography>
          <LinearProgress variant="determinate" value={((stepIndex + 1) / STEPS.length) * 100} sx={{ borderRadius: 4, height: 6 }} />
        </Box>
      )}

      {cmdError && <Typography sx={{ fontSize: "0.875rem", color: "#D93025" }}>{cmdError}</Typography>}
      {fireError && <Typography sx={{ fontSize: "0.875rem", color: "#D93025" }}>{fireError}</Typography>}

      {/* Text preview */}
      {cleanText && !isPolling && (
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.75 }}>Tip</Typography>
          <Box sx={{ p: 2, bgcolor: "#F8F9FA", borderRadius: "10px", border: "1px solid #E8EAED" }}>
            <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#1F1F1F" }}>
              {cleanText}
            </Typography>
          </Box>
          {lockedSource && (
            <Typography sx={{ mt: 0.5, fontSize: "0.75rem", color: "#9AA0A6" }}>
              Source: {lockedSource === "claude" ? "Claude" : "GitHub Trending"} (locked)
            </Typography>
          )}
        </Box>
      )}

      {/* Code card image */}
      {post.imagePath && !isPolling && (
        <Box>
          <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 0.75 }}>Code card</Typography>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(post.imagePath)} alt="Code card" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #E8EAED" }} />
        </Box>
      )}

      {/* Feedback + Regenerate */}
      {(cleanText || cmdStatus === "failed") && !isPolling && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small"
            placeholder="Feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{ input: { sx: { fontSize: "0.875rem" } } }}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={isPolling || firing}
            onClick={async () => { setCommandId(null); await fireGenerate(effectiveSource); }}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Regenerate
          </Button>
        </Box>
      )}

      {/* Approve button */}
      {cleanText && !isPolling && (
        <>
          {acceptError && (
            <Typography sx={{ fontSize: "0.875rem", color: "#D93025" }}>{acceptError}</Typography>
          )}
          <Button
            variant="contained"
            startIcon={accepting ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlined />}
            disabled={accepting}
            onClick={handleAccept}
            sx={{ textTransform: "none", borderRadius: "9999px", alignSelf: "flex-start" }}
          >
            Approve &amp; Accept
          </Button>
        </>
      )}
    </Box>
  );
}
