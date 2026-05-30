"use client";

import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import MuiButton from "@mui/material/Button";
import { Button } from "@/components/ui/Button";

type Source = "claude" | "github";

interface EducateFormProps {
  postId: number;
  initialText?: string | null;
  initialImagePath?: string | null;
  onApproved: () => void;
}

function encodeMediaPath(absPath: string): string {
  return absPath.replace(/^\//, "").split("/").map(encodeURIComponent).join("/");
}

const STEPS = [
  { label: "Warming up…", pct: 8 },
  { label: "Drafting tip…", pct: 30 },
  { label: "Writing code example…", pct: 55 },
  { label: "Rendering code card…", pct: 80 },
  { label: "Finishing up…", pct: 92 },
];

function GenerateProgressBar() {
  const [stepIdx, setStepIdx] = useState(0);
  const [pct, setPct] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPct(STEPS[0].pct);
    intervalRef.current = setInterval(() => {
      setStepIdx((prev) => {
        const next = Math.min(prev + 1, STEPS.length - 1);
        setPct(STEPS[next].pct);
        if (next === STEPS.length - 1 && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        return next;
      });
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const label = STEPS[stepIdx]?.label ?? "Finishing up…";

  return (
    <Box sx={{ py: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="caption">{pct}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} sx={{ borderRadius: 1, height: 6 }} />
    </Box>
  );
}

export function EducateForm({ postId, initialText, initialImagePath, onApproved }: EducateFormProps) {
  const [source, setSource] = useState<Source>("claude");
  const [text, setText] = useState(initialText ?? "");
  const [imagePath, setImagePath] = useState(initialImagePath ?? null);
  const [feedback, setFeedback] = useState("");
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(!!initialText);

  const generate = async (fb?: string) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/educate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, source, feedback: fb || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setText(data.text);
      setImagePath(data.imagePath ?? null);
      setFeedback("");
      setHasGenerated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  const approve = async () => {
    setApproving(true);
    try {
      await fetch(`/api/posts/${postId}/approve`, { method: "POST" });
      onApproved();
    } finally {
      setApproving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {!hasGenerated && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Tip source</Typography>
          <ToggleButtonGroup
            value={source}
            exclusive
            onChange={(_, val) => { if (val) setSource(val); }}
            fullWidth
            size="small"
          >
            <ToggleButton value="claude">Claude (fresh tip)</ToggleButton>
            <ToggleButton value="github">GitHub Trending</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {!hasGenerated && !generating && (
        <MuiButton variant="contained" fullWidth onClick={() => generate()}>
          Generate tip
        </MuiButton>
      )}

      {generating && !hasGenerated && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <GenerateProgressBar />
        </Paper>
      )}

      {hasGenerated && (
        <>
          {generating && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <GenerateProgressBar />
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2.5, display: generating ? "none" : undefined }}>
            {error ? (
              <Typography variant="body2" color="error">{error}</Typography>
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                {text.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim()}
              </Typography>
            )}
          </Paper>

          {imagePath && !generating && (
            <Box>
              <Typography variant="caption" sx={{ display: "block", mb: 0.75 }}>Code card preview</Typography>
              <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${encodeMediaPath(imagePath)}`} alt="Code card" style={{ maxWidth: "100%", display: "block" }} />
              </Paper>
            </Box>
          )}

          {text && (
            <Typography variant="caption">
              {text.replace(/```[\s\S]*?```/g, "").trim().length} chars (code stripped) · Threads max 490 · X max 275
            </Typography>
          )}

          {!generating && (
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && feedback) generate(feedback); }}
                placeholder="Revision feedback…"
                fullWidth
              />
              <Button variant="secondary" size="sm" onClick={() => generate(feedback || undefined)} loading={generating}>
                Regenerate
              </Button>
            </Box>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Button variant="primary" size="sm" disabled={!text || generating} loading={approving} onClick={approve}>
              Approve & accept
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
