"use client";

import { useState } from "react";
import Image from "next/image";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Avatar from "@mui/material/Avatar";
import Popover from "@mui/material/Popover";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import MenuOutlined from "@mui/icons-material/MenuOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import { logout } from "@/features/auth/actions";

export function TopBar({ userEmail }: { userEmail: string }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const initial = userEmail.charAt(0).toUpperCase() || "O";
  const username = userEmail.split("@")[0] || "there";
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);

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
          aria-label="Main menu"
          sx={{
            width: 48,
            height: 48,
            color: "#444746",
            "&:hover": { bgcolor: "rgba(68,71,70,0.08)" },
          }}
        >
          <MenuOutlined sx={{ fontSize: 24 }} />
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
          <Image src="/logo.png" alt="OpenCraft" width={32} height={32} />
          <Typography
            sx={{
              fontSize: "1.125rem",
              fontWeight: 400,
              color: "#5E5E5E",
              whiteSpace: "nowrap",
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
            maxWidth: 720,
            height: 48,
            bgcolor: "#E2ECFC",
            borderRadius: "24px",
            pl: 2,
            pr: 1,
          }}
        >
          <SearchOutlined sx={{ fontSize: 20, color: "#474747", flexShrink: 0 }} />
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

        {/* Account avatar */}
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
                borderRadius: "28px",
                bgcolor: "#F0F4F9",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                overflow: "hidden",
              },
            },
          }}
        >
          <Box sx={{ position: "relative", pt: 2.5, pb: 3, px: 2.5 }}>
            {/* Top row: email + close */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "0.875rem", color: "#1F1F1F", fontWeight: 400 }}>
                {userEmail}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setAnchorEl(null)}
                sx={{ color: "#5E5E5E", "&:hover": { bgcolor: "rgba(68,71,70,0.08)" } }}
              >
                <CloseOutlined sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>

            {/* Large avatar */}
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
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
            </Box>

            {/* Greeting */}
            <Typography
              sx={{
                mt: 2,
                textAlign: "center",
                fontSize: "1.375rem",
                fontWeight: 400,
                color: "#1F1F1F",
              }}
            >
              Hi, {displayName}!
            </Typography>

            {/* Sign out button — pill */}
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
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
                  <LogoutOutlined sx={{ fontSize: 18 }} />
                  Sign out
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Footer */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 1.5,
              py: 1.5,
              borderTop: "1px solid #E8EAED",
              bgcolor: "#F0F4F9",
            }}
          >
            <Typography
              component="a"
              href="#"
              sx={{
                fontSize: "0.75rem",
                color: "#5E5E5E",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Privacy Policy
            </Typography>
            <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "#5E5E5E" }} />
            <Typography
              component="a"
              href="#"
              sx={{
                fontSize: "0.75rem",
                color: "#5E5E5E",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              Terms of Service
            </Typography>
          </Box>
        </Popover>
      </Toolbar>
    </AppBar>
  );
}
