"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ChatBubbleRounded from "@mui/icons-material/ChatBubbleRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import TravelExploreRounded from "@mui/icons-material/TravelExploreRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import { EASE_OUT_CSS, SPRING } from "@/components/ui/motion";
import { NavLinkLoading } from "./loading-context";

export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_MINI_WIDTH = 72;
const TOPBAR_HEIGHT = 64;
const WIDTH_TRANSITION = `width 280ms ${EASE_OUT_CSS}`;

type NavItem = { href: string; label: string; icon: React.ReactNode };

// Sidebar sections, in order. Each section has a small header and a divider between sections.
const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Tools",
    items: [
      { href: "/chat", label: "Chat", icon: <ChatBubbleRounded /> },
      { href: "/skills", label: "Skills", icon: <AutoAwesomeRounded /> },
    ],
  },
  {
    title: "Operational",
    items: [
      { href: "/tasks", label: "Task Management", icon: <AssignmentTurnedInRounded /> },
      { href: "/documents", label: "Document", icon: <DescriptionRounded /> },
      { href: "/finance", label: "Finance", icon: <AccountBalanceWalletRounded /> },
      { href: "/scrapers", label: "Scrapers", icon: <TravelExploreRounded /> },
    ],
  },
];
const navHrefs = sections.flatMap((s) => s.items.map((i) => i.href));

function NavRow({ item, active, mini, pillId }: { item: NavItem; active: boolean; mini: boolean; pillId: string }) {
  const row = (
    <ListItemButton
      component={Link}
      href={item.href}
      aria-label={mini ? item.label : undefined}
      sx={{
        position: "relative",
        my: "2px",
        height: 48,
        px: 2,
        borderRadius: "9999px",
        color: active ? "#0B57D0" : "#444746",
        bgcolor: "transparent !important",
        overflow: "hidden",
        "&:hover .nav-hover": { opacity: 1 },
      }}
    >
      {/* Hover tint */}
      <Box className="nav-hover" sx={{ position: "absolute", inset: 0, borderRadius: "inherit", bgcolor: "rgba(68,71,70,0.08)", opacity: 0, transition: "opacity 150ms" }} />
      {/* Active pill: one shared element that glides between rows */}
      {active && (
        <motion.span
          layoutId={pillId}
          transition={SPRING}
          style={{ position: "absolute", inset: 0, borderRadius: 9999, background: "#C2E7FF" }}
        />
      )}
      <ListItemIcon sx={{ position: "relative", minWidth: 0, mr: 2, color: "inherit", "& .MuiSvgIcon-root": { fontSize: 24 } }}>{item.icon}</ListItemIcon>
      <Box
        component="span"
        sx={{
          position: "relative",
          fontSize: "0.9375rem",
          fontWeight: active ? 600 : 500,
          whiteSpace: "nowrap",
          opacity: mini ? 0 : 1,
          transform: mini ? "translateX(-6px)" : "none",
          transition: `opacity 180ms ${EASE_OUT_CSS}, transform 280ms ${EASE_OUT_CSS}`,
        }}
      >
        {item.label}
      </Box>
      {/* Report route-transition pending to the global loading state */}
      <NavLinkLoading />
    </ListItemButton>
  );
  return mini ? (
    <Tooltip title={item.label} placement="right">
      {row}
    </Tooltip>
  ) : (
    row
  );
}

// Permanent drawer from md up (full or icon-only "mini", toggled by the TopBar hamburger);
// below md a temporary drawer opened by the same hamburger.
export function Sidebar({
  mini = false,
  mobileOpen = false,
  onMobileClose,
}: {
  userEmail?: string;
  mini?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    // Prefer the most specific match.
    return !navHrefs.some((h) => h !== href && h.startsWith(href + "/") && (pathname === h || pathname.startsWith(h + "/")));
  };

  const paper = (width: number) =>
    ({
      width,
      top: TOPBAR_HEIGHT,
      height: `calc(100dvh - ${TOPBAR_HEIGHT}px)`,
      boxSizing: "border-box",
      bgcolor: "#F0F4F9",
      border: "none",
      overflowX: "hidden",
      overflowY: "auto",
      px: 1.5,
      py: 1.5,
      display: "flex",
      flexDirection: "column",
      transition: WIDTH_TRANSITION,
    }) as const;

  const content = (isMini: boolean, pillId: string) =>
    sections.map((section, i) => (
      <Box key={section.title}>
        {i > 0 && <Divider sx={{ borderColor: "#DADCE0", mx: 1, my: 1 }} />}
        <Box sx={{ height: isMini ? 0 : 26, overflow: "hidden", transition: `height 280ms ${EASE_OUT_CSS}` }}>
          <Typography
            component="h2"
            sx={{
              px: 2,
              pt: i > 0 ? 0.5 : 0,
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "#5F6368",
              whiteSpace: "nowrap",
              opacity: isMini ? 0 : 1,
              transition: "opacity 150ms",
            }}
          >
            {section.title}
          </Typography>
        </Box>
        <List disablePadding component="nav" aria-label={section.title}>
          {section.items.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(item.href)} mini={isMini} pillId={pillId} />
          ))}
        </List>
      </Box>
    ));

  const width = mini ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH;
  return (
    <>
      <Drawer
        variant="permanent"
        sx={{ display: { xs: "none", md: "block" }, width, flexShrink: 0, transition: WIDTH_TRANSITION, "& .MuiDrawer-paper": paper(width) }}
      >
        {content(mini, "nav-pill")}
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        onClick={(e) => (e.target as HTMLElement).closest("a") && onMobileClose?.()}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": paper(SIDEBAR_WIDTH) }}
      >
        {content(false, "nav-pill-mobile")}
      </Drawer>
    </>
  );
}
