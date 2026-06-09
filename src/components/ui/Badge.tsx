import Chip from "@mui/material/Chip";
import type { SxProps, Theme } from "@mui/material/styles";

type BadgeVariant = "draft" | "accepted" | "scheduled" | "publishing" | "published" | "failed" | "posted";
type TypeVariant = "engage" | "educate" | "video";

const STATUS_LABELS: Record<BadgeVariant, string> = {
  draft:      "Draft",
  accepted:   "Accepted",
  scheduled:  "Scheduled",
  publishing: "Publishing",
  published:  "Published",
  failed:     "Failed",
  posted:     "Posted",
};

const STATUS_COLORS: Record<BadgeVariant, { bgcolor: string; color: string }> = {
  draft:      { bgcolor: "rgba(95,99,104,0.08)",  color: "#5f6368" },
  accepted:   { bgcolor: "rgba(227,116,0,0.08)",  color: "#e37400" },
  scheduled:  { bgcolor: "rgba(26,115,232,0.08)", color: "#1a73e8" },
  publishing: { bgcolor: "rgba(0,131,143,0.08)",  color: "#00838f" },
  published:  { bgcolor: "rgba(24,128,56,0.08)",  color: "#188038" },
  failed:     { bgcolor: "rgba(217,48,37,0.08)",  color: "#d93025" },
  posted:     { bgcolor: "rgba(24,128,56,0.08)",  color: "#188038" },
};

const TYPE_LABELS: Record<TypeVariant, string> = {
  engage:  "Engage",
  educate: "Educate",
  video:   "Video",
};

const TYPE_COLORS: Record<TypeVariant, { bgcolor: string; color: string }> = {
  engage:  { bgcolor: "rgba(66,133,244,0.08)",  color: "#4285f4" },
  educate: { bgcolor: "rgba(52,168,83,0.08)",   color: "#34a853" },
  video:   { bgcolor: "rgba(95,99,104,0.08)",   color: "#5f6368" },
};

// Neutral grey for any value not in the maps above. Live data (e.g. the shared
// `articles` table) can carry status/type values outside the TS unions, and an
// unmapped lookup must never crash the page — fall back instead of throwing.
const FALLBACK_COLORS = { bgcolor: "rgba(95,99,104,0.08)", color: "#5f6368" };

function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface StatusBadgeProps {
  status: string;
  sx?: SxProps<Theme>;
  className?: string;
}

export function StatusBadge({ status, sx, className }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status as BadgeVariant] ?? FALLBACK_COLORS;
  const label = STATUS_LABELS[status as BadgeVariant] ?? humanize(status);
  return (
    <Chip
      label={label}
      size="small"
      className={className}
      sx={{
        bgcolor: colors.bgcolor,
        color: colors.color,
        fontWeight: 600,
        ...sx as Record<string, unknown>,
      }}
    />
  );
}

interface TypeBadgeProps {
  type: string;
  sx?: SxProps<Theme>;
  className?: string;
}

export function TypeBadge({ type, sx, className }: TypeBadgeProps) {
  const colors = TYPE_COLORS[type as TypeVariant] ?? FALLBACK_COLORS;
  const label = TYPE_LABELS[type as TypeVariant] ?? humanize(type);
  return (
    <Chip
      label={label}
      size="small"
      className={className}
      sx={{
        bgcolor: colors.bgcolor,
        color: colors.color,
        fontWeight: 600,
        ...sx as Record<string, unknown>,
      }}
    />
  );
}
