"use client";

import { useState } from "react";
import Image from "next/image";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import InputBase from "@mui/material/InputBase";
import Avatar from "@mui/material/Avatar";
import Popover from "@mui/material/Popover";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import MenuRounded from "@mui/icons-material/MenuRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { logout } from "@/features/auth/actions";
import ManageAccountsRounded from "@mui/icons-material/ManageAccountsRounded";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useAccount } from "@/features/accounts/account";
import { ProfileDialog } from "@/features/accounts/ProfileDialog";
import { MemberAvatar } from "@/features/tasks/components/bits";

export function TopBar({
  userEmail,
  loading = false,
  onMenu,
  menuExpanded,
}: {
  userEmail: string;
  loading?: boolean;
  onMenu?: () => void;
  menuExpanded?: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [profileOpen, setProfileOpen] = useState(false);
  const { me } = useAccount();
  const initial = userEmail.charAt(0).toUpperCase() || "O";
  const username = userEmail.split("@")[0] || "there";
  const displayName = me?.name ?? username.charAt(0).toUpperCase() + username.slice(1);

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        bgcolor: "#F0F4F9",
        backgroundImage: "none",
        borderBottom: "none",
        boxShadow: "none",
        backdropFilter: "none",
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          minHeight: "64px !important",
          height: 64,
          px: 1,
          gap: 0,
        }}
      >
        {/* Hamburger */}
        <IconButton
          aria-label={menuExpanded ? "Ciutkan menu" : "Buka menu"}
          aria-expanded={menuExpanded}
          onClick={onMenu}
          sx={{
            width: 48,
            height: 48,
            color: "#444746",
            "&:hover": { bgcolor: "rgba(68,71,70,0.08)" },
          }}
        >
          <MenuRounded sx={{ fontSize: 24 }} />
        </IconButton>

        {/* Logo + brand */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            ml: 0.5,
            flexShrink: 0,
          }}
        >
          <Image src="/logo.svg" alt="OpenCraft" width={38} height={32} priority />
          <Typography
            sx={{
              fontSize: "1.125rem",
              fontWeight: 400,
              color: "#5E5E5E",
              whiteSpace: "nowrap",
              display: { xs: "none", sm: "block" },
              letterSpacing: 0,
            }}
          >
            OpenCraft
          </Typography>
        </Box>

        {/* Centered search pill */}
        <Box
          sx={{
            mx: "auto",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flex: 1,
            minWidth: 0,
            maxWidth: 720,
            height: 48,
            bgcolor: "#E2ECFC",
            borderRadius: "24px",
            pl: 2,
            pr: 1,
          }}
        >
          <SearchRounded sx={{ fontSize: 20, color: "#474747", flexShrink: 0 }} />
          <InputBase
            placeholder='Search content in "opencraft.id"'
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: "1rem",
              color: "#474747",
              "& ::placeholder": { color: "#474747", opacity: 0.6 },
            }}
          />
        </Box>

        {/* Notifications */}
        <Box sx={{ ml: 1 }}>
          <NotificationBell />
        </Box>

        {/* Account avatar: the profile photo / initials when this login has a profile */}
        {me ? (
          <Box
            component="button"
            type="button"
            aria-label={`Akun ${me.name}`}
            onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
            sx={{ ml: 1, mr: 1, p: 0, border: "none", bgcolor: "transparent", borderRadius: "50%", cursor: "pointer", display: "inline-flex", transition: "box-shadow 200ms", "&:hover": { boxShadow: "0 0 0 3px rgba(26,115,232,0.2)" } }}
          >
            <MemberAvatar member={me} size={32} />
          </Box>
        ) : (
        <Avatar
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            ml: 1,
            mr: 1,
            width: 32,
            height: 32,
            bgcolor: "#455A64",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#fff",
            cursor: "pointer",
            "&:hover": { boxShadow: "0 0 0 3px rgba(26,115,232,0.2)" },
            transition: "box-shadow 200ms",
          }}
        >
          {initial}
        </Avatar>
        )}

        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: {
              sx: {
                mt: 1.5,
                width: 360,
                borderRadius: "24px",
                bgcolor: "#fff",
                boxShadow: "0 10px 36px rgba(60,64,67,.22), 0 2px 6px rgba(60,64,67,.1)",
                overflow: "hidden",
              },
            },
          }}
        >
          <Box sx={{ position: "relative", pt: 3.5, pb: 3, px: 2.5 }}>
            <IconButton
              size="small"
              aria-label="Tutup"
              onClick={() => setAnchorEl(null)}
              sx={{ position: "absolute", top: 12, right: 12, color: "#5E5E5E", "&:hover": { bgcolor: "rgba(68,71,70,0.08)" } }}
            >
              <CloseRounded sx={{ fontSize: 20 }} />
            </IconButton>

            {/* Large avatar */}
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              {me ? (
                <MemberAvatar member={me} size={80} />
              ) : (
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: "#455A64",
                  fontSize: "2rem",
                  fontWeight: 500,
                  color: "#fff",
                }}
              >
                {initial}
              </Avatar>
              )}
            </Box>

            {/* Greeting */}
            <Typography
              sx={{
                mt: 2,
                textAlign: "center",
                fontSize: "1.375rem",
                fontWeight: 500,
                color: "#1F1F1F",
              }}
            >
              Hi, {displayName}!
            </Typography>
            {me?.role && (
              <Typography sx={{ mt: 0.5, textAlign: "center", fontSize: "0.875rem", fontWeight: 600, color: "#444746" }}>{me.role}</Typography>
            )}
            <Typography sx={{ mt: 0.5, textAlign: "center", fontSize: "0.75rem", fontWeight: 400, color: "#5F6368" }}>{userEmail}</Typography>

            {/* Edit profile + sign out — pills */}
            <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1, mt: 3 }}>
              <Box
                component="button"
                type="button"
                onClick={() => {
                  setAnchorEl(null);
                  setProfileOpen(true);
                }}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  height: 40,
                  px: 3,
                  borderRadius: "20px",
                  border: "1px solid #DADCE0",
                  bgcolor: "#fff",
                  color: "#0B57D0",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  "&:hover": { bgcolor: "#F6FAFE" },
                }}
              >
                <ManageAccountsRounded sx={{ fontSize: 18 }} />
                {me ? "Edit profil" : "Buat profil"}
              </Box>
              <Box
                component="form"
                action={logout}
                sx={{ display: "inline-flex" }}
              >
                <Box
                  component="button"
                  type="submit"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 1,
                    height: 40,
                    px: 3,
                    borderRadius: "20px",
                    border: "1px solid #DADCE0",
                    bgcolor: "#fff",
                    color: "#0B57D0",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background-color 150ms",
                    "&:hover": { bgcolor: "#F6FAFE" },
                  }}
                >
                  <LogoutRounded sx={{ fontSize: 18 }} />
                  Sign out
                </Box>
              </Box>
            </Box>
          </Box>

        </Popover>
      </Toolbar>

      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Global loading bar — pinned to the bottom edge of the navbar */}
      {loading && (
        <LinearProgress
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            bgcolor: "transparent",
            "& .MuiLinearProgress-bar": { bgcolor: "#0B57D0" },
          }}
        />
      )}
    </AppBar>
  );
}
