"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import MovieOutlined from "@mui/icons-material/MovieOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import ArrowDropDownOutlined from "@mui/icons-material/ArrowDropDownOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import FormatListBulletedOutlined from "@mui/icons-material/FormatListBulletedOutlined";
import GridViewOutlined from "@mui/icons-material/GridViewOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { formatDate } from "@/features/monitor/format";
import { getPresenterByName } from "../presenters";
import type { TutorialVideoRow, TutorialVideoStatus } from "../types";

const STATUS_LABEL: Record<TutorialVideoStatus, string> = {
  processing: "Rendering",
  done: "Done",
  failed: "Failed",
};
const STATUS_COLOR: Record<TutorialVideoStatus, string> = {
  processing: "#1A73E8",
  done: "#1E8E3E",
  failed: "#D93025",
};

const FOLDER_COLS = "minmax(0, 1fr) 150px 90px";
const VIDEO_COLS = "minmax(0, 1fr) 150px 110px 40px";
const headSx = { fontSize: "0.75rem", fontWeight: 600, color: "#5F6368" };
const metaSx = { fontSize: "0.8125rem", color: "#5F6368" };

// Cloudinary force-download: insert fl_attachment right after /upload/.
function toDownloadUrl(url: string): string {
  return url.replace("/video/upload/", "/video/upload/fl_attachment/");
}
// First-frame poster for grid thumbnails.
function toPosterUrl(url: string): string {
  return url.replace(/\.mp4$/, ".jpg");
}

// ── Modified-date filter presets ────────────────────────────
type ModifiedKey = "today" | "7d" | "30d" | "year";
const MODIFIED_OPTS: { key: ModifiedKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "year", label: "This year" },
];
function modifiedSince(key: ModifiedKey): number {
  const now = Date.now();
  if (key === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (key === "7d") return now - 7 * 86_400_000;
  if (key === "30d") return now - 30 * 86_400_000;
  return new Date(new Date().getFullYear(), 0, 1).getTime();
}

interface Filters {
  presenter: string | null;
  modified: ModifiedKey | null;
  status: TutorialVideoStatus | null;
}
const EMPTY_FILTERS: Filters = { presenter: null, modified: null, status: null };

// ── delete confirm dialog ───────────────────────────────────
function ConfirmDeleteDialog({
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "1.125rem" }}>Delete video?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: "0.875rem" }}>
          This rendered tutorial will be removed from the list and deleted from Cloudinary (freeing
          credits). This can&apos;t be undone.
        </DialogContentText>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: "#5F6368" }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant="contained"
          color="error"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlined />}
          sx={{ textTransform: "none" }}
        >
          {busy ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── rename dialog ───────────────────────────────────────────
function RenameDialog({
  open,
  current,
  busy,
  error,
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  current: string;
  busy: boolean;
  error: string | null;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "1.125rem" }}>Rename video</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Title"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim() && !busy) onConfirm();
          }}
          sx={{ mt: 1 }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", color: "#5F6368" }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy || !value.trim() || value.trim() === current}
          variant="contained"
          disableElevation
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ textTransform: "none", bgcolor: "#0B57D0", "&:hover": { bgcolor: "#0A4BB8" } }}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── per-video actions (view / download / rename / delete) ────
function VideoMenu({
  video,
  onChanged,
  size = 18,
}: {
  video: TutorialVideoRow;
  onChanged?: () => void;
  size?: number;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(video.title ?? "");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const ready = video.status === "done" && Boolean(video.output_url);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tutorial-video/${video.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Delete failed (${res.status})`);
      }
      setConfirm(false);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    setRenameBusy(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/tutorial-video/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Rename failed (${res.status})`);
      }
      setRenameOpen(false);
      onChanged?.();
    } catch (e) {
      setRenameError((e as Error).message);
    } finally {
      setRenameBusy(false);
    }
  };

  return (
    <Box onClick={(e) => e.stopPropagation()}>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: "#5F6368" }}>
        <MoreVertOutlined sx={{ fontSize: size }} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          disabled={!ready}
          component="a"
          href={ready ? video.output_url! : undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon>
            <VisibilityOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>View</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!ready}
          component="a"
          href={ready ? toDownloadUrl(video.output_url!) : undefined}
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon>
            <DownloadOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setRenameValue(video.title ?? "");
            setRenameError(null);
            setRenameOpen(true);
          }}
        >
          <ListItemIcon>
            <EditOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setConfirm(true);
          }}
          sx={{ color: "#D93025" }}
        >
          <ListItemIcon>
            <DeleteOutlined fontSize="small" sx={{ color: "#D93025" }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
      <RenameDialog
        open={renameOpen}
        current={video.title ?? ""}
        busy={renameBusy}
        error={renameError}
        value={renameValue}
        onChange={setRenameValue}
        onClose={() => !renameBusy && setRenameOpen(false)}
        onConfirm={rename}
      />
      <ConfirmDeleteDialog
        open={confirm}
        busy={busy}
        error={error}
        onClose={() => !busy && setConfirm(false)}
        onConfirm={run}
      />
    </Box>
  );
}

