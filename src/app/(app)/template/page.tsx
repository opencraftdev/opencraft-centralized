import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { WeekTemplateEditor } from "@/components/template/WeekTemplateEditor";

const LEGEND = [
  { color: "#4285f4", label: "Engage", desc: "Simple question, text-only, Threads + X" },
  { color: "#34a853", label: "Educate", desc: "Coding tip with optional code card, Threads + X" },
  { color: "#5f6368", label: "Video", desc: "AI news video, all platforms (manual flow)" },
];

export default function TemplatePage() {
  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9" }}>
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
        <Box sx={{ maxWidth: 936, mx: "auto", px: 3, width: "100%" }}>
          <Typography
            component="h1"
            sx={{
              fontSize: "1.375rem",
              fontWeight: 400,
              lineHeight: "1.75rem",
              color: "#1F1F1F",
            }}
          >
            Weekly Template
          </Typography>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 936, mx: "auto", px: 3, pt: "76px", pb: 4 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
          Configure which content type runs on each day of the week. The auto-generate button uses
          this template to create draft posts for all remaining days.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 280px" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <Card variant="outlined" sx={{ borderRadius: "12px", border: "none", bgcolor: "#fff" }}>
            <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
              <WeekTemplateEditor />
            </CardContent>
          </Card>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography
              variant="caption"
              sx={{
                px: 1,
                fontWeight: 500,
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Content types
            </Typography>
            {LEGEND.map((item) => (
              <Card
                key={item.label}
                variant="outlined"
                sx={{
                  borderRadius: "12px",
                  border: "none",
                  bgcolor: "#fff",
                  borderLeft: `3px solid ${item.color}`,
                }}
              >
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: item.color }}>
                    {item.label}
                  </Typography>
                  <Typography variant="caption" sx={{ lineHeight: 1.5, display: "block", mt: 0.25 }}>
                    {item.desc}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
