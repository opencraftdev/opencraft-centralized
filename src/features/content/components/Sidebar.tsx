"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import CalendarTodayOutlined from "@mui/icons-material/CalendarTodayOutlined";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import VideocamOutlined from "@mui/icons-material/VideocamOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import FeedbackOutlined from "@mui/icons-material/FeedbackOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlined from "@mui/icons-material/ExpandLessOutlined";
import SmartToyOutlined from "@mui/icons-material/SmartToyOutlined";
import RateReviewOutlined from "@mui/icons-material/RateReviewOutlined";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import { NavLinkLoading } from "./loading-context";

const SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 64;

type NavItem = { href: string; label: string; icon: React.ReactNode };

const primaryItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: <HomeOutlined /> },
  { href: "/monitor", label: "Document", icon: <DescriptionOutlined /> },
];

const blogItems: NavItem[] = [
  { href: "/monitor/blog", label: "History", icon: <HistoryOutlined /> },
  { href: "/monitor/blog/performance", label: "Performance", icon: <TrendingUpOutlined /> },
  { href: "/monitor/blog/audit", label: "SEO Audit", icon: <FactCheckOutlined /> },
];

const commentBotItems: NavItem[] = [
  { href: "/comment-bot", label: "Overview", icon: <SmartToyOutlined /> },
  { href: "/comment-bot/queue", label: "Review Queue", icon: <RateReviewOutlined /> },
  { href: "/comment-bot/history", label: "History", icon: <HistoryOutlined /> },
  { href: "/comment-bot/brand", label: "Brand Profile", icon: <ManageAccountsOutlined /> },
];

const contentItems: NavItem[] = [
  { href: "/posts", label: "Posts", icon: <ArticleOutlined /> },
  { href: "/calendar", label: "Calendar", icon: <CalendarTodayOutlined /> },
  { href: "/tutorial-video", label: "Record Video", icon: <VideocamOutlined /> },
];

const bottomItems: NavItem[] = [
  { href: "#feedback", label: "Submit feedback", icon: <FeedbackOutlined /> },
  { href: "#about", label: "About OpenCraft", icon: <InfoOutlined /> },
];

function NavRow({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const isAnchor = item.href.startsWith("#");
  return (
    <ListItemButton
      {...(isAnchor ? { component: "a", href: item.href } : { component: Link, href: item.href })}
      selected={active}
      sx={{
        my: "2px",
        height: 48,
        px: 2,
        borderRadius: "9999px",
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: 0,
          mr: 2,
          color: active ? "#0B57D0" : "#444746",
          "& .MuiSvgIcon-root": { fontSize: 24 },
        }}
      >
        {item.icon}
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        slotProps={{
          primary: {
            sx: {
              fontSize: "0.9375rem",
              fontWeight: active ? 600 : 500,
              color: "inherit",
            },
          },
        }}
      />
      {/* Report route-transition pending to the global loading state */}
      {!isAnchor && <NavLinkLoading />}
    </ListItemButton>
  );
}

function SectionHeader({
  title,
  isOpen,
  onToggle,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        bgcolor: "transparent",
        border: "none",
        cursor: "pointer",
        px: 2,
        pt: 1.5,
        pb: 1,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: 500,
          letterSpacing: "0.25px",
          color: "#444746",
          textTransform: "none",
        }}
      >
        {title}
      </Typography>
      {isOpen ? (
        <ExpandLessOutlined sx={{ fontSize: 20, color: "#444746" }} />
      ) : (
        <ExpandMoreOutlined sx={{ fontSize: 20, color: "#444746" }} />
      )}
    </Box>
  );
}

export function Sidebar({ userEmail: _userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [blogsOpen, setBlogsOpen] = useState(true);
  const [commentBotOpen, setCommentBotOpen] = useState(true);
  const [contentOpen, setContentOpen] = useState(true);

  const navHrefs = [...primaryItems, ...blogItems, ...commentBotItems, ...contentItems]
    .map((i) => i.href)
    .filter((h) => !h.startsWith("#"));

  const isActive = (href: string) => {
    if (href.startsWith("#")) return false;
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    // Prefer the most specific match: don't light up a parent (e.g. /monitor)
    // when a deeper sibling (e.g. /monitor/blog) also matches the path.
    return !navHrefs.some((h) => h !== href && h.startsWith(href + "/") && (pathname === h || pathname.startsWith(h + "/")));
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: SIDEBAR_WIDTH,
          top: TOPBAR_HEIGHT,
          height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
          boxSizing: "border-box",
          bgcolor: "#F0F4F9",
          border: "none",
          overflowY: "auto",
          px: 2,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Overview at top */}
      <List disablePadding component="nav">
        {primaryItems.map((item) => (
          <NavRow key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </List>

      {/* Collapsible: Blogs */}
      <Box sx={{ mt: 1 }}>
        <Divider sx={{ borderColor: "#DADCE0", mx: 1 }} />
        <SectionHeader
          title="Blogs"
          isOpen={blogsOpen}
          onToggle={() => setBlogsOpen(!blogsOpen)}
        />
        <Collapse in={blogsOpen}>
          <List disablePadding>
            {blogItems.map((item) => (
              <NavRow key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </List>
        </Collapse>
      </Box>

      {/* Collapsible: Comment Bot */}
      <Box sx={{ mt: 1 }}>
        <Divider sx={{ borderColor: "#DADCE0", mx: 1 }} />
        <SectionHeader
          title="Comment Bot"
          isOpen={commentBotOpen}
          onToggle={() => setCommentBotOpen(!commentBotOpen)}
        />
        <Collapse in={commentBotOpen}>
          <List disablePadding>
            {commentBotItems.map((item) => (
              <NavRow key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </List>
        </Collapse>
      </Box>

      {/* Collapsible: Content */}
      <Box sx={{ mt: 1 }}>
        <Divider sx={{ borderColor: "#DADCE0", mx: 1 }} />
        <SectionHeader
          title="Social Media"
          isOpen={contentOpen}
          onToggle={() => setContentOpen(!contentOpen)}
        />
        <Collapse in={contentOpen}>
          <List disablePadding>
            {contentItems.map((item) => (
              <NavRow key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </List>
        </Collapse>
      </Box>

      {/* Bottom items — pushed to bottom */}
      <Box sx={{ mt: "auto", pt: 1 }}>
        <Divider sx={{ borderColor: "#DADCE0", mx: 1, mb: 1 }} />
        <List disablePadding component="nav">
          {bottomItems.map((item) => (
            <NavRow key={item.href} item={item} active={false} />
          ))}
        </List>

        {/* Footer */}
        <Box sx={{ display: "flex", gap: 2, px: 2, py: 1.5 }}>
          <Typography
            component="a"
            href="#"
            sx={{
              fontSize: "0.75rem",
              color: "#757575",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Privacy
          </Typography>
          <Typography
            component="a"
            href="#"
            sx={{
              fontSize: "0.75rem",
              color: "#757575",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Terms
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
