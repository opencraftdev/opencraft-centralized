"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftOutlined from "@mui/icons-material/ChevronLeftOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import { Button } from "@/components/ui/Button";

interface MonthNavProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onAutoGenerate: () => void;
  isGenerating?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthNav({ year, month, onPrev, onNext, onAutoGenerate, isGenerating }: MonthNavProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton onClick={onPrev} size="small" aria-label="Previous month">
          <ChevronLeftOutlined />
        </IconButton>

        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minWidth: 190 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {MONTH_NAMES[month - 1]}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {year}
          </Typography>
        </Box>

        <IconButton onClick={onNext} size="small" aria-label="Next month">
          <ChevronRightOutlined />
        </IconButton>
      </Box>

      <Button variant="outline" size="sm" onClick={onAutoGenerate} loading={isGenerating}>
        Auto-generate month
      </Button>
    </Box>
  );
}
