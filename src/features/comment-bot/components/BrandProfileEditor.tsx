"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import type { BrandProfileRow } from "@/lib/comment-bot/types";

interface Props {
  profile: BrandProfileRow | null;
}

function prettyJson(val: unknown): string {
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

export function BrandProfileEditor({ profile }: Props) {
  const initial = prettyJson(profile?.data ?? {});
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleReset() {
    setValue(initial);
    setError(null);
    setSuccess(false);
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError("Invalid JSON — fix the syntax and try again.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/comment-bot/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Save failed");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  const isDirty = value !== initial;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Meta info */}
      {profile && (
        <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
          Last updated:{" "}
          {new Date(profile.updated_at).toLocaleString()}
          {profile.updated_by ? ` by ${profile.updated_by}` : ""}
        </Typography>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(false)}>
          Brand profile saved successfully.
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* JSON editor */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid #E8EAED",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            bgcolor: "#F8F9FA",
            borderBottom: "1px solid #E8EAED",
            px: 2,
            py: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "#5f6368" }}>
            brand-profile.json
          </Typography>
          {isDirty && (
            <Typography sx={{ fontSize: "0.75rem", color: "#E8710A" }}>Unsaved changes</Typography>
          )}
        </Box>
        <Box
          component="textarea"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setValue(e.target.value);
            setSuccess(false);
          }}
          spellCheck={false}
          sx={{
            display: "block",
            width: "100%",
            minHeight: 480,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            fontSize: "0.8125rem",
            lineHeight: 1.65,
            p: 2,
            border: "none",
            outline: "none",
            resize: "vertical",
            bgcolor: "transparent",
            color: "#1F1F1F",
            boxSizing: "border-box",
          }}
        />
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RestoreOutlined />}
          disabled={!isDirty || saving}
          onClick={handleReset}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlined />}
          disabled={saving || !isDirty}
          onClick={handleSave}
        >
          Save
        </Button>
      </Box>

      <Typography sx={{ fontSize: "0.75rem", color: "#9AA0A6" }}>
        This JSON is the single source of truth for the bot&apos;s voice, keywords, engagement
        filters, and posting caps. The bot reads it on startup. Changes take effect on the next
        bot run.
      </Typography>
    </Box>
  );
}
