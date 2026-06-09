"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import Box from "@mui/material/Box";
import type { PostSummary } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  engage: "#1A73E8",
  educate: "#188038",
  video: "#5F6368",
};

// Small status indicator dot shown on each event.
const STATUS_DOT: Record<string, string> = {
  published: "#34A853",
  posted: "#34A853",
  publishing: "#00838F",
  scheduled: "#FBBC04",
  accepted: "#1A73E8",
  failed: "#EA4335",
  draft: "#DADCE0",
};

// Per-event colors: type drives the hue; status tweaks the treatment so the
// read-only calendar reads at a glance (drafts muted, failures flagged red).
function eventColors(type: string, status: string): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  const base = TYPE_COLORS[type] ?? "#9AA0A6";
  if (status === "failed") {
    return { backgroundColor: "#FCE8E6", borderColor: "#D93025", textColor: "#C5221F" };
  }
  if (status === "draft") {
    return { backgroundColor: "#F1F3F4", borderColor: base, textColor: "#3C4043" };
  }
  return { backgroundColor: base, borderColor: base, textColor: "#fff" };
}

export type CalendarView = "timeGridWeek" | "dayGridMonth" | "timeGridDay";

export interface FullCalendarViewHandle {
  prev: () => void;
  next: () => void;
  today: () => void;
  gotoDate: (date: Date) => void;
  changeView: (view: CalendarView) => void;
  getTitle: () => string;
}

interface FullCalendarViewProps {
  initialDate?: Date;
  initialView?: CalendarView;
  postsByDate: Record<string, PostSummary[]>;
  onOpenPost: (id: number, anchorEl: HTMLElement) => void;
  // Fires when the visible range changes; `anchorDate` is the current period's
  // own start (month/week/day), not the leading grid cell.
  onDatesChange?: (anchorDate: Date, title: string) => void;
  onDateClick?: (dateStr: string) => void;
}

