"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import type { TypeCount } from "../queries";

const TYPE_COLORS: Record<string, string> = {
  engage: "#4285f4",
  educate: "#34a853",
  video: "#5f6368",
};

export function ContentTypeChart({ data }: { data: TypeCount[] }) {
  if (data.every((d) => d.count === 0)) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <Typography variant="body2" color="text.secondary">No posts yet</Typography>
      </Box>
    );
  }

  const labels = data.map((d) => d.type.charAt(0).toUpperCase() + d.type.slice(1));
  const colors = data.map((d) => TYPE_COLORS[d.type] ?? "#9aa0a6");
  const values = data.map((d) => d.count);

  return (
    <Box sx={{ height: 220 }}>
      <BarChart
        xAxis={[
          {
            data: labels,
            scaleType: "band",
            disableLine: true,
            disableTicks: true,
            tickLabelStyle: { fontSize: 13, fill: "#5f6368", fontWeight: 500 },
            colorMap: { type: "ordinal", values: labels, colors },
          },
        ]}
        yAxis={[{ disableLine: true, disableTicks: true, tickLabelStyle: { fontSize: 11, fill: "#5f6368" } }]}
        series={[
          {
            data: values,
            type: "bar",
          },
        ]}
        height={220}
        margin={{ top: 8, right: 8, bottom: 24, left: 32 }}
        hideLegend
        borderRadius={8}
        sx={{
          "& .MuiChartsAxis-line": { display: "none" },
          "& .MuiChartsGrid-line": { stroke: "#e8eaed" },
        }}
      />
    </Box>
  );
}
