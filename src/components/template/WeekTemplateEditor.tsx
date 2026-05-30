"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import { Button } from "@/components/ui/Button";
import type { WeeklyTemplate, TemplateType } from "@/lib/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_COLORS: Record<TemplateType, string> = {
  engage: "#4285f4",
  educate: "#34a853",
  video: "#5f6368",
  off: "#9aa0a6",
};

const TYPE_LABEL: Record<TemplateType, string> = {
  engage: "Engage",
  educate: "Educate",
  video: "Video",
  off: "Off",
};

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const TODAY_DOW = new Date().getDay();

export function WeekTemplateEditor() {
  const [template, setTemplate] = useState<WeeklyTemplate[]>([]);
  const [original, setOriginal] = useState<WeeklyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/template")
      .then((r) => r.json())
      .then((d) => {
        const t: WeeklyTemplate[] = d.template ?? [];
        setTemplate(t);
        setOriginal(t);
      })
      .catch((e) => setError(e?.message ?? "Failed to load template"))
      .finally(() => setLoading(false));
  }, []);

  const setDay = (dayOfWeek: number, contentType: TemplateType) => {
    setTemplate((prev) =>
      prev.map((t) => (t.dayOfWeek === dayOfWeek ? { ...t, contentType } : t))
    );
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      const data = await res.json();
      const next: WeeklyTemplate[] = data.template ?? template;
      setTemplate(next);
      setOriginal(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = template.filter((t) => t.contentType !== "off").length;
  const dirty =
    template.length === original.length &&
    template.some((t) => {
      const orig = original.find((o) => o.dayOfWeek === t.dayOfWeek);
      return orig?.contentType !== t.contentType;
    });

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Summary row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Chip
          label={`${activeCount} / 7 days active`}
          size="small"
          sx={{
            bgcolor: activeCount > 0 ? "rgba(11,87,208,0.08)" : "rgba(95,99,104,0.08)",
            color: activeCount > 0 ? "#0B57D0" : "#5f6368",
            fontWeight: 500,
            border: "none",
          }}
        />
        <Typography variant="body2" color="text.secondary">
          Pick the content type for each weekday, or leave it off.
        </Typography>
      </Box>

      {/* Day rows */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {WEEK_ORDER.map((dow) => {
          const entry = template.find((t) => t.dayOfWeek === dow);
          if (!entry) return null;
          const selected = entry.contentType;
          const isToday = dow === TODAY_DOW;
          const isOff = selected === "off";

          return (
            <Box
              key={dow}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                p: 1.5,
                borderRadius: "12px",
                bgcolor: isToday ? "rgba(11,87,208,0.04)" : "#FAFBFC",
                border: "1px solid",
                borderColor: isToday ? "rgba(11,87,208,0.18)" : "#E8EAED",
                transition: "background-color 120ms ease, border-color 120ms ease",
              }}
            >
              {/* Left color indicator */}
              <Box
                sx={{
                  width: 4,
                  height: 32,
                  borderRadius: "2px",
                  bgcolor: TYPE_COLORS[selected],
                  opacity: isOff ? 0.35 : 1,
                  flexShrink: 0,
                }}
              />

              {/* Day name */}
              <Box sx={{ width: 132, flexShrink: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Typography
                    sx={{
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: isOff ? "text.secondary" : "text.primary",
                    }}
                  >
                    {DAY_NAMES[dow]}
                  </Typography>
                  {isToday && (
                    <Chip
                      label="Today"
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: "0.6875rem",
                        bgcolor: "#0B57D0",
                        color: "#fff",
                        "& .MuiChip-label": { px: 0.75 },
                      }}
                    />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {DAY_NAMES_SHORT[dow]} · {isOff ? "no post" : TYPE_LABEL[selected]}
                </Typography>
              </Box>

              {/* Type selector */}
              <ToggleButtonGroup
                value={selected}
                exclusive
                onChange={(_, val) => {
                  if (val) setDay(dow, val);
                }}
                size="small"
                sx={{
                  flex: 1,
                  "& .MuiToggleButton-root": {
                    border: "1px solid #DADCE0",
                    color: "#444746",
                    fontWeight: 500,
                  },
                }}
              >
                {(["engage", "educate", "video", "off"] as TemplateType[]).map((t) => (
                  <ToggleButton
                    key={t}
                    value={t}
                    sx={{
                      flex: 1,
                      fontSize: "0.8125rem",
                      textTransform: "none",
                      py: 0.75,
                      "&.Mui-selected": {
                        bgcolor: `${TYPE_COLORS[t]}1A`,
                        color: TYPE_COLORS[t],
                        borderColor: TYPE_COLORS[t],
                        fontWeight: 600,
                        "&:hover": { bgcolor: `${TYPE_COLORS[t]}26` },
                      },
                    }}
                  >
                    {TYPE_LABEL[t]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          );
        })}
      </Box>

      {/* Save bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          pt: 2,
          borderTop: "1px solid #E8EAED",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 24 }}>
          {error ? (
            <Typography variant="body2" sx={{ color: "error.main" }}>
              {error}
            </Typography>
          ) : saved ? (
            <>
              <CheckCircleOutlined sx={{ fontSize: 18, color: "#188038" }} />
              <Typography variant="body2" sx={{ color: "#188038", fontWeight: 500 }}>
                Saved
              </Typography>
            </>
          ) : dirty ? (
            <Typography variant="body2" color="text.secondary">
              Unsaved changes
            </Typography>
          ) : null}
        </Box>

        <Button
          variant="primary"
          size="sm"
          loading={saving}
          disabled={!dirty || saving}
          onClick={handleSave}
        >
          Save template
        </Button>
      </Box>
    </Box>
  );
}
