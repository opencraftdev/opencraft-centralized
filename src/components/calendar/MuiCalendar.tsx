"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import type { PostSummary } from "@/lib/types";

const TYPE_DOT_COLORS: Record<string, string> = {
  engage: "#1A73E8",
  educate: "#188038",
  video: "#5F6368",
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface MuiCalendarProps {
  year: number;
  month: number; // 1-12
  selectedDate: Date | null;
  posts: Record<string, PostSummary[]>;
  onChangeDate: (date: Date) => void;
  onChangeMonth: (year: number, month: number) => void;
  size?: "compact" | "full";
}

export function MuiCalendar({
  year,
  month,
  selectedDate,
  posts,
  onChangeDate,
  onChangeMonth,
  size = "full",
}: MuiCalendarProps) {
  const compact = size === "compact";
  const monthDate = new Date(year, month - 1, 1);

  // Full 6-week grid so the layout height never jumps between months.
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let d = gridStart; d.getTime() <= gridEnd.getTime(); d = addDays(d, 1)) {
    days.push(d);
  }

  const circle = compact ? 30 : 44;
  const numFont = compact ? "0.8125rem" : "1rem";
  const dot = compact ? 4 : 5;
  const cellH = compact ? 42 : 58;

  const goPrev = () =>
    onChangeMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  const goNext = () =>
    onChangeMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);

  return (
    <Box sx={{ bgcolor: "#fff", borderRadius: "12px", p: compact ? 1.5 : 2 }}>
      {/* Header: month label + navigation */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
          pl: 0.5,
        }}
      >
        <Typography
          sx={{
            fontSize: compact ? "0.875rem" : "1.125rem",
            fontWeight: 600,
            color: "#1F1F1F",
          }}
        >
          {format(monthDate, "MMMM yyyy")}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.25 }}>
          <IconButton
            onClick={goPrev}
            size="small"
            aria-label="Previous month"
            sx={{ color: "#5F6368", width: 30, height: 30 }}
          >
            <ChevronLeftOutlined sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton
            onClick={goNext}
            size="small"
            aria-label="Next month"
            sx={{ color: "#5F6368", width: 30, height: 30 }}
          >
            <ChevronRightOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Weekday header — same 7-column grid so it always aligns with days */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: 0.5 }}>
        {WEEKDAYS.map((w, i) => (
          <Typography
            key={i}
            sx={{
              textAlign: "center",
              fontSize: compact ? "0.625rem" : "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.3px",
              color: "#70757A",
            }}
          >
            {w}
          </Typography>
        ))}
      </Box>

      {/* Days */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, monthDate);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const today = isToday(day);
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = posts[key] ?? [];
          const dots = dayPosts.slice(0, 3);
          const more = dayPosts.length > 3;

          return (
            <Box
              key={key}
              component="button"
              type="button"
              onClick={() => onChangeDate(day)}
              sx={{
                appearance: "none",
                border: "none",
                bgcolor: "transparent",
                cursor: "pointer",
                p: 0,
                height: cellH,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                pt: "2px",
              }}
            >
              <Box
                sx={{
                  width: circle,
                  height: circle,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: numFont,
                  fontWeight: selected || today ? 600 : 500,
                  lineHeight: 1,
                  color: selected
                    ? "#fff"
                    : today
                    ? "#0B57D0"
                    : inMonth
                    ? "#1F1F1F"
                    : "#BDC1C6",
                  bgcolor: selected ? "#0B57D0" : "transparent",
                  border:
                    today && !selected ? "1px solid #0B57D0" : "1px solid transparent",
                  transition: "background-color 120ms",
                  "&:hover": {
                    bgcolor: selected ? "#0B57D0" : "rgba(11,87,208,0.08)",
                  },
                }}
              >
                {day.getDate()}
              </Box>

              {/* Post indicator dots (fixed-height row keeps cells aligned) */}
              <Box sx={{ display: "flex", gap: "2px", height: dot, alignItems: "center" }}>
                {inMonth &&
                  dots.map((p, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: dot,
                        height: dot,
                        borderRadius: "50%",
                        bgcolor: TYPE_DOT_COLORS[p.type] ?? "#9AA0A6",
                      }}
                    />
                  ))}
                {inMonth && more && (
                  <Box
                    sx={{
                      width: dot,
                      height: dot,
                      borderRadius: "50%",
                      bgcolor: "#9AA0A6",
                    }}
                  />
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
