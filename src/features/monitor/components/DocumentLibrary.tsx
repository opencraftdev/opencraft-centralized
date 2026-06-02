"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import SlideshowOutlined from "@mui/icons-material/SlideshowOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import ChevronRightOutlined from "@mui/icons-material/ChevronRightOutlined";
import ArrowDropDownOutlined from "@mui/icons-material/ArrowDropDownOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import FormatListBulletedOutlined from "@mui/icons-material/FormatListBulletedOutlined";
import GridViewOutlined from "@mui/icons-material/GridViewOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { formatDate, formatBytes } from "../format";
import type { DocumentHistoryItem } from "@/lib/monitor/types";

const TYPE_LABEL: Record<string, string> = { sph: "SPH", mou: "MoU", deck: "Deck" };
const STATUS_LABEL: Record<string, string> = {
  generated: "Generated",
  failed: "Failed",
  pending: "Pending",
};
const UNASSIGNED = "Unassigned";

// Each client is a folder. Derive the client name from the document.
function clientKey(doc: DocumentHistoryItem): string {
  const raw = doc.tool || (doc.metadata?.client as string | undefined) || "";
  return raw.toString().trim() || UNASSIGNED;
}

function fileIcon(docType: string | null): { Icon: typeof PictureAsPdfOutlined; color: string } {
  switch (docType) {
    case "sph":
      return { Icon: PictureAsPdfOutlined, color: "#D93025" };
    case "mou":
      return { Icon: PictureAsPdfOutlined, color: "#1A73E8" };
    case "deck":
      return { Icon: SlideshowOutlined, color: "#E37400" };
    default:
      return { Icon: InsertDriveFileOutlined, color: "#5F6368" };
  }
}

const FOLDER_COLS = "minmax(0, 1fr) 150px 90px";
const DOC_COLS = "minmax(0, 1fr) 130px 90px 70px 40px";

const headSx = { fontSize: "0.75rem", fontWeight: 600, color: "#5F6368" };
const metaSx = { fontSize: "0.8125rem", color: "#5F6368" };

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
  type: string | null;
  client: string | null;
  modified: ModifiedKey | null;
  status: string | null;
}
const EMPTY_FILTERS: Filters = { type: null, client: null, modified: null, status: null };

// ── delete state + confirm dialog ───────────────────────────
function useDelete(doc: DocumentHistoryItem) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Delete failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return { open, setOpen, busy, error, run };
}

function ConfirmDeleteDialog({
  doc,
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  doc: DocumentHistoryItem;
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "1.125rem" }}>Delete document?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: "0.875rem" }}>
          <strong>{doc.title}</strong> will be removed from the history
          {doc.s3_key ? " and its file deleted from storage" : ""}. This can&apos;t be undone.
        </DialogContentText>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
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
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DeleteOutline />}
          sx={{ textTransform: "none" }}
        >
          {busy ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── shared row/card actions (view / download / delete) ──────
function DocMenu({ doc, size = 18 }: { doc: DocumentHistoryItem; size?: number }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const del = useDelete(doc);
  return (
    <Box onClick={(e) => e.stopPropagation()}>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: "#5F6368" }}>
        <MoreVertOutlined sx={{ fontSize: size }} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          disabled={!doc.viewUrl}
          component="a"
          href={doc.viewUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon><VisibilityOutlined fontSize="small" /></ListItemIcon>
          <ListItemText>View</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!doc.downloadUrl}
          component="a"
          href={doc.downloadUrl ?? undefined}
          onClick={() => setAnchor(null)}
        >
          <ListItemIcon><DownloadOutlined fontSize="small" /></ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); del.setOpen(true); }} sx={{ color: "#D93025" }}>
          <ListItemIcon><DeleteOutline fontSize="small" sx={{ color: "#D93025" }} /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
      <ConfirmDeleteDialog
        doc={doc}
        open={del.open}
        busy={del.busy}
        error={del.error}
        onClose={() => del.setOpen(false)}
        onConfirm={del.run}
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
  value: string | null; // currently selected value label, or null
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
          transition: "background 120ms",
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

// ── folder row (a client) ───────────────────────────────────
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
        <Typography sx={{ fontSize: "0.875rem", color: "#3C4043", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </Typography>
      </Box>
      <Typography sx={metaSx}>{formatDate(modified)}</Typography>
      <Typography sx={metaSx}>{count} {count === 1 ? "item" : "items"}</Typography>
    </Box>
  );
}