export const FullCalendarView = forwardRef<FullCalendarViewHandle, FullCalendarViewProps>(
  function FullCalendarView(
    { initialDate, initialView = "timeGridWeek", postsByDate, onOpenPost, onDatesChange, onDateClick },
    ref,
  ) {
    const calendarRef = useRef<FullCalendar>(null);

    useImperativeHandle(ref, () => ({
      prev: () => calendarRef.current?.getApi().prev(),
      next: () => calendarRef.current?.getApi().next(),
      today: () => calendarRef.current?.getApi().today(),
      gotoDate: (date: Date) => calendarRef.current?.getApi().gotoDate(date),
      changeView: (view: CalendarView) => calendarRef.current?.getApi().changeView(view),
      getTitle: () => calendarRef.current?.getApi().view.title ?? "",
    }));

    const events: EventInput[] = useMemo(() => {
      const out: EventInput[] = [];
      for (const [dateSlot, posts] of Object.entries(postsByDate)) {
        for (const post of posts) {
          const title =
            post.headline ?? post.textContent?.slice(0, 60) ?? "Untitled post";
          out.push({
            id: String(post.id),
            title,
            start: post.scheduledAt ?? dateSlot,
            end: post.scheduledAt
              ? new Date(new Date(post.scheduledAt).getTime() + 60 * 60 * 1000).toISOString()
              : undefined,
            allDay: !post.scheduledAt,
            ...eventColors(post.type, post.status),
            extendedProps: { postId: post.id, type: post.type, status: post.status },
          });
        }
      }
      return out;
    }, [postsByDate]);

    const handleEventClick = (info: EventClickArg) => {
      const postId = info.event.extendedProps.postId as number | undefined;
      if (postId != null) onOpenPost(postId, info.el as HTMLElement);
    };

    return (
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          overflow: "hidden",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",

          // --- Google Calendar look (MUI palette) ---
          "& .fc": {
            height: "100%",
            fontFamily: "var(--font-roboto), Roboto, Helvetica, Arial, sans-serif",
            "--fc-border-color": "#E0E0E0",
            "--fc-page-bg-color": "#fff",
            "--fc-neutral-bg-color": "#F8F9FA",
            "--fc-today-bg-color": "rgba(11,87,208,0.04)",
            "--fc-now-indicator-color": "#EA4335",
            "--fc-button-text-color": "#1F1F1F",
            "--fc-button-bg-color": "#fff",
            "--fc-button-border-color": "#DADCE0",
            "--fc-button-active-bg-color": "#E8F0FE",
            "--fc-button-active-border-color": "#0B57D0",
            "--fc-button-hover-bg-color": "#F8F9FA",
          },

          // Hide FC's own toolbar — we have our own
          "& .fc .fc-toolbar.fc-header-toolbar": { display: "none" },

          // Column header (SUN 24 / MON 25 / ...)
          "& .fc .fc-col-header-cell": {
            borderColor: "#E0E0E0",
            background: "#fff",
            verticalAlign: "top",
          },
          "& .fc .fc-col-header-cell-cushion": {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            padding: "8px 0 6px",
            textDecoration: "none",
            color: "#70757A",
          },
          "& .fc .fc-col-header-cell-cushion .fc-weekday": {
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.8px",
            lineHeight: 1,
            color: "#70757A",
          },
          "& .fc .fc-col-header-cell-cushion .fc-day-num": {
            fontSize: "1.5rem",
            fontWeight: 400,
            lineHeight: 1,
            color: "#3C4043",
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            transition: "background-color 120ms",
          },
          "& .fc .fc-col-header-cell:hover .fc-day-num": {
            backgroundColor: "rgba(60,64,67,0.08)",
          },
          // Today: blue weekday + blue filled date circle
          "& .fc .fc-day-today .fc-col-header-cell-cushion .fc-weekday": {
            color: "#0B57D0",
          },
          "& .fc .fc-day-today .fc-col-header-cell-cushion .fc-day-num": {
            backgroundColor: "#0B57D0",
            color: "#fff",
          },
          "& .fc .fc-day-today.fc-col-header-cell:hover .fc-day-num": {
            backgroundColor: "#0B57D0",
          },

          // Time labels (left gutter)
          "& .fc .fc-timegrid-axis-cushion, & .fc .fc-timegrid-slot-label-cushion": {
            color: "#70757A",
            fontSize: "0.625rem",
          },
          "& .fc .fc-timegrid-slot": { height: "48px" },
          "& .fc .fc-timegrid-slot-label": { borderColor: "transparent" },
          "& .fc .fc-timegrid-slot-minor": { borderTopStyle: "dotted" },

          // All-day section
          "& .fc .fc-timegrid-axis-frame": {
            justifyContent: "flex-end",
            paddingRight: 8,
          },
          "& .fc .fc-daygrid-day-events": { minHeight: 0 },

          // Events
          "& .fc .fc-event": {
            border: "none",
            borderRadius: 4,
            padding: "1px 6px",
            fontSize: "0.6875rem",
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "none",
          },
          "& .fc .fc-event:hover": { filter: "brightness(0.92)" },
          "& .fc .fc-event-time": { fontWeight: 500, marginRight: 4 },

          // Now indicator line
          "& .fc .fc-timegrid-now-indicator-line": {
            borderColor: "#EA4335",
            borderWidth: "0 0 2px 0",
          },
          "& .fc .fc-timegrid-now-indicator-arrow": {
            borderColor: "#EA4335",
            borderWidth: "5px 0 5px 6px",
            borderRightColor: "transparent",
          },

          // ---- Month view (Google Calendar look — simplified) ----
          // Lighter cell borders
          "& .fc-dayGridMonth-view .fc-scrollgrid, & .fc-dayGridMonth-view td, & .fc-dayGridMonth-view th": {
            borderColor: "#E8EAED",
          },
          "& .fc-dayGridMonth-view .fc-daygrid-day-frame": {
            padding: "2px 0 4px",
            minHeight: 120,
          },
          // Day-number row: centered, breathing room at top
          "& .fc-dayGridMonth-view .fc-daygrid-day-top": {
            justifyContent: "center",
            paddingTop: 6,
            paddingBottom: 4,
          },
          "& .fc-dayGridMonth-view .fc-daygrid-day-number": {
            color: "#3C4043",
            fontSize: "0.625rem",
            fontWeight: 500,
            padding: 0,
            textDecoration: "none",
            lineHeight: 1,
            letterSpacing: 0,
          },
          // Today: small subtle blue pill (Google style)
          "& .fc-dayGridMonth-view .fc-day-today .fc-daygrid-day-number": {
            color: "#fff",
            backgroundColor: "#0B57D0",
            borderRadius: "9999px",
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          },
          // Kill the today-cell tint — keeps the month grid clean
          "& .fc-dayGridMonth-view .fc-day-today": {
            backgroundColor: "transparent !important",
          },
          // Dim days outside the current month
          "& .fc-dayGridMonth-view .fc-day-other .fc-daygrid-day-number": {
            color: "#BDC1C6",
          },
          // Simpler month-view header — weekday only, centered + small
          "& .fc-dayGridMonth-view .fc-col-header-cell": {
            borderBottom: "1px solid #E8EAED",
            padding: 0,
            textAlign: "center",
          },
          "& .fc-dayGridMonth-view .fc-scrollgrid-sync-inner": {
            textAlign: "center",
          },
          "& .fc-dayGridMonth-view .fc-col-header-cell-cushion": {
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "6px 0",
            width: "100%",
            flexDirection: "row",
          },
          "& .fc-dayGridMonth-view .fc-col-header-cell-cushion .fc-day-num": {
            display: "none",
          },
          "& .fc-dayGridMonth-view .fc-col-header-cell-cushion .fc-weekday": {
            fontSize: "0.625rem",
            fontWeight: 500,
            letterSpacing: "0.8px",
            color: "#70757A",
            textAlign: "center",
          },
          // Events in month view: clean Google-style bars
          "& .fc-dayGridMonth-view .fc-daygrid-event-harness": {
            margin: "1px 0",
          },
          "& .fc-dayGridMonth-view .fc-daygrid-event": {
            padding: "1px 6px",
            margin: "0 6px",
            borderRadius: 4,
            fontSize: "0.625rem",
            fontWeight: 500,
            lineHeight: 1.3,
          },
          // "+N more" link
          "& .fc-dayGridMonth-view .fc-daygrid-more-link": {
            color: "#5F6368",
            fontSize: "0.625rem",
            fontWeight: 500,
            padding: "0 8px",
          },

          // Selection highlight
          "& .fc .fc-highlight": {
            backgroundColor: "rgba(11,87,208,0.12)",
          },
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView={initialView}
          initialDate={initialDate}
          headerToolbar={false}
          firstDay={0}
          allDaySlot
          allDayText="All day"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="01:00"
          slotLabelFormat={{ hour: "numeric", meridiem: "short" }}
          dayHeaderContent={(arg) => {
            const weekday = arg.date
              .toLocaleDateString("en-US", { weekday: "short" })
              .toUpperCase();
            // Week + Day views: stack weekday on top, big date number below
            if (arg.view.type.startsWith("timeGrid")) {
              return {
                html: `<span class="fc-weekday">${weekday}</span><span class="fc-day-num">${arg.date.getDate()}</span>`,
              };
            }
            // Month view: just weekday
            return weekday;
          }}
          nowIndicator
          editable={false}
          selectable={false}
          dayMaxEvents
          scrollTime={`${Math.max(0, new Date().getHours() - 1)
            .toString()
            .padStart(2, "0")}:00:00`}
          events={events}
          eventClick={handleEventClick}
          dateClick={(arg: DateClickArg) => onDateClick?.(arg.dateStr)}
          eventContent={(arg) => {
            const status = (arg.event.extendedProps.status as string) ?? "";
            return (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  minWidth: 0,
                  width: "100%",
                  px: "2px",
                  lineHeight: 1.3,
                }}
              >
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    flexShrink: 0,
                    bgcolor: STATUS_DOT[status] ?? "currentColor",
                    boxShadow: "0 0 0 1.5px rgba(255,255,255,0.65)",
                  }}
                />
                {arg.timeText && (
                  <Box component="span" sx={{ fontWeight: 600, flexShrink: 0 }}>
                    {arg.timeText}
                  </Box>
                )}
                <Box
                  component="span"
                  sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {arg.event.title}
                </Box>
              </Box>
            );
          }}
          datesSet={(info) => onDatesChange?.(info.view.currentStart, info.view.title)}
          height="100%"
          expandRows
        />
      </Box>
    );
  },
);
