import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AutorenewOutlined from "@mui/icons-material/AutorenewOutlined";
import { formatIDR, type BillingCycle, type FinanceSummary } from "../data";

export function BillingCycleBanner({
  cycle,
  summary,
}: {
  cycle: BillingCycle;
  summary: FinanceSummary;
}) {
  const paidShare =
    summary.monthlyTotal === 0 ? 0 : summary.paidTotal / summary.monthlyTotal;

  return (
    <Box
      sx={{
        bgcolor: "#fff",
        border: "1px solid #E8EAED",
        borderRadius: "12px",
        px: 3,
        py: 2.25,
        display: "flex",
        alignItems: "center",
        gap: 3,
        flexWrap: { xs: "wrap", md: "nowrap" },
      }}
    >
      {/* Cycle label */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#E8F0FE",
            color: "#1a73e8",
            "& .MuiSvgIcon-root": { fontSize: 22 },
          }}
        >
          <AutorenewOutlined />
        </Box>
        <Box>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: "#202124", lineHeight: 1.2 }}>
            {cycle.monthLabel}
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "#5f6368" }}>
            Billing cycle · resets monthly
          </Typography>
        </Box>
      </Box>

      {/* Progress through the cycle (paid vs total) */}
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            mb: 0.75,
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
            {formatIDR(summary.paidTotal)} paid
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "#5f6368" }}>
            of {formatIDR(summary.monthlyTotal)}
          </Typography>
        </Box>
        <Box sx={{ height: 8, borderRadius: "9999px", bgcolor: "#E8EAED", overflow: "hidden" }}>
          <Box
            sx={{
              width: `${paidShare * 100}%`,
              height: "100%",
              borderRadius: "9999px",
              bgcolor: "#188038",
            }}
          />
        </Box>
      </Box>

      {/* Reset countdown */}
      <Box sx={{ textAlign: { xs: "left", md: "right" }, flexShrink: 0 }}>
        <Typography sx={{ fontSize: "1.125rem", fontWeight: 600, color: "#202124", lineHeight: 1.2 }}>
          {cycle.daysRemaining} {cycle.daysRemaining === 1 ? "day" : "days"} left
        </Typography>
        <Typography sx={{ fontSize: "0.6875rem", color: "#5f6368" }}>
          Resets {cycle.resetLabel}
        </Typography>
      </Box>
    </Box>
  );
}
