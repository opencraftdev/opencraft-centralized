"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { PieChart } from "@mui/x-charts/PieChart";

const COLORS = {
  published: "#188038",
  failed: "#d93025",
  empty: "#e8eaed",
};

export function PublishChart({ published, failed }: { published: number; failed: number }) {
  const total = published + failed;
  const rate = total > 0 ? Math.round((published / total) * 100) : 0;

  const series =
    total === 0
      ? [
          {
            innerRadius: 55,
            outerRadius: 78,
            paddingAngle: 0,
            cornerRadius: 0,
            startAngle: 0,
            endAngle: 360,
            data: [{ id: 0, value: 1, color: COLORS.empty, label: "Empty" }],
          },
        ]
      : [
          {
            innerRadius: 55,
            outerRadius: 78,
            paddingAngle: 0,
            cornerRadius: 0,
            startAngle: 0,
            endAngle: 360,
            data: [
              { id: 0, value: published, color: COLORS.published, label: "Published" },
              { id: 1, value: failed, color: COLORS.failed, label: "Failed" },
            ],
          },
        ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Box sx={{ position: "relative", width: "100%", height: 180, display: "flex", justifyContent: "center" }}>
        <PieChart
          series={series}
          height={180}
          width={220}
          hideLegend
          margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
          sx={{ "& .MuiChartsSurface-root": { overflow: "visible" } }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1 }}>
            {total === 0 ? "0" : `${rate}`}%
          </Typography>
          <Typography variant="caption" sx={{ mt: 0.5 }}>
            Success
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center", gap: 3, mt: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: COLORS.published }} />
          <Typography variant="caption">Published</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: COLORS.failed }} />
          <Typography variant="caption">Failed</Typography>
        </Box>
      </Box>
    </Box>
  );
}
