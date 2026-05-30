"use client";

import {
  startOfMonth,
  getDaysInMonth,
  getDay,
  format,
  addDays,
} from "date-fns";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { PostSummary } from "@/lib/types";
import { DayCell } from "./DayCell";

interface CalendarGridProps {
  year: number;
  month: number;
  posts: Record<string, PostSummary[]>;
  onAddPost: (dateStr: string) => void;
  onOpenPost: (postId: number) => void;
}

const DAY_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function CalendarGrid({ year, month, posts, onAddPost, onOpenPost }: CalendarGridProps) {
  const today = new Date();
  const firstDay = startOfMonth(new Date(year, month - 1));
  const startOffset = getDay(firstDay);
  const daysInMonth = getDaysInMonth(firstDay);
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const todayStr = format(today, "yyyy-MM-dd");

  const cells: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];

  const prevMonthLast = addDays(firstDay, -1);
  const prevDaysInMonth = getDaysInMonth(prevMonthLast);
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevDaysInMonth - i;
    const date = new Date(year, month - 2, d);
    cells.push({ day: d, dateStr: format(date, "yyyy-MM-dd"), isCurrentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    cells.push({ day: d, dateStr: format(date, "yyyy-MM-dd"), isCurrentMonth: true });
  }

  let nextDay = 1;
  while (cells.length < totalCells) {
    const date = new Date(year, month, nextDay);
    cells.push({ day: nextDay, dateStr: format(date, "yyyy-MM-dd"), isCurrentMonth: false });
    nextDay++;
  }

  return (
    <Box sx={{ flex: 1, overflow: "auto", bgcolor: "background.default" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: 1, borderColor: "divider", position: "sticky", top: 0, zIndex: 10, bgcolor: "background.paper" }}>
        {DAY_HEADERS.map((h) => (
          <Box key={h} sx={{ py: 1.25, textAlign: "center" }}>
            <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {h}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((cell, i) => (
          <DayCell
            key={`${cell.dateStr}-${i}`}
            day={cell.day}
            dateStr={cell.dateStr}
            isToday={cell.dateStr === todayStr}
            isCurrentMonth={cell.isCurrentMonth}
            posts={posts[cell.dateStr] ?? []}
            onAddPost={onAddPost}
            onOpenPost={onOpenPost}
          />
        ))}
      </Box>
    </Box>
  );
}
