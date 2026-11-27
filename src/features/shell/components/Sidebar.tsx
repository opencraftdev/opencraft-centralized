"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import FeedbackOutlined from "@mui/icons-material/FeedbackOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import TravelExploreOutlined from "@mui/icons-material/TravelExploreOutlined";
import TaskAltRounded from "@mui/icons-material/TaskAltRounded";
import { NavLinkLoading } from "./loading-context";

const SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 64;

type NavItem = { href: string; label: string; icon: React.ReactNode };

// Sidebar sections, in order. Each section has a small header and a divider between sections.
const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Tools",
    items: [
      { href: "/chat", label: "Chat", icon: <ChatBubbleOutlineRounded /> },
      { href: "/skills", label: "Skills", icon: <AutoAwesomeOutlined /> },
    ],
  },
  {
    title: "Operational",
    items: [
      { href: "/tasks", label: "Task Management", icon: <TaskAltRounded /> },
      { href: "/documents", label: "Document", icon: <DescriptionOutlined /> },
      { href: "/finance", label: "Finance", icon: <AccountBalanceWalletOutlined /> },
      { href: "/scrapers", label: "Scrapers", icon: <TravelExploreOutlined /> },
    ],
  },
];
const primaryItems: NavItem[] = sections.flatMap((s) => s.items);

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

// Permanent drawer from md up; below md a temporary drawer toggled by the TopBar hamburger.
export function Sidebar({
  userEmail: _userEmail,
  mobileOpen = false,
  onMobileClose,
}: {
  userEmail: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();

  const navHrefs = [...primaryItems, ...bottomItems]
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

  const paper = {
    width: SIDEBAR_WIDTH,
    top: TOPBAR_HEIGHT,
    height: `calc(100dvh - ${TOPBAR_HEIGHT}px)`,
    boxSizing: "border-box",
    bgcolor: "#F0F4F9",
    border: "none",
    overflowY: "auto",
    px: 2,
    py: 1.5,
    display: "flex",
    flexDirection: "column",
  } as const;

  const content = (
    <>
      {sections.map((section, i) => (
        <Box key={section.title}>
          {i > 0 && <Divider sx={{ borderColor: "#DADCE0", mx: 1, my: 1 }} />}
          <Typography
            component="h2"
            sx={{ px: 2, pt: i > 0 ? 0.5 : 0, pb: 0.5, fontSize: "0.6875rem", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#5F6368" }}
          >
            {section.title}
          </Typography>
          <List disablePadding component="nav" aria-label={section.title}>
            {section.items.map((item) => (
              <NavRow key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </List>
        </Box>
      ))}


      {/* Bottom items — pushed to bottom */}
      <Box sx={{ mt: "auto", pt: 1 }}>
        <Divider sx={{ borderColor: "#DADCE0", mx: 1, mb: 1 }} />
        <List disablePadding component="nav">
          {bottomItems.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} />
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
    </>
  );

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{ display: { xs: "none", md: "block" }, width: SIDEBAR_WIDTH, flexShrink: 0, "& .MuiDrawer-paper": paper }}
      >
        {content}
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        onClick={(e) => (e.target as HTMLElement).closest("a") && onMobileClose?.()}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { ...paper, top: TOPBAR_HEIGHT } }}
      >
        {content}
      </Drawer>
    </>
  );
}
