"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import FolderRounded from "@mui/icons-material/FolderRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import SlideshowRounded from "@mui/icons-material/SlideshowRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import TableChartRounded from "@mui/icons-material/TableChartRounded";
import InsertDriveFileRounded from "@mui/icons-material/InsertDriveFileRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import type { DriveFile, DriveFolder } from "@/lib/drive/types";
import { formatBytes, formatModified } from "../format";

export type DriveItem = { kind: "folder"; data: DriveFolder } | { kind: "file"; data: DriveFile };

export type MenuTarget = { item: DriveItem; anchor?: HTMLElement; position?: { top: number; left: number } };

export interface ItemHandlers {
  selectedId: string | null;
  onSelect: (item: DriveItem) => void;
  onOpen: (item: DriveItem) => void;
  onMenu: (target: MenuTarget) => void;
  locationOf?: (item: DriveItem) => string;
}

export function fileIcon(file: DriveFile): { Icon: typeof PictureAsPdfRounded; color: string } {
  const mime = file.mime_type ?? "";
  const name = file.name.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return { Icon: PictureAsPdfRounded, color: "#EA4335" };
  if (mime.includes("presentation") || name.endsWith(".pptx") || file.doc_type === "deck")
    return { Icon: SlideshowRounded, color: "#FBBC04" };
  if (mime.startsWith("image/")) return { Icon: ImageRounded, color: "#EA4335" };
  if (mime.includes("sheet") || mime.includes("csv")) return { Icon: TableChartRounded, color: "#34A853" };
  if (mime.includes("word") || mime.startsWith("text/")) return { Icon: DescriptionRounded, color: "#4285F4" };
  if (file.source === "generated" && file.status !== "ready") return { Icon: AutoAwesomeRounded, color: "#8E5CF5" };
  if (file.doc_type === "sph" || file.doc_type === "mou") return { Icon: PictureAsPdfRounded, color: "#EA4335" };
  return { Icon: InsertDriveFileRounded, color: "#5F6368" };
}

export const isBusy = (f: DriveFile) => f.status === "queued" || f.status === "generating";

// Status badge for generated files; null for ordinary ready files.
export function StatusBadge({ file, compact = false }: { file: DriveFile; compact?: boolean }) {
  if (isBusy(file)) {
    return (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: "#0B57D0", flexShrink: 0 }}>
        <CircularProgress size={12} thickness={5} sx={{ color: "#0B57D0" }} />
        {!compact && <Typography sx={{ fontSize: "0.75rem", fontWeight: 500 }}>Sedang dibuat…</Typography>}
      </Box>
    );
  }
  const meta =
    file.status === "needs_input"
      ? { label: "Perlu jawaban", bg: "#FEEFC3", fg: "#7A4F01" }
      : file.status === "failed"
        ? { label: "Gagal", bg: "#FCE8E6", fg: "#B3261E" }
        : null;
  if (!meta) return null;
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        px: 1,
        height: 20,
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "9999px",
        bgcolor: meta.bg,
        color: meta.fg,
        fontSize: "0.6875rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </Box>
  );
}

const nameSx = {
  fontSize: "0.875rem",
  color: "#1F1F1F",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
} as const;
const metaSx = { fontSize: "0.8125rem", color: "#444746", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as const;

function itemEvents(item: DriveItem, h: ItemHandlers) {
  return {
    onClick: () => h.onSelect(item),
    onDoubleClick: () => h.onOpen(item),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      h.onSelect(item);
      h.onMenu({ item, position: { top: e.clientY, left: e.clientX } });
    },
  };
}

function MoreButton({ item, h, light = false }: { item: DriveItem; h: ItemHandlers; light?: boolean }) {
  return (
    <IconButton
      size="small"
      aria-label="Tindakan lainnya"
      onClick={(e) => {
        e.stopPropagation();
        h.onSelect(item);
        h.onMenu({ item, anchor: e.currentTarget });
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      sx={{ color: light ? "#444746" : "#5F6368", flexShrink: 0 }}
    >
      <MoreVertRounded sx={{ fontSize: 20 }} />
    </IconButton>
  );
}

const Star = () => <StarRounded sx={{ fontSize: 16, color: "#5F6368", flexShrink: 0 }} />;

// ── Grid ────────────────────────────────────────────────────

export function FolderGrid({ folders, h }: { folders: DriveFolder[]; h: ItemHandlers }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
      {folders.map((f) => {
        const item: DriveItem = { kind: "folder", data: f };
        const selected = h.selectedId === f.id;
        return (
          <Box
            key={f.id}
            {...itemEvents(item, h)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              pl: 2,
              pr: 0.5,
              height: 48,
              borderRadius: "12px",
              bgcolor: selected ? "#C2E7FF" : "#F0F4F9",
              cursor: "pointer",
              userSelect: "none",
              "&:hover": { bgcolor: selected ? "#B4DEFB" : "#E1E5EA" },
            }}
          >
            <FolderRounded sx={{ fontSize: 22, color: "#444746", flexShrink: 0 }} />
            <Typography sx={{ ...nameSx, flex: 1, fontWeight: 500 }}>{f.name}</Typography>
            {f.starred && <Star />}
            <MoreButton item={item} h={h} light />
          </Box>
        );
      })}
    </Box>
  );
}

