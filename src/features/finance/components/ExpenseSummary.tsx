import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import PendingActionsOutlined from "@mui/icons-material/PendingActionsOutlined";
import { CATEGORY_META, formatIDR, type FinanceSummary } from "../data";

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <Box
      sx={{
        flex: "1 1 0",
        minWidth: 0,
        bgcolor: "#fff",
        border: "1px solid #E8EAED",
        borderRadius: "12px",
        px: 2.5,
        py: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: `${accent}14`,
            color: accent,
            "& .MuiSvgIcon-root": { fontSize: 20 },
          }}
        >
          {icon}
        </Box>
        <Typography sx={{ fontSize: "0.75rem", fontWeight: 500, color: "#5f6368" }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 500, color: "#202124", lineHeight: 1.1 }}>
        {value}
      </Typography>
      {hint && (
        <Typography sx={{ fontSize: "0.6875rem", color: "#80868b" }}>{hint}</Typography>
      )}
    </Box>
  );
}

export function ExpenseSummary({ summary }: { summary: FinanceSummary }) {
  const { monthlyTotal, itemCount, paidTotal, pendingTotal, byCategory } = summary;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* KPI cards */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <StatCard
          icon={<PaymentsOutlined />}
          label="Monthly expense"
          value={formatIDR(monthlyTotal)}
          hint="Total recurring burn this month"
          accent="#1a73e8"
        />
        <StatCard
          icon={<ReceiptLongOutlined />}
          label="Line items"
          value={String(itemCount)}
          hint="Active expense entries"
          accent="#9334E6"
        />
        <StatCard
          icon={<CheckCircleOutlined />}
          label="Paid"
          value={formatIDR(paidTotal)}
          hint="Already settled this cycle"
          accent="#188038"
        />
        <StatCard
          icon={<PendingActionsOutlined />}
          label="Pending"
          value={formatIDR(pendingTotal)}
          hint="Awaiting payment"
          accent="#E37400"
        />
      </Box>

      {/* Category breakdown */}
      <Box
        sx={{
          bgcolor: "#fff",
          border: "1px solid #E8EAED",
          borderRadius: "12px",
          px: 3,
          py: 2.5,
        }}
      >
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#202124", mb: 1.75 }}>
          Spending by category
        </Typography>

        {/* Stacked proportion bar */}
        <Box
          sx={{
            display: "flex",
            height: 10,
            borderRadius: "9999px",
            overflow: "hidden",
            mb: 2,
          }}
        >
          {byCategory.map((c) => (
            <Box
              key={c.category}
              sx={{
                width: `${c.share * 100}%`,
                bgcolor: CATEGORY_META[c.category].color,
              }}
            />
          ))}
        </Box>

        {/* Legend */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1.5, sm: 3 } }}>
          {byCategory.map((c) => (
            <Box key={c.category} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "3px",
                  bgcolor: CATEGORY_META[c.category].color,
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ fontSize: "0.8125rem", color: "#202124" }}>
                {CATEGORY_META[c.category].label}
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368" }}>
                {formatIDR(c.total)}
              </Typography>
              <Typography sx={{ fontSize: "0.6875rem", color: "#80868b" }}>
                {Math.round(c.share * 100)}%
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
