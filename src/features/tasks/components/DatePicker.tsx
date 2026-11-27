"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import EventRounded from "@mui/icons-material/EventRounded";

// Date pill + calendar popover in the app's style (replaces the browser's native date picker).
// Values are "YYYY-MM-DD" strings (local dates, no time zone shifts). The other end of the range is highlighted.

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
};
const todayIso = () => {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
};
/** "2026-11-23" → "23 Nov 2026" (year only when not this year). */
export function formatShort(s: string) {
  const { y, m, d } = parse(s);
  return `${d} ${MONTHS_SHORT[m]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
}

export function DatePill({
  label,
  value,
  min,
  max,
  other,
  onChange,
  strong,
  error,
}: {
  label: string;
  value: string | null;
  min?: string | null;
  max?: string | null;
  other?: string | null; // the other end of the range (highlighted)
  onChange: (v: string | null) => void;
  strong?: boolean; // the deadline: tinted when set
  error?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const tinted = strong && value;
  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={`${label}: ${value ? formatShort(value) : "belum diisi"}`}
        aria-haspopup="dialog"
        onClick={(e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          height: 30,
          px: 1.25,
          border: "1px solid",
          borderColor: error ? "#B3261E" : anchor ? "#0B57D0" : tinted ? "#FEF0DB" : "#E0E3E7",
          bgcolor: tinted ? "#FEF0DB" : "#fff",
          color: tinted ? "#B06000" : value ? "#1F1F1F" : "#80868B",
          borderRadius: "9999px",
          fontFamily: "inherit",
          fontSize: "0.8125rem",
          fontWeight: strong ? 500 : 400,
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "border-color 150ms, background-color 150ms",
          "&:hover": { borderColor: error ? "#B3261E" : tinted ? "#F9D9A8" : "#C4C7C5" },
          "&:focus-visible": { outline: "none", boxShadow: "0 0 0 2px #A8C7FA" },
        }}
      >
        <EventRounded sx={{ fontSize: 15, opacity: 0.75 }} />
        {value ? formatShort(value) : "Pilih tanggal"}
      </Box>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 0.75, borderRadius: "16px", boxShadow: "0 8px 28px rgba(60,64,67,.22)", animation: "oc-pop-in 200ms cubic-bezier(0.22, 1, 0.36, 1)" } } }}
      >
        <Calendar
          label={label}
          value={value}
          min={min ?? null}
          max={max ?? null}
          other={other ?? null}
          onPick={(v) => {
            onChange(v);
            setAnchor(null);
          }}
        />
      </Popover>
    </>
  );
}

function Calendar({ label, value, min, max, other, onPick }: { label: string; value: string | null; min: string | null; max: string | null; other: string | null; onPick: (v: string | null) => void }) {
  const today = todayIso();
  const start = parse(value ?? other ?? today);
  const [view, setView] = useState({ y: start.y, m: start.m });

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(iso(view.y, view.m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const move = (k: number) => setView((v) => {
    const d = new Date(v.y, v.m + k, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const lo = value && other ? (value < other ? value : other) : null;
  const hi = value && other ? (value < other ? other : value) : null;

  return (
    <Box sx={{ width: 296, p: 1.75, pb: 1.25 }} role="dialog" aria-label={label}>
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#5F6368", px: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "flex", alignItems: "center", mt: 0.25, mb: 1 }}>
        <Typography sx={{ flex: 1, fontSize: "1rem", fontWeight: 500, px: 0.5 }}>
          {MONTHS[view.m]} {view.y}
        </Typography>
        <IconButton size="small" aria-label="Bulan sebelumnya" onClick={() => move(-1)}>
          <ChevronLeftRounded />
        </IconButton>
        <IconButton size="small" aria-label="Bulan berikutnya" onClick={() => move(1)}>
          <ChevronRightRounded />
        </IconButton>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 0.25 }}>
        {DAYS.map((d) => (
          <Typography key={d} sx={{ fontSize: "0.6875rem", fontWeight: 500, color: "#80868B", textAlign: "center", pb: 0.5 }}>
            {d}
          </Typography>
        ))}
        {cells.map((c, i) => {
          if (!c) return <Box key={`e${i}`} />;
          const disabled = (min && c < min) || (max && c > max);
          const selected = c === value;
          const isOther = c === other;
          const inRange = lo && hi && c > lo && c < hi;
          const isToday = c === today;
          const day = Number(c.slice(8));
          return (
            <Box
              key={c}
              sx={{
                display: "flex",
                justifyContent: "center",
                bgcolor: inRange ? "#E8F0FE" : "transparent",
                borderRadius: inRange ? 0 : undefined,
                ...(lo && c === lo && hi ? { background: "linear-gradient(90deg, transparent 50%, #E8F0FE 50%)" } : {}),
                ...(hi && c === hi && lo ? { background: "linear-gradient(90deg, #E8F0FE 50%, transparent 50%)" } : {}),
              }}
            >
              <Box
                component="button"
                type="button"
                disabled={Boolean(disabled)}
                onClick={() => onPick(c)}
                aria-pressed={selected}
                aria-label={`${day} ${MONTHS[Number(c.slice(5, 7)) - 1]} ${c.slice(0, 4)}`}
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: "0.8125rem",
                  fontWeight: selected || isToday ? 600 : 400,
                  cursor: disabled ? "default" : "pointer",
                  bgcolor: selected ? "#0B57D0" : isOther ? "#D3E3FD" : "transparent",
                  color: disabled ? "#C4C7C5" : selected ? "#fff" : isOther ? "#041E49" : isToday ? "#0B57D0" : "#1F1F1F",
                  boxShadow: isToday && !selected ? "inset 0 0 0 1px #0B57D0" : "none",
                  transition: "background-color 120ms",
                  "&:hover:not(:disabled)": { bgcolor: selected ? "#0842A0" : "#F0F4F9" },
                  "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 1 },
                }}
              >
                {day}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", mt: 1, pt: 1, borderTop: "1px solid #EEF1F4" }}>
        <Box component="button" type="button" onClick={() => onPick(null)} sx={footBtn("#5F6368")}>
          Hapus
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box
          component="button"
          type="button"
          disabled={Boolean((min && today < min) || (max && today > max))}
          onClick={() => onPick(today)}
          sx={footBtn("#0B57D0")}
        >
          Hari ini
        </Box>
      </Box>
    </Box>
  );
}

const footBtn = (color: string) =>
  ({
    border: "none",
    bgcolor: "transparent",
    fontFamily: "inherit",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color,
    px: 1.25,
    py: 0.5,
    borderRadius: "9999px",
    cursor: "pointer",
    "&:hover:not(:disabled)": { bgcolor: "#F0F4F9" },
    "&:disabled": { color: "#C4C7C5", cursor: "default" },
  }) as const;
