import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const MAX_W = 1200;
const SIDEBAR = 280;
const TOPBAR = 64;
const HEADER_H = 68;

// Shared chrome for the Blogs section routes (History / Performance / SEO Audit):
// the gray fixed header + centered max-width body, matching the dashboard /
// posts / calendar design system. Each route supplies its own title + body.
export function BlogsShell({
  title,
  subtitle,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
      <Box
        sx={{
          position: "fixed",
          top: TOPBAR,
          left: SIDEBAR,
          right: 0,
          zIndex: 10,
          height: HEADER_H,
          bgcolor: "#F0F4F9",
          borderBottom: "1px solid #E8EAED",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, width: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography
              component="h1"
              sx={{ fontSize: "1.375rem", fontWeight: 400, lineHeight: "1.75rem", color: "#1F1F1F" }}
            >
              {title}
            </Typography>
            {status}
          </Box>
          <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>{subtitle}</Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3, pt: `${HEADER_H + 16}px`, pb: 5 }}>
        {children}
      </Box>
    </Box>
  );
}
