"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { FleetWindow } from "../queries";

const OPTIONS: { value: FleetWindow; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export function WindowToggle({ value }: { value: FleetWindow }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onChange = (_: unknown, next: FleetWindow | null) => {
    if (!next) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("window", next);
    router.push(`${pathname}?${sp.toString()}`);
  };

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      onChange={onChange}
      sx={{
        bgcolor: "#fff",
        borderRadius: "9999px",
        p: "2px",
        "& .MuiToggleButton-root": {
          border: "none",
          borderRadius: "9999px !important",
          px: 1.75,
          py: 0.5,
          fontSize: "0.8125rem",
          fontWeight: 500,
          textTransform: "none",
          color: "#5f6368",
          "&.Mui-selected": {
            bgcolor: "#C2E7FF",
            color: "#0B57D0",
            "&:hover": { bgcolor: "#B4DEFB" },
          },
        },
      }}
    >
      {OPTIONS.map((o) => (
        <ToggleButton key={o.value} value={o.value}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
