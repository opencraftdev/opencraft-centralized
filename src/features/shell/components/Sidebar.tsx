"use client";

import { useEffect, useRef, useState } from "react";
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
import { EASE_OUT_CSS, SPRING } from "@/components/ui/motion";
import { NavLinkLoading } from "./loading-context";
import { ChatIcon, DocsIcon, FinanceIcon, ScrapersIcon, SkillsIcon, TasksIcon } from "./NavIcons";

export const SIDEBAR_WIDTH = 280; // upper bound; the open sidebar hugs its widest row (see useHugWidth)
export const SIDEBAR_MINI_WIDTH = 72;
const TOPBAR_HEIGHT = 64;
const WIDTH_TRANSITION = `width 280ms ${EASE_OUT_CSS}`;
const SPRING_CSS = "cubic-bezier(0.34, 1.56, 0.64, 1)";
// Icon colours: soft blue at rest, logo blue on hover / when active.
const IDLE = { "--a": "#5A86C2", "--b": "#CFE0F7" } as const;
const LIVE = { "--a": "#0457AB", "--b": "#8CC0F5" } as const;

type NavItem = { href: string; label: string; icon: React.ReactNode };

// Sidebar sections, in order. Each section has a small header and a divider between sections.
const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Tools",
    items: [
      { href: "/chat", label: "Chat AI", icon: <ChatIcon /> },
      { href: "/skills", label: "Skills AI", icon: <SkillsIcon /> },
    ],
  },
  {
    title: "Operational",
    items: [
      { href: "/tasks", label: "Task Management", icon: <TasksIcon /> },
      { href: "/documents", label: "Document", icon: <DocsIcon /> },
      { href: "/finance", label: "Finance", icon: <FinanceIcon /> },
      { href: "/scrapers", label: "Scrapers", icon: <ScrapersIcon /> },
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
        ...(active ? LIVE : IDLE),
        "& .ic-a": { fill: "var(--a)", transition: "fill 250ms" },
        "& .ic-b": { fill: "var(--b)", transition: "fill 250ms" },
        "& .nav-ic": { display: "block", transition: `transform 380ms ${SPRING_CSS}` },
        "&:hover": LIVE,
        "&:hover .nav-ic": { transform: "translateY(-1px) rotate(-8deg)" },
        "&:hover .nav-wave": { transform: "none" },
      }}
    >
      {/* Hover: a soft blue gradient flows in from the left */}
      <Box
        className="nav-wave"
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background: "linear-gradient(90deg, rgba(38,140,239,.20), rgba(42,176,207,.10) 55%, rgba(38,140,239,0) 90%)",
          transform: "translateX(-101%)",
          transition: `transform 420ms ${EASE_OUT_CSS}`,
        }}
      />
      {/* Active pill: one shared element that glides between rows */}
      {active && (
        <motion.span
          layoutId={pillId}
          transition={SPRING}
          style={{ position: "absolute", inset: 0, borderRadius: 9999, background: "linear-gradient(90deg, #C2E7FF, #D9ECFF 70%, #E6F1FF)" }}
        />
      )}
      <ListItemIcon sx={{ position: "relative", minWidth: 0, mr: 2, color: "inherit" }}>{item.icon}</ListItemIcon>
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
  onWidth,
}: {
  userEmail?: string;
  mini?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onWidth?: (w: number) => void; // the open width (hugging its content), for the page offset
}) {
  // Hug: an invisible copy of the menu at its natural width tells how wide the open sidebar must be,
  // so a longer label later simply makes it a bit wider.
  const measure = useRef<HTMLDivElement>(null);
  const [hugW, setHugW] = useState(232);
  useEffect(() => {
    const el = measure.current;
    if (!el) return;
    const update = () => {
      const w = Math.min(SIDEBAR_WIDTH, Math.ceil(el.getBoundingClientRect().width) + 24 + 8); // + paper padding + air
      setHugW(w);
      onWidth?.(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const width = mini ? SIDEBAR_MINI_WIDTH : hugW;
  return (
    <>
      <Box ref={measure} aria-hidden inert sx={{ position: "fixed", left: -9999, top: 0, width: "max-content", visibility: "hidden", pointerEvents: "none" }}>
        {content(false, "nav-pill-measure")}
      </Box>
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
        sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": paper(hugW) }}
      >
        {content(false, "nav-pill-mobile")}
      </Drawer>
    </>
  );
}