// ── Drive-style filter chip ─────────────────────────────────
function FilterChip({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string | null;
  options: { key: string; label: string }[];
  onSelect: (key: string | null) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const active = value != null;
  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.25,
          height: 32,
          pl: 1.5,
          pr: 0.75,
          borderRadius: "9999px",
          border: active ? "1px solid #A8C7FA" : "1px solid #C4C7C5",
          bgcolor: active ? "#D3E3FD" : "transparent",
          color: active ? "#041E49" : "#444746",
          fontSize: "0.8125rem",
          fontWeight: 500,
          fontFamily: "inherit",
          cursor: "pointer",
          whiteSpace: "nowrap",
          "&:hover": { bgcolor: active ? "#C2DBFA" : "rgba(68,71,70,0.06)" },
        }}
      >
        {active ? value : label}
        <ArrowDropDownOutlined sx={{ fontSize: 20 }} />
      </Box>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 200, borderRadius: "8px" } } }}
      >
        {options.map((o) => {
          const selected = value === o.label;
          return (
            <MenuItem
              key={o.key}
              selected={selected}
              onClick={() => {
                onSelect(o.key);
                setAnchor(null);
              }}
              sx={{ fontSize: "0.875rem" }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {selected && <CheckOutlined sx={{ fontSize: 18, color: "#0B57D0" }} />}
              </ListItemIcon>
              {o.label}
            </MenuItem>
          );
        })}
        {active && <Divider />}
        {active && (
          <MenuItem
            onClick={() => {
              onSelect(null);
              setAnchor(null);
            }}
            sx={{ fontSize: "0.875rem", color: "#5F6368" }}
          >
            <ListItemIcon sx={{ minWidth: 32 }} />
            Clear
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

// ── folder row (a presenter) ────────────────────────────────
function FolderRow({
  name,
  count,
  modified,
  onOpen,
}: {
  name: string;
  count: number;
  modified: string;
  onOpen: () => void;
}) {
  return (
    <Box
      onClick={onOpen}
      sx={{
        display: "grid",
        gridTemplateColumns: FOLDER_COLS,
        alignItems: "center",
        gap: 2,
        px: 2,
        height: 48,
        borderBottom: "1px solid #F1F3F4",
        cursor: "pointer",
        "&:hover": { bgcolor: "#F8F9FA" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <FolderOutlined sx={{ fontSize: 22, color: "#5F6368", flexShrink: 0 }} />
        <Typography
          sx={{
            fontSize: "0.875rem",
            color: "#3C4043",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </Typography>
      </Box>
      <Typography sx={metaSx}>{formatDate(modified)}</Typography>
      <Typography sx={metaSx}>
        {count} {count === 1 ? "item" : "items"}
      </Typography>
    </Box>
  );
}

function StatusText({ status }: { status: TutorialVideoStatus }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: STATUS_COLOR[status] }}>
      {status === "processing" && (
        <CircularProgress size={12} thickness={5} sx={{ color: STATUS_COLOR[status] }} />
      )}
      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>{STATUS_LABEL[status]}</Typography>
    </Box>
  );
}

// ── video row (list view) ───────────────────────────────────
function VideoRow({
  video,
  showPresenter,
  onChanged,
}: {
  video: TutorialVideoRow;
  showPresenter: boolean;
  onChanged?: () => void;
}) {
  const ready = video.status === "done" && Boolean(video.output_url);
  const open = () => ready && window.open(video.output_url!, "_blank", "noopener,noreferrer");
  return (
    <Box
      onClick={open}
      sx={{
        display: "grid",
        gridTemplateColumns: VIDEO_COLS,
        alignItems: "center",
        gap: 2,
        px: 2,
        minHeight: 48,
        py: showPresenter ? 0.5 : 0,
        borderBottom: "1px solid #F1F3F4",
        cursor: ready ? "pointer" : "default",
        "&:hover": { bgcolor: "#F8F9FA" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <MovieOutlined sx={{ fontSize: 20, color: "#1A73E8", flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.875rem",
              color: "#3C4043",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {video.title || "Untitled"}
          </Typography>
          {showPresenter && (
            <Typography
              sx={{
                fontSize: "0.6875rem",
                color: "#80868B",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {video.name_text}
            </Typography>
          )}
        </Box>
      </Box>
      <Typography sx={metaSx}>{formatDate(video.created_at)}</Typography>
      <StatusText status={video.status} />
      <Box sx={{ justifySelf: "end" }}>
        <VideoMenu video={video} onChanged={onChanged} />
      </Box>
    </Box>
  );
}

// ── video card (grid view) ──────────────────────────────────
function VideoCard({ video, onChanged }: { video: TutorialVideoRow; onChanged?: () => void }) {
  const ready = video.status === "done" && Boolean(video.output_url);
  const open = () => ready && window.open(video.output_url!, "_blank", "noopener,noreferrer");
  return (
    <Box
      onClick={open}
      sx={{
        borderRadius: "12px",
        border: "1px solid #E0E0E0",
        bgcolor: "#fff",
        overflow: "hidden",
        cursor: ready ? "pointer" : "default",
        transition: "box-shadow 120ms, border-color 120ms",
        "&:hover": { boxShadow: "0 1px 3px rgba(60,64,67,0.2)", borderColor: "#D2D5DA" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1.25 }}>
        <MovieOutlined sx={{ fontSize: 20, color: "#1A73E8", flexShrink: 0 }} />
        <Typography
          sx={{
            flex: 1,
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#3C4043",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {video.title || "Untitled"}
        </Typography>
        <VideoMenu video={video} onChanged={onChanged} size={18} />
      </Box>
      <Box
        sx={{
          mx: 1.5,
          mb: 1.5,
          aspectRatio: "9 / 16",
          maxHeight: 260,
          borderRadius: "8px",
          bgcolor: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {ready ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toPosterUrl(video.output_url!)}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <MovieOutlined sx={{ fontSize: 44, color: "#5F6368" }} />
        )}
      </Box>
      <Box sx={{ px: 1.5, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: "0.6875rem", color: "#80868B" }}>
          {formatDate(video.created_at)}
        </Typography>
        <StatusText status={video.status} />
      </Box>
    </Box>
  );
}

// ── Library ─────────────────────────────────────────────────
export function RecentRenders({
  videos,
  onChanged,
}: {
  videos: TutorialVideoRow[];
  onChanged?: () => void;
}) {
  const [openPresenter, setOpenPresenter] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [folderMenu, setFolderMenu] = useState<null | HTMLElement>(null);

  const presenterOpts = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) set.add(v.name_text);
    return [...set].sort().map((p) => ({ key: p, label: p }));
  }, [videos]);

  const statusOpts = useMemo(() => {
    const set = new Set<TutorialVideoStatus>();
    for (const v of videos) set.add(v.status);
    return [...set].map((s) => ({ key: s, label: STATUS_LABEL[s] }));
  }, [videos]);

  const folders = useMemo(() => {
    const m = new Map<string, TutorialVideoRow[]>();
    for (const v of videos) {
      const arr = m.get(v.name_text);
      if (arr) arr.push(v);
      else m.set(v.name_text, [v]);
    }
    return [...m.entries()]
      .map(([name, vids]) => ({
        name,
        count: vids.length,
        modified: vids.reduce((a, v) => (v.created_at > a ? v.created_at : a), vids[0].created_at),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [videos]);

  const anyFilter = Boolean(filters.presenter || filters.modified || filters.status);
  const inVideosMode = openPresenter !== null || anyFilter;

  const visible = useMemo(() => {
    let base = openPresenter ? videos.filter((v) => v.name_text === openPresenter) : videos;
    if (filters.presenter) base = base.filter((v) => v.name_text === filters.presenter);
    if (filters.status) base = base.filter((v) => v.status === filters.status);
    if (filters.modified) {
      const since = modifiedSince(filters.modified);
      base = base.filter((v) => new Date(v.created_at).getTime() >= since);
    }
    return base;
  }, [videos, openPresenter, filters]);

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setOpenPresenter(null);
  };

  const statusLabel = filters.status ? STATUS_LABEL[filters.status] : null;
  const modifiedLabel = filters.modified
    ? MODIFIED_OPTS.find((o) => o.key === filters.modified)?.label ?? null
    : null;

  if (videos.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, color: "rgba(0,0,0,0.45)" }}>
        <FolderOpenOutlined sx={{ fontSize: 48, color: "#DADCE0", mb: 1 }} />
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#5F6368" }}>
          No renders yet
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem" }}>
          Rendered tutorials will appear here, grouped by presenter.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header: breadcrumb + view toggle + info */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
          <Typography
            onClick={clearAll}
            sx={{
              fontSize: "1.375rem",
              fontWeight: 400,
              color: inVideosMode ? "#5F6368" : "#3C4043",
              cursor: "pointer",
              "&:hover": inVideosMode ? { color: "#3C4043" } : undefined,
            }}
          >
            All renders
          </Typography>

          {openPresenter && (
            <>
              <ChevronRightOutlined sx={{ fontSize: 22, color: "#9AA0A6" }} />
              <Box
                component="button"
                type="button"
                onClick={(e) => setFolderMenu(e.currentTarget)}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.25,
                  border: "none",
                  bgcolor: "transparent",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  borderRadius: "8px",
                  px: 0.5,
                  "&:hover": { bgcolor: "rgba(68,71,70,0.06)" },
                }}
              >
                <Typography sx={{ fontSize: "1.375rem", fontWeight: 500, color: "#3C4043" }}>
                  {openPresenter}
                </Typography>
                <ArrowDropDownOutlined sx={{ fontSize: 24, color: "#3C4043" }} />
              </Box>
              <Menu
                anchorEl={folderMenu}
                open={Boolean(folderMenu)}
                onClose={() => setFolderMenu(null)}
                slotProps={{ paper: { sx: { mt: 0.5, minWidth: 220, borderRadius: "8px" } } }}
              >
                {folders.map((f) => (
                  <MenuItem
                    key={f.name}
                    selected={f.name === openPresenter}
                    onClick={() => {
                      setOpenPresenter(f.name);
                      setFolderMenu(null);
                    }}
                    sx={{ fontSize: "0.875rem" }}
                  >
                    <ListItemIcon sx={{ minWidth: 34 }}>
                      <FolderOutlined sx={{ fontSize: 20, color: "#5F6368" }} />
                    </ListItemIcon>
                    {f.name}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          {!openPresenter && anyFilter && (
            <>
              <ChevronRightOutlined sx={{ fontSize: 22, color: "#9AA0A6" }} />
              <Typography sx={{ fontSize: "1.375rem", fontWeight: 500, color: "#3C4043" }}>
                Search results
              </Typography>
            </>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          <Box sx={{ display: "inline-flex", border: "1px solid #C4C7C5", borderRadius: "9999px", p: "2px" }}>
            {(
              [
                { key: "list", Icon: FormatListBulletedOutlined, label: "List view" },
                { key: "grid", Icon: GridViewOutlined, label: "Grid view" },
              ] as const
            ).map(({ key, Icon, label }) => {
              const active = view === key;
              return (
                <Tooltip key={key} title={label}>
                  <IconButton
                    size="small"
                    onClick={() => setView(key)}
                    sx={{
                      width: 36,
                      height: 28,
                      borderRadius: "9999px",
                      color: active ? "#0B57D0" : "#444746",
                      bgcolor: active ? "#C2E7FF" : "transparent",
                      "&:hover": { bgcolor: active ? "#B4DEFB" : "rgba(68,71,70,0.08)" },
                    }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              );
            })}
          </Box>
          <Tooltip title="Details">
            <IconButton size="small" sx={{ color: "#444746" }}>
              <InfoOutlined sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filter chips */}
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
        <FilterChip
          label="Presenter"
          value={filters.presenter}
          options={presenterOpts}
          onSelect={(k) => setFilters((f) => ({ ...f, presenter: k }))}
        />
        <FilterChip
          label="Modified"
          value={modifiedLabel}
          options={MODIFIED_OPTS}
          onSelect={(k) => setFilters((f) => ({ ...f, modified: k as ModifiedKey | null }))}
        />
        <FilterChip
          label="Status"
          value={statusLabel}
          options={statusOpts}
          onSelect={(k) => setFilters((f) => ({ ...f, status: k as TutorialVideoStatus | null }))}
        />
        {anyFilter && (
          <Box
            component="button"
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            sx={{
              border: "none",
              bgcolor: "transparent",
              color: "#0B57D0",
              fontSize: "0.8125rem",
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "pointer",
              px: 1,
              height: 32,
              borderRadius: "9999px",
              "&:hover": { bgcolor: "rgba(11,87,208,0.08)" },
            }}
          >
            Clear filters
          </Box>
        )}
      </Box>

      {/* Content */}
      {inVideosMode ? (
        visible.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "#9AA0A6" }}>
            <FolderOpenOutlined sx={{ fontSize: 40, color: "#DADCE0", mb: 1 }} />
            <Typography sx={{ fontSize: "0.875rem" }}>No videos match these filters.</Typography>
          </Box>
        ) : view === "grid" ? (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
            {visible.map((v) => (
              <VideoCard key={v.id} video={v} onChanged={onChanged} />
            ))}
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: "grid", gridTemplateColumns: VIDEO_COLS, gap: 2, px: 2, pb: 1, borderBottom: "1px solid #E0E0E0" }}>
              {["Name", "Last modified", "Status", ""].map((h, i) => (
                <Typography key={i} sx={headSx}>
                  {h}
                </Typography>
              ))}
            </Box>
            {visible.map((v) => (
              <VideoRow key={v.id} video={v} showPresenter={!openPresenter} onChanged={onChanged} />
            ))}
          </Box>
        )
      ) : view === "grid" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 2 }}>
          {folders.map((f) => {
            const presenter = getPresenterByName(f.name);
            return (
              <Box
                key={f.name}
                onClick={() => setOpenPresenter(f.name)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 2,
                  height: 56,
                  borderRadius: "12px",
                  border: "1px solid #E0E0E0",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "#F8F9FA" },
                }}
              >
                <FolderOutlined sx={{ fontSize: 24, color: "#5F6368" }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.875rem",
                      color: "#3C4043",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {f.name}
                  </Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: "#80868B" }}>
                    {presenter ? `${presenter.handle} · ` : ""}
                    {f.count} {f.count === 1 ? "item" : "items"}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box>
          <Box sx={{ display: "grid", gridTemplateColumns: FOLDER_COLS, gap: 2, px: 2, pb: 1, borderBottom: "1px solid #E0E0E0" }}>
            {["Name", "Last modified", "Items"].map((h, i) => (
              <Typography key={i} sx={headSx}>
                {h}
              </Typography>
            ))}
          </Box>
          {folders.map((f) => (
            <FolderRow
              key={f.name}
              name={f.name}
              count={f.count}
              modified={f.modified}
              onOpen={() => setOpenPresenter(f.name)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
