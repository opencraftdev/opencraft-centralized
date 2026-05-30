import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { DashboardStats } from "../queries";

const CARDS = [
  { key: "total" as const, label: "Total Posts", color: "#0B57D0" },
  { key: "published" as const, label: "Published", color: "#188038" },
  { key: "scheduled" as const, label: "Scheduled", color: "#1A73E8" },
  { key: "failed" as const, label: "Failed", color: "#D93025" },
];

export function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
      {CARDS.map((card) => (
        <Box
          key={card.key}
          sx={{
            borderRadius: "8px",
            px: 2.5,
            py: 2,
            minHeight: 100,
            bgcolor: "transparent",
            border: "1px solid rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, fontSize: "0.8125rem", color: "rgba(0,0,0,0.54)" }}
          >
            {card.label}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
            <Typography
              sx={{
                fontSize: "2rem",
                fontWeight: 400,
                lineHeight: 1,
                color: card.color,
              }}
            >
              {stats[card.key]}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
