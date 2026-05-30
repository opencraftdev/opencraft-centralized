import { getDaysInMonth, getDay, format, startOfMonth } from "date-fns";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { DayCount } from "../queries";

function getIntensitySx(count: number) {
  if (count === 0) return { bgcolor: "#f1f3f4" };
  if (count === 1) return { bgcolor: "rgba(26,115,232,0.2)" };
  if (count === 2) return { bgcolor: "rgba(26,115,232,0.4)" };
  if (count === 3) return { bgcolor: "rgba(26,115,232,0.6)" };
  return { bgcolor: "rgba(26,115,232,0.8)" };
}

export function CalendarHeatmap({ year, month, data }: { year: number; month: number; data: DayCount[] }) {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const firstDayOfWeek = getDay(startOfMonth(new Date(year, month - 1)));
  const monthLabel = format(new Date(year, month - 1), "MMMM yyyy");

  const countMap: Record<string, number> = {};
  for (const d of data) countMap[d.dateSlot] = d.count;

  const totalPosts = data.reduce((s, d) => s + d.count, 0);
  const activeDays = data.filter(d => d.count > 0).length;

  const cells: { day: number | null; count: number; dateSlot: string }[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null, count: 0, dateSlot: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateSlot = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, count: countMap[dateSlot] ?? 0, dateSlot });
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{monthLabel}</Typography>
      <Typography variant="caption" sx={{ mb: 2, display: "block" }}>
        {totalPosts} posts across {activeDays} active days
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, maxWidth: 320 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <Box key={i} sx={{ textAlign: "center", pb: 0.25 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.625rem", color: "text.secondary" }}>{d}</Typography>
          </Box>
        ))}
        {cells.map((cell, idx) => (
          <Box
            key={idx}
            title={cell.day ? `${cell.dateSlot}: ${cell.count} post${cell.count !== 1 ? "s" : ""}` : undefined}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: cell.day === null ? "transparent" : cell.count > 0 ? "text.primary" : "text.secondary",
              ...(cell.day === null ? {} : getIntensitySx(cell.count)),
            }}
          >
            {cell.day}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
