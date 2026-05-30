"use client";

import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    status: {
      draft: string;
      accepted: string;
      scheduled: string;
      published: string;
      failed: string;
    };
    contentType: {
      engage: string;
      educate: string;
      video: string;
    };
  }
  interface PaletteOptions {
    status?: {
      draft: string;
      accepted: string;
      scheduled: string;
      published: string;
      failed: string;
    };
    contentType?: {
      engage: string;
      educate: string;
      video: string;
    };
  }
}

const theme = createTheme({
  palette: {
    primary: {
      main: "#1a73e8",
      dark: "#1765cc",
      light: "#4285f4",
    },
    secondary: {
      main: "#5f6368",
    },
    error: {
      main: "#d93025",
    },
    warning: {
      main: "#e37400",
    },
    success: {
      main: "#188038",
    },
    info: {
      main: "#1a73e8",
    },
    background: {
      default: "#f0f4f9",
      paper: "#ffffff",
    },
    text: {
      primary: "#202124",
      secondary: "#5f6368",
      disabled: "#9aa0a6",
    },
    divider: "#dadce0",
    status: {
      draft: "#5f6368",
      accepted: "#e37400",
      scheduled: "#1a73e8",
      published: "#188038",
      failed: "#d93025",
    },
    contentType: {
      engage: "#4285f4",
      educate: "#34a853",
      video: "#5f6368",
    },
  },
  typography: {
    fontFamily: "var(--font-roboto), Roboto, Helvetica, Arial, sans-serif",
    fontSize: 14,
    h4: { fontWeight: 600, letterSpacing: "-0.02em" },
    h5: { fontWeight: 600, letterSpacing: "-0.01em" },
    h6: { fontWeight: 600, fontSize: "1rem" },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 500, fontSize: "0.8125rem" },
    body2: { fontSize: "0.8125rem" },
    caption: { fontSize: "0.6875rem", color: "#5f6368" },
    overline: {
      fontSize: "0.6875rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 4,
        },
        sizeSmall: { fontSize: "0.8125rem", padding: "4px 12px" },
        sizeMedium: { fontSize: "0.875rem", padding: "6px 16px" },
        sizeLarge: { fontSize: "0.9375rem", padding: "8px 24px" },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #dadce0",
          boxShadow: "none",
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        sizeSmall: {
          fontSize: "0.6875rem",
          fontWeight: 600,
          height: 22,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: "0.6875rem",
          fontWeight: 500,
          color: "#5f6368",
          backgroundColor: "#f0f4f9",
          borderBottom: "1px solid #dadce0",
        },
        body: {
          fontSize: "0.8125rem",
          borderBottom: "1px solid #e8eaed",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
        variant: "outlined",
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: "none",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          minHeight: 40,
          paddingLeft: 16,
          paddingRight: 16,
          color: "#444746",
          "&:hover": {
            backgroundColor: "rgba(68,71,70,0.08)",
          },
          "&.Mui-selected": {
            backgroundColor: "#C2E7FF",
            color: "#2962FF",
            "& .MuiListItemIcon-root": { color: "#2962FF" },
            "&:hover": {
              backgroundColor: "#B4DEFB",
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#F0F4F9",
          backgroundImage: "none",
          borderBottom: "none",
          boxShadow: "none",
        },
      },
      defaultProps: {
        elevation: 0,
        color: "inherit",
      },
    },
  },
});

export default theme;
