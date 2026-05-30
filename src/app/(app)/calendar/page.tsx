"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MuiButton from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import { MuiCalendar } from "@/components/calendar/MuiCalendar";
import {
  FullCalendarView,
  type CalendarView,
  type FullCalendarViewHandle,
} from "@/components/calendar/FullCalendarView";
import { QuickCreatePostPopover } from "@/components/calendar/QuickCreatePostPopover";
import { CreatePostModal } from "@/components/generate/CreatePostModal";
import type { PostSummary } from "@/lib/types";

export default function CalendarPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [view, setView] = useState<CalendarView>("dayGridMonth");
  const [posts, setPosts] = useState<Record<string, PostSummary[]>>({});
  const [headerTitle, setHeaderTitle] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverDate, setPopoverDate] = useState<string>("");
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const calRef = useRef<FullCalendarViewHandle>(null);

  const loadPostsForRange = useCallback(async () => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth() + 1;
    try {
      const [curr, prev, next] = await Promise.all([
        fetch(`/api/calendar?year=${y}&month=${m}`).then((r) => r.json()),
        fetch(`/api/calendar?year=${m === 1 ? y - 1 : y}&month=${m === 1 ? 12 : m - 1}`).then((r) =>
          r.json(),
        ),
        fetch(`/api/calendar?year=${m === 12 ? y + 1 : y}&month=${m === 12 ? 1 : m + 1}`).then((r) =>
          r.json(),
        ),
      ]);
      setPosts({ ...(prev.days ?? {}), ...(curr.days ?? {}), ...(next.days ?? {}) });
    } catch {
      // ignore
    }
  }, [selectedDate]);

  useEffect(() => {
    loadPostsForRange();
  }, [loadPostsForRange, refreshKey]);

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

  const openQuickCreate = (date: Date, anchor?: { top: number; left: number }) => {
    setPopoverDate(format(date, "yyyy-MM-dd"));
    setPopoverPos(anchor ?? null);
    setPopoverOpen(true);
  };

  const handleMoreOptions = () => {
    setModalDate(popoverDate);
    setPopoverOpen(false);
    setModalOpen(true);
  };

  const openPost = (id: number) => {
    window.location.href = `/posts/${id}`;
  };

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/calendar/autogenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: selectedDate.getFullYear(),
          month: selectedDate.getMonth() + 1,
        }),
      });
      const data = await res.json();
      if (data.created > 0) {
        setRefreshKey((k) => k + 1);
        alert(`Created ${data.created} post${data.created !== 1 ? "s" : ""}.`);
      } else {
        alert("No days available for auto-generation.");
      }
    } catch {
      alert("Auto-generate failed.");
    } finally {
      setIsGenerating(false);
    }
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

          <MuiButton
            variant="outlined"
            size="small"
            onClick={handleAutoGenerate}
            disabled={isGenerating}
            startIcon={
              isGenerating ? (
                <CircularProgress size={14} thickness={5} />
              ) : (
                <AutoAwesomeOutlined sx={{ fontSize: 18 }} />
              )
            }
            sx={{
              borderRadius: "9999px",
              borderColor: "#DADCE0",
              color: "#0B57D0",
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Auto-generate
          </MuiButton>
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
        </Box>

        {/* FullCalendar main view */}
        <Box sx={{ minHeight: 0, height: "100%" }}>
          <FullCalendarView
            ref={calRef}
            initialDate={today}
            initialView={view}
            postsByDate={posts}
            onCreatePost={openQuickCreate}
            onOpenPost={openPost}
            onDatesChange={(start, _end, title) => {
              setSelectedDate(start);
              setHeaderTitle(title);
            }}
          />
        </Box>
      </Box>

      <QuickCreatePostPopover
        open={popoverOpen}
        anchorEl={null}
        anchorPosition={popoverPos}
        dateStr={popoverDate}
        onClose={() => setPopoverOpen(false)}
        onCreated={(postId) => {
          setRefreshKey((k) => k + 1);
          if (postId) window.location.href = `/posts/${postId}`;
        }}
        onMoreOptions={handleMoreOptions}
      />

      <CreatePostModal
        open={modalOpen}
        dateStr={modalDate}
        onClose={() => setModalOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </Box>
  );
}
