"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import type { JobProgressEvent } from "@/lib/types";

interface JobProgressStreamProps {
  jobId: number;
  onDone: () => void;
  onError: (msg: string) => void;
}

export function JobProgressStream({ jobId, onDone, onError }: JobProgressStreamProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [step, setStep] = useState("Starting…");
  const [pct, setPct] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/generate/video/stream?jobId=${jobId}`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as JobProgressEvent;

      if (event.logLine) {
        setLines((prev) => [...prev, event.logLine!]);
      }
      if (event.step) setStep(event.step);
      if (event.progressPct !== undefined) setPct(event.progressPct);

      if (event.done) {
        es.close();
        if (event.error) {
          onError(event.error);
        } else {
          onDone();
        }
      }
    };

    es.onerror = () => {
      es.close();
      onError("SSE connection lost. Check server logs.");
    };

    return () => es.close();
  }, [jobId, onDone, onError]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress variant="determinate" value={pct} sx={{ borderRadius: 1, height: 6 }} />
        </Box>
        <Typography variant="caption" sx={{ width: 32, textAlign: "right", fontWeight: 500 }}>{pct}%</Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main", animation: "pulse-dot 1.5s ease-in-out infinite", flexShrink: 0 }} />
        <Typography variant="body2" color="text.secondary">{step}</Typography>
      </Box>

      <Box
        ref={logRef}
        className="log-stream"
        sx={{ p: 2, height: 192, overflowY: "auto" }}
      >
        {lines.map((line, i) => (
          <div key={i} className={
            line.includes("[error]") || line.startsWith("[err]") ? "log-error"
              : line.includes("[warn]") ? "log-warn"
              : line.startsWith("[start]") || line.startsWith("[done]") ? "log-info"
              : "log-dim"
          }>
            {line}
          </div>
        ))}
        {lines.length === 0 && (
          <span className="log-dim">Waiting for output…</span>
        )}
      </Box>
    </Box>
  );
}
