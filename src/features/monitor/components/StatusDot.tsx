import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { AgentStatus } from "@/lib/monitor/types";

const STATUS_META: Record<AgentStatus, { color: string; label: string }> = {
  online: { color: "#188038", label: "Active" },
  degraded: { color: "#F9AB00", label: "Degraded" },
  offline: { color: "#D93025", label: "Inactive" },
  unknown: { color: "#9AA0A6", label: "Unknown" },
};

export function StatusDot({
  status,
  showLabel = false,
  size = 10,
}: {
  status: AgentStatus;
  showLabel?: boolean;
  size?: number;
}) {
  const meta = STATUS_META[status];
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          bgcolor: meta.color,
          boxShadow: status === "online" ? `0 0 0 3px ${meta.color}22` : "none",
          flexShrink: 0,
        }}
      />
      {showLabel && (
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: meta.color }}>
          {meta.label}
        </Typography>
      )}
    </Box>
  );
}
