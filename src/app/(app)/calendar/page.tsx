"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MuiButton from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Popover from "@mui/material/Popover";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { MuiCalendar } from "@/components/calendar/MuiCalendar";
import {
  FullCalendarView,
  type CalendarView,
  type FullCalendarViewHandle,
} from "@/components/calendar/FullCalendarView";
import { PostDetail } from "@/components/posts/PostDetail";
import { useGlobalLoading } from "@/features/content/components/loading-context";
import type { ContentPost, PostSummary } from "@/lib/types";

const LEGEND = [
  { label: "Engage", color: "#1A73E8" },
  { label: "Educate", color: "#188038" },
  { label: "Video", color: "#5F6368" },
];

const STATUS_LEGEND = [
  { label: "Published", color: "#34A853", ring: false },
  { label: "Scheduled", color: "#FBBC04", ring: false },
  { label: "Failed", color: "#EA4335", ring: false },
  { label: "Draft", color: "#DADCE0", ring: true },
];

export default function CalendarPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [view, setView] = useState<CalendarView>("dayGridMonth");
  const [posts, setPosts] = useState<Record<string, PostSummary[]>>({});
  const [headerTitle, setHeaderTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Event detail popover (Google Calendar style), anchored to the clicked event.
  const [detailAnchor, setDetailAnchor] = useState<HTMLElement | null>(null);
  const [detailPost, setDetailPost] = useState<ContentPost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Dim content + show the navbar bar while fetching the month's posts.
  useGlobalLoading(loading);

  const calRef = useRef<FullCalendarViewHandle>(null);

  // Fetch is keyed by the visible month only, so selecting a different day in
  // the same month doesn't trigger a redundant reload.
  const fetchYear = selectedDate.getFullYear();
  const fetchMonth = selectedDate.getMonth() + 1; // 1-12

  const loadPostsForRange = useCallback(async () => {
    setLoading(true);
    try {
      const [curr, prev, next] = await Promise.all([
        fetch(`/api/calendar?year=${fetchYear}&month=${fetchMonth}`).then((r) => r.json()),
        fetch(
          `/api/calendar?year=${fetchMonth === 1 ? fetchYear - 1 : fetchYear}&month=${
            fetchMonth === 1 ? 12 : fetchMonth - 1
          }`,
        ).then((r) => r.json()),
        fetch(
          `/api/calendar?year=${fetchMonth === 12 ? fetchYear + 1 : fetchYear}&month=${
            fetchMonth === 12 ? 1 : fetchMonth + 1
          }`,
        ).then((r) => r.json()),
      ]);
      setPosts({ ...(prev.days ?? {}), ...(curr.days ?? {}), ...(next.days ?? {}) });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fetchYear, fetchMonth]);

  useEffect(() => {
    loadPostsForRange();
  }, [loadPostsForRange]);

  const handlePrev = () => calRef.current?.prev();
  const handleNext = () => calRef.current?.next();
  const handleToday = () => {
    calRef.current?.today();
    setSelectedDate(new Date());
  };
  const handleViewChange = (v: CalendarView) => {
    setView(v);
    calRef.current?.changeView(v);
  };

  const openPost = (id: number, anchorEl: HTMLElement) => {
    setDetailAnchor(anchorEl);
    setDetailPost(null);
    setDetailLoading(true);
    fetch(`/api/posts/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setDetailPost(data?.post ?? null))
      .finally(() => setDetailLoading(false));
  };

  const closeDetail = () => {
    setDetailAnchor(null);
    setDetailPost(null);
  };

  return (
    <Box
      sx={{
        minHeight: "100%",
        bgcolor: "#F0F4F9",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Fixed page header */}
      <Box
        sx={{
          position: "fixed",
          top: 64,
          left: 280,
          right: 0,
          zIndex: 10,
          height: 60,
          bgcolor: "#F0F4F9",
          borderBottom: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            mx: "auto",
            px: 3,
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Typography
            component="h1"
            sx={{
              fontSize: "1.375rem",
              fontWeight: 400,
              color: "#1F1F1F",
              minWidth: 120,
            }}
          >
            Calendar
          </Typography>

          <MuiButton
            onClick={handleToday}
            variant="outlined"
            size="small"
            sx={{
              borderRadius: "9999px",
              borderColor: "#DADCE0",
              color: "#1F1F1F",
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Today
          </MuiButton>

          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton onClick={handlePrev} size="small" sx={{ color: "#5F6368" }}>
              <ChevronLeftOutlined />
            </IconButton>
            <IconButton onClick={handleNext} size="small" sx={{ color: "#5F6368" }}>
              <ChevronRightOutlined />
            </IconButton>
          </Box>

          <Typography sx={{ fontSize: "1.25rem", fontWeight: 400, color: "#1F1F1F", flex: 1 }}>
            {headerTitle}
          </Typography>

          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, v) => v && handleViewChange(v)}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.8125rem",
                px: 2,
                borderColor: "#DADCE0",
                color: "#5F6368",
                "&.Mui-selected": {
                  bgcolor: "#E8F0FE",
                  color: "#0B57D0",
                  "&:hover": { bgcolor: "#D2E3FC" },
                },
              },
            }}
          >
            <ToggleButton value="timeGridDay">Day</ToggleButton>
            <ToggleButton value="timeGridWeek">Week</ToggleButton>
            <ToggleButton value="dayGridMonth">Month</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Body */}
      <Box
        sx={{
          pt: "76px",
          px: 3,
          pb: 3,
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
          gap: 3,
        }}
      >
        {/* Mini calendar sidebar */}
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <MuiCalendar
            year={selectedDate.getFullYear()}
            month={selectedDate.getMonth() + 1}
            selectedDate={selectedDate}
            posts={posts}
            size="compact"
            onChangeDate={(d) => {
              setSelectedDate(d);
              calRef.current?.gotoDate(d);
            }}
            onChangeMonth={(y, m) => {
              const d = new Date(y, m - 1, 1);
              setSelectedDate(d);
              calRef.current?.gotoDate(d);
            }}
          />

          {/* Legend */}
          <Box sx={{ bgcolor: "#fff", borderRadius: "12px", mt: 2, p: 2 }}>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: "#5F6368",
                mb: 1.5,
              }}
            >
              Content types
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {LEGEND.map((item) => (
                <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: item.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043" }}>{item.label}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ height: "1px", bgcolor: "#E8EAED", my: 1.5 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {STATUS_LEGEND.map((item) => (
                <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: item.color,
                      flexShrink: 0,
                      boxShadow: item.ring ? `0 0 0 1px ${item.color}` : "none",
                    }}
                  />
                  <Typography sx={{ fontSize: "0.8125rem", color: "#3C4043" }}>{item.label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* FullCalendar main view */}
        <Box sx={{ minHeight: 0, height: "100%" }}>
          <FullCalendarView
            ref={calRef}
            initialDate={today}
            initialView={view}
            postsByDate={posts}
            onOpenPost={openPost}
            onDatesChange={(anchor, title) => {
              setHeaderTitle(title);
              // Keep the user's day selection within the same month; only jump
              // the anchor when the visible month actually changes.
              setSelectedDate((prev) =>
                prev.getFullYear() === anchor.getFullYear() &&
                prev.getMonth() === anchor.getMonth()
                  ? prev
                  : anchor,
              );
            }}
          />
        </Box>
      </Box>

      {/* Event detail popover — anchored to the clicked calendar event */}
      <Popover
        open={Boolean(detailAnchor)}
        anchorEl={detailAnchor}
        onClose={closeDetail}
        anchorOrigin={{ vertical: "center", horizontal: "right" }}
        transformOrigin={{ vertical: "center", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "72vh",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        {/* Toolbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.5,
            px: 1,
            py: 0.5,
            flexShrink: 0,
          }}
        >
          {detailPost && (
            <IconButton
              component={Link}
              href={`/posts?post=${detailPost.id}`}
              size="small"
              aria-label="Open in Posts"
              sx={{ color: "#5F6368" }}
            >
              <OpenInNewOutlined sx={{ fontSize: 18 }} />
            </IconButton>
          )}
          <IconButton onClick={closeDetail} size="small" aria-label="Close" sx={{ color: "#5F6368" }}>
            <CloseOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {detailLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
              <CircularProgress size={22} />
            </Box>
          ) : detailPost ? (
            <PostDetail post={detailPost} />
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Post not found.
              </Typography>
            </Box>
          )}
        </Box>
      </Popover>
    </Box>
  );
}