// ── document row (list view) ────────────────────────────────
function DocumentRow({ doc, showClient = false }: { doc: DocumentHistoryItem; showClient?: boolean }) {
  const { Icon, color } = fileIcon(doc.doc_type);
  const open = () => doc.viewUrl && window.open(doc.viewUrl, "_blank", "noopener,noreferrer");

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: DOC_COLS,
        alignItems: "center",
        gap: 2,
        px: 2,
        minHeight: 48,
        py: showClient ? 0.5 : 0,
        borderBottom: "1px solid #F1F3F4",
        cursor: doc.viewUrl ? "pointer" : "default",
        "&:hover": { bgcolor: "#F8F9FA" },
      }}
      onClick={open}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <Icon sx={{ fontSize: 20, color, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.875rem", color: "#3C4043", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {doc.title}
            {doc.status === "failed" && (
              <Typography component="span" sx={{ ml: 1, fontSize: "0.6875rem", color: "#D93025", fontWeight: 600 }}>
                (failed)
              </Typography>
            )}
          </Typography>
          {showClient && (
            <Typography sx={{ fontSize: "0.6875rem", color: "#80868B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {clientKey(doc)}
            </Typography>
          )}
        </Box>
      </Box>
      <Typography sx={metaSx}>{formatDate(doc.generated_at)}</Typography>
      <Typography sx={metaSx}>{formatBytes(doc.size_bytes)}</Typography>
      <Typography sx={metaSx}>{TYPE_LABEL[doc.doc_type ?? ""] ?? doc.doc_type ?? "—"}</Typography>
      <Box sx={{ justifySelf: "end" }}>
        <DocMenu doc={doc} />
      </Box>
    </Box>
  );
}

// ── document card (grid view) ───────────────────────────────
function DocumentCard({ doc }: { doc: DocumentHistoryItem }) {
  const { Icon, color } = fileIcon(doc.doc_type);
  const open = () => doc.viewUrl && window.open(doc.viewUrl, "_blank", "noopener,noreferrer");
  return (
    <Box
      onClick={open}
      sx={{
        borderRadius: "12px",
        border: "1px solid #E0E0E0",
        bgcolor: "#fff",
        overflow: "hidden",
        cursor: doc.viewUrl ? "pointer" : "default",
        transition: "box-shadow 120ms, border-color 120ms",
        "&:hover": { boxShadow: "0 1px 3px rgba(60,64,67,0.2)", borderColor: "#D2D5DA" },
      }}
    >
      {/* Title row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1.25 }}>
        <Icon sx={{ fontSize: 20, color, flexShrink: 0 }} />
        <Typography sx={{ flex: 1, fontSize: "0.8125rem", fontWeight: 500, color: "#3C4043", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {doc.title}
        </Typography>
        <DocMenu doc={doc} size={18} />
      </Box>
      {/* Thumbnail / preview area */}
      <Box
        sx={{
          mx: 1.5,
          mb: 1.5,
          height: 120,
          borderRadius: "8px",
          bgcolor: "#F8F9FA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon sx={{ fontSize: 44, color: `${color}99` }} />
      </Box>
      {/* Meta */}
      <Box sx={{ px: 1.5, pb: 1.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
        <Typography sx={{ fontSize: "0.6875rem", color: "#80868B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {clientKey(doc)}
        </Typography>
        <Typography sx={{ fontSize: "0.6875rem", color: "#80868B" }}>
          {formatDate(doc.generated_at)} · {formatBytes(doc.size_bytes)}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Library ─────────────────────────────────────────────────
export function DocumentLibrary({ documents }: { documents: DocumentHistoryItem[] }) {
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [folderMenu, setFolderMenu] = useState<null | HTMLElement>(null);

  // Distinct option sets derived from the data.
  const typeOpts = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) if (d.doc_type) set.add(d.doc_type);
    return [...set].map((t) => ({ key: t, label: TYPE_LABEL[t] ?? t.toUpperCase() }));
  }, [documents]);

  const clientOpts = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) set.add(clientKey(d));
    return [...set].sort().map((c) => ({ key: c, label: c }));
  }, [documents]);

  const statusOpts = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) set.add(d.status);
    return [...set].map((s) => ({ key: s, label: STATUS_LABEL[s] ?? s }));
  }, [documents]);

  const folders = useMemo(() => {
    const m = new Map<string, DocumentHistoryItem[]>();
    for (const d of documents) {
      const key = clientKey(d);
      const arr = m.get(key);
      if (arr) arr.push(d);
      else m.set(key, [d]);
    }
    return [...m.entries()]
      .map(([name, docs]) => ({
        name,
        count: docs.length,
        modified: docs.reduce((a, d) => (d.generated_at > a ? d.generated_at : a), docs[0].generated_at),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [documents]);

  const anyFilter = Boolean(filters.type || filters.client || filters.modified || filters.status);
  const inDocsMode = openClient !== null || anyFilter;

  const visibleDocs = useMemo(() => {
    let base = openClient ? documents.filter((d) => clientKey(d) === openClient) : documents;
    if (filters.type) base = base.filter((d) => d.doc_type === filters.type);
    if (filters.client) base = base.filter((d) => clientKey(d) === filters.client);
    if (filters.status) base = base.filter((d) => d.status === filters.status);
    if (filters.modified) {
      const since = modifiedSince(filters.modified);
      base = base.filter((d) => new Date(d.generated_at).getTime() >= since);
    }
    return base;
  }, [documents, openClient, filters]);

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setOpenClient(null);
  };

  // Labels for active filter chips.
  const typeLabel = filters.type ? TYPE_LABEL[filters.type] ?? filters.type.toUpperCase() : null;
  const clientLabel = filters.client;
  const statusLabel = filters.status ? STATUS_LABEL[filters.status] ?? filters.status : null;
  const modifiedLabel = filters.modified
    ? MODIFIED_OPTS.find((o) => o.key === filters.modified)?.label ?? null
    : null;

  if (documents.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 10, color: "rgba(0,0,0,0.45)" }}>
        <FolderOpenOutlined sx={{ fontSize: 48, color: "#DADCE0", mb: 1 }} />
        <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: "#5F6368" }}>No documents yet</Typography>
        <Typography sx={{ fontSize: "0.8125rem" }}>
          Generated documents will appear here, grouped by client.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Drive-style header: breadcrumb + view toggle + info ── */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
          <Typography
            onClick={clearAll}
            sx={{
              fontSize: "1.375rem",
              fontWeight: 400,
              color: inDocsMode ? "#5F6368" : "#3C4043",
              cursor: "pointer",
              "&:hover": inDocsMode ? { color: "#3C4043" } : undefined,
            }}
          >
            All documents
          </Typography>

          {openClient && (
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
                  {openClient}
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
                    selected={f.name === openClient}
                    onClick={() => {
                      setOpenClient(f.name);
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

          {!openClient && anyFilter && (
            <>
              <ChevronRightOutlined sx={{ fontSize: 22, color: "#9AA0A6" }} />
              <Typography sx={{ fontSize: "1.375rem", fontWeight: 500, color: "#3C4043" }}>
                Search results
              </Typography>
            </>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {/* Segmented list/grid toggle */}
          <Box
            sx={{
              display: "inline-flex",
              border: "1px solid #C4C7C5",
              borderRadius: "9999px",
              p: "2px",
            }}
          >
            {([
              { key: "list", Icon: FormatListBulletedOutlined, label: "List view" },
              { key: "grid", Icon: GridViewOutlined, label: "Grid view" },
            ] as const).map(({ key, Icon, label }) => {
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

      {/* ── Drive-style filter chips ── */}
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
        <FilterChip
          label="Type"
          value={typeLabel}
          options={typeOpts}
          onSelect={(k) => setFilters((f) => ({ ...f, type: k }))}
        />
        <FilterChip
          label="Client"
          value={clientLabel}
          options={clientOpts}
          onSelect={(k) => setFilters((f) => ({ ...f, client: k }))}
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
          onSelect={(k) => setFilters((f) => ({ ...f, status: k }))}
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

      {/* ── Content ── */}
      {inDocsMode ? (
        visibleDocs.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "#9AA0A6" }}>
            <FolderOpenOutlined sx={{ fontSize: 40, color: "#DADCE0", mb: 1 }} />
            <Typography sx={{ fontSize: "0.875rem" }}>No documents match these filters.</Typography>
          </Box>
        ) : view === "grid" ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 2,
            }}
          >
            {visibleDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: "grid", gridTemplateColumns: DOC_COLS, gap: 2, px: 2, pb: 1, borderBottom: "1px solid #E0E0E0" }}>
              {["Name", "Created", "File size", "Type", ""].map((h, i) => (
                <Typography key={i} sx={headSx}>{h}</Typography>
              ))}
            </Box>
            {visibleDocs.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} showClient={!openClient} />
            ))}
          </Box>
        )
      ) : view === "grid" ? (
        // Top-level grid: folders as cards
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 2 }}>
          {folders.map((f) => (
            <Box
              key={f.name}
              onClick={() => setOpenClient(f.name)}
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
                <Typography sx={{ fontSize: "0.875rem", color: "#3C4043", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.name}
                </Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: "#80868B" }}>
                  {f.count} {f.count === 1 ? "item" : "items"}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        // Top-level list: client folders
        <Box>
          <Box sx={{ display: "grid", gridTemplateColumns: FOLDER_COLS, gap: 2, px: 2, pb: 1, borderBottom: "1px solid #E0E0E0" }}>
            {["Name", "Last modified", "Items"].map((h, i) => (
              <Typography key={i} sx={headSx}>{h}</Typography>
            ))}
          </Box>
          {folders.map((f) => (
            <FolderRow key={f.name} name={f.name} count={f.count} modified={f.modified} onOpen={() => setOpenClient(f.name)} />
          ))}
        </Box>
      )}
    </Box>
  );
}
