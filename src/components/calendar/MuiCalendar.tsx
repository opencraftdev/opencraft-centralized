"use client";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickerDay, type PickerDayProps } from "@mui/x-date-pickers/PickerDay";
import { format } from "date-fns";
import Box from "@mui/material/Box";
import type { PostSummary } from "@/lib/types";

const TYPE_DOT_COLORS: Record<string, string> = {
  engage: "#4285F4",
  educate: "#34A853",
  video: "#5F6368",
};

interface MuiCalendarProps {
  year: number;
  month: number;
  selectedDate: Date | null;
  posts: Record<string, PostSummary[]>;
  onChangeDate: (date: Date) => void;
  onChangeMonth: (year: number, month: number) => void;
  size?: "compact" | "full";
}

type DayProps = PickerDayProps & {
  postsByDate?: Record<string, PostSummary[]>;
  cellSize?: number;
  dotSize?: number;
};

function DayWithDots(props: DayProps) {
  const { postsByDate, day, outsideCurrentMonth, cellSize = 36, dotSize = 4, ...rest } = props;
  const key = format(day, "yyyy-MM-dd");
  const dayPosts = (postsByDate ?? {})[key] ?? [];
  const dots = dayPosts.slice(0, 3);
  const hasMore = dayPosts.length > 3;

  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <PickerDay
        {...rest}
        day={day}
        outsideCurrentMonth={outsideCurrentMonth}
        sx={{
          width: cellSize,
          height: cellSize,
          fontSize: cellSize >= 48 ? "0.9375rem" : "0.8125rem",
          fontWeight: 500,
          color: outsideCurrentMonth ? "#9AA0A6" : "#1F1F1F",
          "&.Mui-selected": {
            bgcolor: "#0B57D0",
            color: "#fff",
            "&:hover, &:focus": { bgcolor: "#0B57D0" },
          },
          "&.MuiPickerDay-today": {
            border: "1px solid #0B57D0",
            color: "#0B57D0",
            "&.Mui-selected": { color: "#fff" },
          },
          "&:hover": { bgcolor: "rgba(11,87,208,0.08)" },
        }}
      />
      {dayPosts.length > 0 && !outsideCurrentMonth && (
        <Box
          sx={{
            position: "absolute",
            bottom: cellSize >= 48 ? 6 : 3,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "2px",
            pointerEvents: "none",
          }}
        >
          {dots.map((post, i) => (
            <Box
              key={i}
              sx={{
                width: dotSize,
                height: dotSize,
                borderRadius: "50%",
                bgcolor: TYPE_DOT_COLORS[post.type] ?? "#9AA0A6",
              }}
            />
          ))}
          {hasMore && (
            <Box
              sx={{
                width: dotSize,
                height: dotSize,
                borderRadius: "50%",
                bgcolor: "#9AA0A6",
              }}
            />
          )}
        </Box>
      )}
    </Box>
  );
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
  const referenceDate = new Date(year, month - 1, 1);
  const compact = size === "compact";
  const cellSize = compact ? 32 : 56;
  const dotSize = compact ? 3 : 5;
  const calendarWidth = compact ? 240 : 560;
  const minHeight = compact ? 200 : 380;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          p: compact ? 1 : 2,
          "& .MuiDateCalendar-root": {
            width: "100%",
            maxWidth: calendarWidth,
            maxHeight: "none",
            height: "auto",
          },
          "& .MuiPickersCalendarHeader-root": {
            pl: compact ? 1 : 2,
            pr: 1,
            mt: 0,
            mb: 0.5,
            minHeight: compact ? 32 : 48,
          },
          "& .MuiPickersCalendarHeader-label": {
            fontSize: compact ? "0.875rem" : "1.125rem",
            fontWeight: 500,
            color: "#1F1F1F",
          },
          "& .MuiDayCalendar-header": {
            justifyContent: "space-around",
          },
          "& .MuiDayCalendar-weekDayLabel": {
            width: cellSize,
            height: compact ? 24 : 32,
            fontSize: compact ? "0.625rem" : "0.75rem",
            fontWeight: 500,
            color: "#5F6368",
            textTransform: "uppercase",
          },
          "& .MuiDayCalendar-weekContainer": {
            justifyContent: "space-around",
            margin: compact ? "0" : "2px 0",
          },
          "& .MuiPickersSlideTransition-root": {
            minHeight,
          },
        }}
      >
        <DateCalendar
          value={selectedDate}
          referenceDate={referenceDate}
          onChange={(date) => date && onChangeDate(date)}
          onMonthChange={(date) =>
            onChangeMonth(date.getFullYear(), date.getMonth() + 1)
          }
          views={["day"]}
          slots={{ day: DayWithDots }}
          slotProps={{
            day: { postsByDate: posts, cellSize, dotSize } as DayProps,
          }}
        />
      </Box>
    </LocalizationProvider>
  );
}