export function FileGrid({ files, h }: { files: DriveFile[]; h: ItemHandlers }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
      {files.map((f) => {
        const item: DriveItem = { kind: "file", data: f };
        const { Icon, color } = fileIcon(f);
        const selected = h.selectedId === f.id;
        return (
          <Box
            key={f.id}
            {...itemEvents(item, h)}
            sx={{
              borderRadius: "12px",
              bgcolor: selected ? "#C2E7FF" : "#F0F4F9",
              cursor: "pointer",
              userSelect: "none",
              px: 1,
              pb: 1,
              "&:hover": { bgcolor: selected ? "#B4DEFB" : "#E1E5EA" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 0.75, height: 48 }}>
              <Icon sx={{ fontSize: 20, color, flexShrink: 0 }} />
              <Typography sx={{ ...nameSx, flex: 1, fontWeight: 500 }} title={f.name}>
                {f.name}
              </Typography>
              {f.starred && <Star />}
              <MoreButton item={item} h={h} light />
            </Box>
            <Box
              sx={{
                height: 150,
                borderRadius: "8px",
                bgcolor: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.25,
                px: 2,
                textAlign: "center",
              }}
            >
              {isBusy(f) ? (
                <>
                  <CircularProgress size={28} thickness={4} sx={{ color: "#0B57D0" }} />
                  <Typography sx={{ fontSize: "0.8125rem", color: "#0B57D0", fontWeight: 500 }}>Sedang dibuat…</Typography>
                </>
              ) : (
                <>
                  <Icon sx={{ fontSize: 56, color }} />
                  <StatusBadge file={f} />
                </>
              )}
            </Box>
            <Typography sx={{ fontSize: "0.75rem", color: "#444746", px: 0.75, pt: 1 }} suppressHydrationWarning>
              {h.locationOf ? `${h.locationOf(item)} · ` : ""}
              {formatModified(f.updated_at)}
              {f.size_bytes != null ? ` · ${formatBytes(f.size_bytes)}` : ""}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ── List ────────────────────────────────────────────────────

const COLS = (withLocation: boolean) =>
  withLocation
    ? "minmax(0, 1fr) 160px 150px 100px 48px"
    : "minmax(0, 1fr) 150px 100px 48px";

export function ItemList({
  folders,
  files,
  h,
}: {
  folders: DriveFolder[];
  files: DriveFile[];
  h: ItemHandlers;
}) {
  const withLocation = Boolean(h.locationOf);
  const cols = COLS(withLocation);
  const items: DriveItem[] = [
    ...folders.map((data) => ({ kind: "folder" as const, data })),
    ...files.map((data) => ({ kind: "file" as const, data })),
  ];
  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 2,
          px: 2,
          height: 40,
          alignItems: "center",
          borderBottom: "1px solid #E0E3E7",
          position: "sticky",
          top: 0,
          bgcolor: "#fff",
          zIndex: 1,
        }}
      >
        {["Nama", ...(withLocation ? ["Lokasi"] : []), "Terakhir diubah", "Ukuran", ""].map((t, i) => (
          <Typography key={i} sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "#1F1F1F" }}>
            {t}
          </Typography>
        ))}
      </Box>
      {items.map((item) => {
        const selected = h.selectedId === item.data.id;
        const { Icon, color } =
          item.kind === "folder" ? { Icon: FolderRounded, color: "#444746" } : fileIcon(item.data);
        return (
          <Box
            key={item.data.id}
            {...itemEvents(item, h)}
            sx={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 2,
              alignItems: "center",
              px: 2,
              height: 48,
              borderBottom: "1px solid #E0E3E7",
              cursor: "pointer",
              userSelect: "none",
              bgcolor: selected ? "#C2E7FF" : "transparent",
              "&:hover": { bgcolor: selected ? "#B4DEFB" : "#F0F4F9" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
              <Icon sx={{ fontSize: 22, color, flexShrink: 0 }} />
              <Typography sx={{ ...nameSx, fontWeight: item.kind === "folder" ? 500 : 400 }} title={item.data.name}>
                {item.data.name}
              </Typography>
              {item.data.starred && <Star />}
              {item.kind === "file" && <StatusBadge file={item.data} />}
            </Box>
            {withLocation && <Typography sx={metaSx}>{h.locationOf!(item)}</Typography>}
            <Typography sx={metaSx} suppressHydrationWarning>
              {formatModified(item.data.updated_at)}
            </Typography>
            <Typography sx={metaSx}>{item.kind === "file" ? formatBytes(item.data.size_bytes) : "—"}</Typography>
            <Box sx={{ justifySelf: "end" }}>
              <MoreButton item={item} h={h} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
