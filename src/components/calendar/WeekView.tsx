"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, format, isSameDay, isToday, startOfWeek } from "date-fns";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { PostSummary } from "@/lib/types";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 48;
const TIME_COL_WIDTH = 64;

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  engage: { bg: "#1A73E8", text: "#fff" },
  educate: { bg: "#188038", text: "#fff" },
  video: { bg: "#5F6368", text: "#fff" },
};

function formatHourLabel(h: number) {
  if (h === 0) return "";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

interface WeekViewProps {
  weekStart: Date;
  postsByDate: Record<string, PostSummary[]>;
  onSelectDay: (date: Date) => void;
  onCreatePost: (date: Date) => void;
  onOpenPost: (id: number) => void;
}

export function WeekView({
  weekStart,
  postsByDate,
  onSelectDay,
  onCreatePost,
  onOpenPost,
}: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  // Update "now" line every minute
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  // Scroll to current hour on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const targetHour = Math.max(0, new Date().getHours() - 1);
    scrollRef.current.scrollTop = targetHour * HOUR_HEIGHT;
  }, []);

  const weekHasToday = days.some((d) => isToday(d));
  const nowTop = now.getHours() * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;
  const todayIndex = days.findIndex((d) => isToday(d));

  return (
    <Box
      ref={scrollRef}
      sx={{
        bgcolor: "#fff",
        borderRadius: "12px",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Sticky header band — both day headers and all-day row pinned together */}
      <Box sx={{ position: "sticky", top: 0, zIndex: 3, bgcolor: "#fff" }}>
      {/* Day headers */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, 1fr)`,
          flexShrink: 0,
        }}
      >
        <Box />
        {days.map((day) => {
          const today = isToday(day);
          return (
            <Box
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              sx={{
                pt: 1,
                pb: 0.5,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.25,
                cursor: "pointer",
                "&:hover .day-num": {
                  bgcolor: today ? "#0B57D0" : "rgba(60,64,67,0.08)",
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.8px",
                  color: today ? "#0B57D0" : "#70757A",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                {format(day, "EEE")}
              </Typography>
              <Box
                className="day-num"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  fontWeight: 400,
                  bgcolor: today ? "#0B57D0" : "transparent",
                  color: today ? "#fff" : "#3C4043",
                  transition: "background-color 120ms",
                  lineHeight: 1,
                }}
              >
                {format(day, "d")}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* All-day row */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, 1fr)`,
          borderBottom: "1px solid #E0E0E0",
          flexShrink: 0,
          minHeight: 36,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-end",
            pr: 1,
            pt: 1,
            fontSize: "0.625rem",
            color: "#5F6368",
          }}
        >
          GMT+07
        </Box>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDate[key] ?? [];
          return (
            <Box
              key={day.toISOString()}
              onClick={() => onCreatePost(day)}
              sx={{
                borderLeft: "1px solid #E0E0E0",
                px: 0.5,
                py: 0.5,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                cursor: "pointer",
                "&:hover": { bgcolor: "rgba(11,87,208,0.03)" },
              }}
            >
              {dayPosts.slice(0, 3).map((post) => {
                const c = TYPE_COLORS[post.type] ?? { bg: "#9AA0A6", text: "#fff" };
                const preview =
                  post.headline ?? post.textContent?.slice(0, 40) ?? "Untitled";
                return (
                  <Box
                    key={post.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPost(post.id);
                    }}
                    sx={{
                      bgcolor: c.bg,
                      color: c.text,
                      borderRadius: "4px",
                      px: 0.75,
                      py: 0.25,
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                      "&:hover": { filter: "brightness(0.92)" },
                    }}
                  >
                    {preview}
                  </Box>
                );
              })}
              {dayPosts.length > 3 && (
                <Typography
                  variant="caption"
                  sx={{ color: "#5F6368", px: 0.75, fontSize: "0.625rem" }}
                >
                  +{dayPosts.length - 3} more
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
      </Box>
      {/* End sticky header band */}

      {/* Hour grid (shares the outer scroll container) */}
      <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Box
          sx={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, 1fr)`,
          }}
        >
          {HOURS.map((h) => (
            <Box key={`row-${h}`} sx={{ display: "contents" }}>
              <Box
                sx={{
                  height: HOUR_HEIGHT,
                  position: "relative",
                  fontSize: "0.625rem",
                  color: "#5F6368",
                  textAlign: "right",
                  pr: 1,
                }}
              >
                <Box sx={{ position: "absolute", top: -8, right: 8 }}>
                  {formatHourLabel(h)}
                </Box>
              </Box>
              {days.map((day) => (
                <Box
                  key={`${h}-${day.toISOString()}`}
                  onClick={() => onCreatePost(day)}
                  sx={{
                    height: HOUR_HEIGHT,
                    borderTop: "1px solid #E0E0E0",
                    borderLeft: "1px solid #E0E0E0",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "rgba(11,87,208,0.03)" },
                  }}
                />
              ))}
            </Box>
          ))}

          {/* Now indicator (red line + dot) */}
          {weekHasToday && (
            <Box
              sx={{
                position: "absolute",
                top: nowTop,
                left: TIME_COL_WIDTH,
                right: 0,
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: -4,
                  left: `calc(${todayIndex} * (100% / 7) - 4px)`,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "#EA4335",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: `calc(${todayIndex} * (100% / 7))`,
                  width: `calc(100% / 7)`,
                  height: "2px",
                  bgcolor: "#EA4335",
                }}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export function getWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 0 });
}

export function isInWeek(date: Date, weekStart: Date) {
  for (let i = 0; i < 7; i++) {
    if (isSameDay(date, addDays(weekStart, i))) return true;
  }
  return false;
}
