"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import AddRounded from "@mui/icons-material/AddRounded";
import CreateNewFolderOutlined from "@mui/icons-material/CreateNewFolderOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import HomeRounded from "@mui/icons-material/HomeRounded";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import StarBorderRounded from "@mui/icons-material/StarBorderRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import DeleteForeverOutlined from "@mui/icons-material/DeleteForeverOutlined";
import RestoreFromTrashOutlined from "@mui/icons-material/RestoreFromTrashOutlined";
import SearchRounded from "@mui/icons-material/SearchRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import FormatListBulletedRounded from "@mui/icons-material/FormatListBulletedRounded";
import GridViewRounded from "@mui/icons-material/GridViewRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import DriveFileRenameOutlineOutlined from "@mui/icons-material/DriveFileRenameOutlineOutlined";
import DriveFileMoveOutlined from "@mui/icons-material/DriveFileMoveOutlined";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import type { DriveDocType, DriveFile, DriveFolder } from "@/lib/drive/types";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import {
  createFolder,
  createGenerateJob,
  deleteForever,
  fetchDrive,
  moveItem,
  renameItem,
  restoreItem,
  retryJob,
  trashItem,
  updateItem,
  uploadFile,
} from "../api";
import { driveDownloadUrl } from "@/lib/drive/links";
import { FileGrid, FolderGrid, ItemList, isBusy, type DriveItem, type ItemHandlers, type MenuTarget } from "./DriveItems";
import { ConfirmDialog, GenerateDialog, MoveDialog, NameDialog } from "./DriveDialogs";
import { PreviewDialog } from "./PreviewDialog";

type View = "drive" | "recent" | "starred" | "trash";
type SortKey = "name" | "modified";
type Layout = "list" | "grid";

const NAV: { key: View; label: string; Icon: typeof HomeOutlined; ActiveIcon: typeof HomeOutlined }[] = [
  { key: "drive", label: "Drive Saya", Icon: HomeOutlined, ActiveIcon: HomeRounded },
  { key: "recent", label: "Terbaru", Icon: ScheduleOutlined, ActiveIcon: ScheduleRounded },
  { key: "starred", label: "Berbintang", Icon: StarBorderRounded, ActiveIcon: StarRounded },
  { key: "trash", label: "Sampah", Icon: DeleteOutlineRounded, ActiveIcon: DeleteRounded },
];
const VIEW_TITLE: Record<View, string> = { drive: "Drive Saya", recent: "Terbaru", starred: "Berbintang", trash: "Sampah" };
const ROOT_FOLDER_FOR: Partial<Record<DriveDocType, string>> = { sph: "SPH", mou: "MoU", deck: "Deck" };
const RECENT_LIMIT = 50;
const POLL_MS = 4000;
const LAYOUT_KEY = "drive.layout";

const pill = { borderRadius: "9999px" } as const;

function navigate(params: { view?: View; folder?: string | null }) {
  const qs = new URLSearchParams();
  if (params.view && params.view !== "drive") qs.set("view", params.view);
  if (params.folder) qs.set("folder", params.folder);
  const s = qs.toString();
  window.history.pushState(null, "", s ? `/documents?${s}` : "/documents");
}

export function Drive({
  initialFolders,
  initialFiles,
  userId,
}: {
  initialFolders: DriveFolder[];
  initialFiles: DriveFile[];
  userId: string;
}) {
  const params = useSearchParams();
  const rawView = params.get("view");
  const view: View = rawView === "recent" || rawView === "starred" || rawView === "trash" ? rawView : "drive";
  const folderParam = view === "drive" ? params.get("folder") : null;

  const [folders, setFolders] = useState(initialFolders);
  const [files, setFiles] = useState(initialFiles);
  const [layout, setLayout] = useState<Layout>("list");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [newMenu, setNewMenu] = useState<HTMLElement | null>(null);
  const [sortMenu, setSortMenu] = useState<HTMLElement | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [renaming, setRenaming] = useState<DriveItem | null>(null);
  const [moving, setMoving] = useState<DriveItem | null>(null);
  const [purging, setPurging] = useState<DriveItem | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LAYOUT_KEY);
      if (v === "grid" || v === "list") setLayout(v);
    } catch {}
  }, []);
  const changeLayout = (l: Layout) => {
    setLayout(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {}
  };

  // Reset transient UI when the location changes.
  useEffect(() => {
    setSelectedId(null);
    setQuery("");
  }, [view, folderParam]);

  const refresh = useCallback(async () => {
    try {
      const d = await fetchDrive();
      setFolders(d.folders);
      setFiles(d.files);
    } catch (e) {
      toastError((e as Error).message);
    }
  }, []);

  // ── derived ───────────────────────────────────────────────
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  // A folder is "gone" when it, or any ancestor, is in the trash.
  const goneFolders = useMemo(() => {
    const gone = new Set<string>();
    for (const f of folders) {
      let cur: DriveFolder | undefined = f;
      const seen = new Set<string>();
      while (cur && !seen.has(cur.id)) {
        if (cur.trashed_at) {
          gone.add(f.id);
          break;
        }
        seen.add(cur.id);
        cur = cur.parent_id ? folderById.get(cur.parent_id) : undefined;
      }
    }
    return gone;
  }, [folders, folderById]);
  const fileGone = useCallback(
    (f: DriveFile) => Boolean(f.trashed_at) || (f.folder_id != null && goneFolders.has(f.folder_id)),
    [goneFolders],
  );

  const currentFolder =
    folderParam && folderById.has(folderParam) && !goneFolders.has(folderParam) ? folderById.get(folderParam)! : null;
  const currentFolderId = currentFolder?.id ?? null;

  const breadcrumb = useMemo(() => {
    const trail: DriveFolder[] = [];
    let cur = currentFolder;
    while (cur && trail.length < 32) {
      trail.unshift(cur);
      cur = cur.parent_id ? folderById.get(cur.parent_id) ?? null : null;
    }
    return trail;
  }, [currentFolder, folderById]);

  const { shownFolders, shownFiles } = useMemo(() => {
    let fo: DriveFolder[] = [];
    let fi: DriveFile[] = [];
    if (view === "drive") {
      fo = folders.filter((f) => f.parent_id === currentFolderId && !f.trashed_at);
      fi = files.filter((f) => f.folder_id === currentFolderId && !f.trashed_at);
    } else if (view === "recent") {
      fi = files
        .filter((f) => !fileGone(f))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, RECENT_LIMIT);
    } else if (view === "starred") {
      fo = folders.filter((f) => f.starred && !goneFolders.has(f.id));
      fi = files.filter((f) => f.starred && !fileGone(f));
    } else {
      // Only the top-most trashed things; their contents come back with them on restore.
      fo = folders.filter((f) => f.trashed_at && !(f.parent_id && goneFolders.has(f.parent_id)));
      fi = files.filter((f) => f.trashed_at && !(f.folder_id && goneFolders.has(f.folder_id)));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      fo = fo.filter((f) => f.name.toLowerCase().includes(q));
      fi = fi.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (view !== "recent") {
      const cmp = (a: { name: string; updated_at: string }, b: { name: string; updated_at: string }) =>
        sort.dir *
        (sort.key === "name"
          ? a.name.localeCompare(b.name, "id", { numeric: true, sensitivity: "base" })
          : a.updated_at.localeCompare(b.updated_at));
      fo = [...fo].sort(cmp);
      fi = [...fi].sort(cmp);
    }
    return { shownFolders: fo, shownFiles: fi };
  }, [view, folders, files, currentFolderId, query, sort, fileGone, goneFolders]);

  // Poll while any live generate job is in flight.
  const anyBusy = files.some((f) => isBusy(f) && !fileGone(f));
  useEffect(() => {
    if (!anyBusy) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [anyBusy, refresh]);

  const previewFile = previewId ? files.find((f) => f.id === previewId) ?? null : null;

  // ── helpers ───────────────────────────────────────────────
  const locationOf = (item: DriveItem) => {
    const parent = item.kind === "folder" ? item.data.parent_id : item.data.folder_id;
    return parent ? folderById.get(parent)?.name ?? "—" : "Drive Saya";
  };

  const subtree = (rootId: string) => {
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders)
        if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) {
          ids.add(f.id);
          grew = true;
        }
    }
    return ids;
  };

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toastSuccess(success);
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      await refresh();
    }
  };

  const openItem = (item: DriveItem) => {
    if (item.kind === "folder") {
      if (view === "trash") return;
      navigate({ folder: item.data.id });
    } else {
      setPreviewId(item.data.id);
    }
  };

  const download = (file: DriveFile) => {
    if (!file.google_file_id) return toastError("File belum tersedia untuk diunduh");
    const a = document.createElement("a");
    a.href = driveDownloadUrl(file.google_file_id);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const uploadTarget = view === "drive" ? currentFolderId : null;
  const uploadFiles = async (list: FileList | File[]) => {
    const arr = Array.from(list);
    if (!arr.length) return;
    setUploading((n) => n + arr.length);
    let ok = 0;
    for (const f of arr) {
      try {
        await uploadFile(f, uploadTarget, userId);
        ok++;
      } catch (e) {
        toastError(`${f.name}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (ok) toastSuccess(`${ok} file diupload`);
    if (view !== "drive") navigate({ folder: uploadTarget });
    await refresh();
  };

  const generateDestination = (t: DriveDocType): DriveFolder | null => {
    if (view === "drive" && currentFolder) return currentFolder;
    const name = ROOT_FOLDER_FOR[t];
    return name ? folders.find((f) => f.parent_id === null && !f.trashed_at && f.name === name) ?? null : null;
  };

  const handlers: ItemHandlers = {
    selectedId,
    onSelect: (item) => setSelectedId(item.data.id),
    onOpen: openItem,
    onMenu: setMenu,
    locationOf: view === "drive" ? undefined : locationOf,
  };

  // ── render ────────────────────────────────────────────────
  const empty = shownFolders.length === 0 && shownFiles.length === 0;
  const menuItem = menu?.item;
  const closeMenu = () => setMenu(null);

  return (
    <Box sx={{ height: "100%", display: "flex", gap: 1, pr: 2, pb: 2, pl: 1, bgcolor: "#F0F4F9" }}>
      {/* ── left sub-nav ── */}
      <Box sx={{ width: 232, flexShrink: 0, pt: 1, display: "flex", flexDirection: "column" }}>
        <Button
          onClick={(e) => setNewMenu(e.currentTarget)}
          startIcon={<AddRounded sx={{ fontSize: "24px !important" }} />}
          sx={{
            alignSelf: "flex-start",
            height: 56,
            px: 2.5,
            ml: 0.5,
            mb: 2,
            borderRadius: "16px",
            bgcolor: "#fff",
            color: "#1F1F1F",
            fontSize: "0.9375rem",
            fontWeight: 500,
            boxShadow: "0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)",
            "&:hover": { bgcolor: "#EDF2FA", boxShadow: "0 1px 3px rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)" },
          }}
        >
          Baru
        </Button>
        <Menu
          anchorEl={newMenu}
          open={Boolean(newMenu)}
          onClose={() => setNewMenu(null)}
          slotProps={{ paper: { sx: { minWidth: 240, borderRadius: "8px" } } }}
        >
          <MenuItem
            onClick={() => {
              setNewMenu(null);
              setNewFolderOpen(true);
            }}
          >
            <ListItemIcon>
              <CreateNewFolderOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Folder baru</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setNewMenu(null);
              fileInput.current?.click();
            }}
          >
            <ListItemIcon>
              <UploadFileOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Upload file</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setNewMenu(null);
              setGenerateOpen(true);
            }}
          >
            <ListItemIcon>
              <AutoAwesomeOutlined fontSize="small" sx={{ color: "#8E5CF5" }} />
            </ListItemIcon>
            <ListItemText>Generate dokumen</ListItemText>
          </MenuItem>
        </Menu>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const list = e.target.files;
            if (list) uploadFiles(Array.from(list));
            e.target.value = "";
          }}
        />

        {NAV.map(({ key, label, Icon, ActiveIcon }) => {
          const active = view === key;
          const I = active ? ActiveIcon : Icon;
          return (
            <Box
              key={key}
              component="button"
              type="button"
              onClick={() => navigate({ view: key })}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                height: 32,
                px: 2,
                mb: "2px",
                border: "none",
                borderRadius: "9999px",
                bgcolor: active ? "#C2E7FF" : "transparent",
                color: active ? "#001D35" : "#1F1F1F",
                fontFamily: "inherit",
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
                "&:hover": { bgcolor: active ? "#B4DEFB" : "rgba(68,71,70,0.08)" },
              }}
            >
              <I sx={{ fontSize: 20 }} />
              {label}
            </Box>
          );
        })}
        {uploading > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, mt: 2, color: "#444746" }}>
            <CircularProgress size={16} />
            <Typography sx={{ fontSize: "0.8125rem" }}>Mengupload {uploading} file…</Typography>
          </Box>
        )}
      </Box>

      {/* ── content card ── */}
      <Box
        onDragOver={(e) => {
          if (view !== "trash" && e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (view !== "trash" && e.dataTransfer.files.length) uploadFiles(Array.from(e.dataTransfer.files));
        }}
        sx={{
          flex: 1,
          minWidth: 0,
          mt: 1,
          bgcolor: "#fff",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          outline: dragOver ? "2px solid #0B57D0" : "none",
          outlineOffset: -2,
        }}
      >
        {/* header */}
        <Box sx={{ px: 3, pt: 2, pb: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, minHeight: 48 }}>
            <Box sx={{ flex: "1 1 auto", minWidth: 120, display: "flex", alignItems: "center", gap: 0.25, overflow: "hidden" }}>
              {view === "drive" ? (
                [null, ...breadcrumb].map((f, i, arr) => {
                  const last = i === arr.length - 1;
                  return (
                    <Box key={f?.id ?? "root"} sx={{ display: "flex", alignItems: "center", minWidth: 0, flexShrink: last ? 1 : 0 }}>
                      {i > 0 && <ChevronRightRounded sx={{ color: "#444746", fontSize: 22 }} />}
                      <Box
                        component={last ? "span" : "button"}
                        type={last ? undefined : "button"}
                        onClick={last ? undefined : () => navigate({ folder: f?.id ?? null })}
                        sx={{
                          border: "none",
                          bgcolor: "transparent",
                          fontFamily: "inherit",
                          fontSize: "1.5rem",
                          fontWeight: 400,
                          color: last ? "#1F1F1F" : "#444746",
                          px: 1.5,
                          py: 0.5,
                          borderRadius: "9999px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          cursor: last ? "default" : "pointer",
                          "&:hover": last ? undefined : { bgcolor: "rgba(68,71,70,0.08)" },
                        }}
                      >
                        {f?.name ?? "Drive Saya"}
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Typography sx={{ fontSize: "1.5rem", px: 1.5, color: "#1F1F1F" }}>{VIEW_TITLE[view]}</Typography>
              )}
            </Box>

            {/* search */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flex: "0 1 320px",
                minWidth: 150,
                height: 44,
                px: 1.5,
                borderRadius: "9999px",
                bgcolor: "#E9EEF6",
                "&:focus-within": { bgcolor: "#fff", boxShadow: "0 1px 1px rgba(65,69,73,.3), 0 1px 3px 1px rgba(65,69,73,.15)" },
              }}
            >
              <SearchRounded sx={{ color: "#444746" }} />
              <InputBase
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Telusuri di ${view === "drive" ? currentFolder?.name ?? "Drive Saya" : VIEW_TITLE[view]}`}
                sx={{ flex: 1, fontSize: "0.9375rem" }}
                inputProps={{ "aria-label": "Telusuri" }}
              />
              {query && (
                <IconButton size="small" onClick={() => setQuery("")} aria-label="Hapus pencarian">
                  <CloseRounded fontSize="small" />
                </IconButton>
              )}
            </Box>

            {/* layout toggle */}
            <Box sx={{ display: "inline-flex", border: "1px solid #747775", borderRadius: "9999px", flexShrink: 0 }}>
              {([
                { key: "list", Icon: FormatListBulletedRounded, label: "Tampilan daftar" },
                { key: "grid", Icon: GridViewRounded, label: "Tampilan petak" },
              ] as const).map(({ key, Icon, label }, i) => {
                const active = layout === key;
                return (
                  <Tooltip key={key} title={label}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => changeLayout(key)}
                      aria-label={label}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        height: 32,
                        px: 1.5,
                        border: "none",
                        borderLeft: i ? "1px solid #747775" : "none",
                        borderRadius: i ? "0 9999px 9999px 0" : "9999px 0 0 9999px",
                        bgcolor: active ? "#C2E7FF" : "transparent",
                        color: active ? "#001D35" : "#444746",
                        cursor: "pointer",
                      }}
                    >
                      {active && <CheckRounded sx={{ fontSize: 18 }} />}
                      <Icon sx={{ fontSize: 18 }} />
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>

          {/* sort row */}
          {view !== "recent" && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pl: 1 }}>
              <Button
                size="small"
                onClick={(e) => setSortMenu(e.currentTarget)}
                sx={{ ...pill, color: "#444746", fontWeight: 500 }}
              >
                Urutkan: {sort.key === "name" ? "Nama" : "Terakhir diubah"}
              </Button>
              <Tooltip title={sort.dir === 1 ? "Naik" : "Turun"}>
                <IconButton size="small" onClick={() => setSort((s) => ({ ...s, dir: s.dir === 1 ? -1 : 1 }))}>
                  {sort.dir === 1 ? <ArrowUpwardRounded fontSize="small" /> : <ArrowDownwardRounded fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Menu anchorEl={sortMenu} open={Boolean(sortMenu)} onClose={() => setSortMenu(null)}>
                {([
                  ["name", "Nama", 1],
                  ["modified", "Terakhir diubah", -1],
                ] as const).map(([key, label, dir]) => (
                  <MenuItem
                    key={key}
                    onClick={() => {
                      setSort((s) => (s.key === key ? s : { key, dir }));
                      setSortMenu(null);
                    }}
                  >
                    <ListItemIcon>{sort.key === key && <CheckRounded fontSize="small" />}</ListItemIcon>
                    {label}
                  </MenuItem>
                ))}
              </Menu>
              {view === "trash" && (
                <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", ml: 2 }}>
                  Item di sampah bisa dipulihkan atau dihapus permanen.
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* body */}
        <Box
          sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, pb: 3 }}
          onClick={(e) => e.target === e.currentTarget && setSelectedId(null)}
        >
          {empty ? (
            <Box sx={{ textAlign: "center", py: 10, color: "#5F6368" }}>
              <FolderOpenOutlined sx={{ fontSize: 56, color: "#C4C7C5", mb: 1 }} />
              <Typography sx={{ fontSize: "1rem", fontWeight: 500, color: "#1F1F1F" }}>
                {query
                  ? "Tidak ada yang cocok"
                  : view === "trash"
                    ? "Sampah kosong"
                    : view === "starred"
                      ? "Belum ada item berbintang"
                      : view === "recent"
                        ? "Belum ada file"
                        : "Folder ini kosong"}
              </Typography>
              {!query && view === "drive" && (
                <Typography sx={{ fontSize: "0.875rem", mt: 0.5 }}>
                  Tarik file ke sini, atau pakai tombol <b>Baru</b> untuk upload atau generate dokumen.
                </Typography>
              )}
            </Box>
          ) : layout === "list" ? (
            <ItemList folders={shownFolders} files={shownFiles} h={handlers} />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              {shownFolders.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, mb: 1.5 }}>Folder</Typography>
                  <FolderGrid folders={shownFolders} h={handlers} />
                </Box>
              )}
              {shownFiles.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, mb: 1.5 }}>File</Typography>
                  <FileGrid files={shownFiles} h={handlers} />
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── item context menu ── */}
      <Menu
        open={Boolean(menu)}
        onClose={closeMenu}
        anchorEl={menu?.anchor ?? null}
        anchorReference={menu?.position ? "anchorPosition" : "anchorEl"}
        anchorPosition={menu?.position}
        slotProps={{ paper: { sx: { minWidth: 240, borderRadius: "8px" } } }}
      >
        {menuItem &&
          (view === "trash"
            ? [
                <MenuItem
                  key="restore"
                  onClick={() => {
                    closeMenu();
                    act(() => restoreItem(menuItem.kind, menuItem.data.id), "Dipulihkan");
                  }}
                >
                  <ListItemIcon>
                    <RestoreFromTrashOutlined fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Pulihkan</ListItemText>
                </MenuItem>,
                <MenuItem
                  key="purge"
                  onClick={() => {
                    closeMenu();
                    setPurging(menuItem);
                  }}
                >
                  <ListItemIcon>
                    <DeleteForeverOutlined fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Hapus permanen</ListItemText>
                </MenuItem>,
              ]
            : [
                <MenuItem
                  key="open"
                  onClick={() => {
                    closeMenu();
                    openItem(menuItem);
                  }}
                >
                  <ListItemIcon>
                    {menuItem.kind === "folder" ? <FolderOpenOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>{menuItem.kind === "folder" ? "Buka" : "Pratinjau"}</ListItemText>
                </MenuItem>,
                menuItem.kind === "file" && (
                  <MenuItem
                    key="download"
                    disabled={menuItem.data.status !== "ready" || !menuItem.data.google_file_id}
                    onClick={() => {
                      closeMenu();
                      download(menuItem.data);
                    }}
                  >
                    <ListItemIcon>
                      <DownloadOutlined fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Download</ListItemText>
                  </MenuItem>
                ),
                menuItem.kind === "file" && menuItem.data.status === "failed" && menuItem.data.source === "generated" && (
                  <MenuItem
                    key="retry"
                    onClick={() => {
                      closeMenu();
                      act(() => retryJob(menuItem.data as DriveFile));
                    }}
                  >
                    <ListItemIcon>
                      <ReplayRounded fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Coba lagi</ListItemText>
                  </MenuItem>
                ),
                <Divider key="d1" />,
                <MenuItem
                  key="rename"
                  onClick={() => {
                    closeMenu();
                    setRenaming(menuItem);
                  }}
                >
                  <ListItemIcon>
                    <DriveFileRenameOutlineOutlined fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Ganti nama</ListItemText>
                </MenuItem>,
                <MenuItem
                  key="move"
                  onClick={() => {
                    closeMenu();
                    setMoving(menuItem);
                  }}
                >
                  <ListItemIcon>
                    <DriveFileMoveOutlined fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Pindahkan ke</ListItemText>
                </MenuItem>,
                <MenuItem
                  key="star"
                  onClick={() => {
                    closeMenu();
                    act(() => updateItem(menuItem.kind, menuItem.data.id, { starred: !menuItem.data.starred }));
                  }}
                >
                  <ListItemIcon>
                    {menuItem.data.starred ? <StarRounded fontSize="small" /> : <StarBorderRounded fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText>{menuItem.data.starred ? "Hapus bintang" : "Bintangi"}</ListItemText>
                </MenuItem>,
                <Divider key="d2" />,
                <MenuItem
                  key="trash"
                  onClick={() => {
                    closeMenu();
                    act(() => trashItem(menuItem.kind, menuItem.data.id), `"${menuItem.data.name}" dipindahkan ke sampah`);
                  }}
                >
                  <ListItemIcon>
                    <DeleteOutlineRounded fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Hapus</ListItemText>
                </MenuItem>,
              ])}
      </Menu>

      {/* ── dialogs ── */}
      <NameDialog
        open={newFolderOpen}
        title="Folder baru"
        initial="Folder tanpa nama"
        submitLabel="Buat"
        onClose={() => setNewFolderOpen(false)}
        onSubmit={async (name) => {
          await act(() => createFolder(name, uploadTarget));
          if (view !== "drive") navigate({ folder: uploadTarget });
          setNewFolderOpen(false);
        }}
      />
      <NameDialog
        open={Boolean(renaming)}
        title="Ganti nama"
        initial={renaming?.data.name ?? ""}
        submitLabel="OK"
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (renaming && name !== renaming.data.name) {
            await act(() => renameItem(renaming.kind, renaming.data.id, name));
          }
          setRenaming(null);
        }}
      />
      <MoveDialog
        open={Boolean(moving)}
        itemName={moving?.data.name ?? ""}
        currentParent={moving ? (moving.kind === "folder" ? moving.data.parent_id : moving.data.folder_id) : null}
        folders={folders.filter((f) => !goneFolders.has(f.id))}
        blocked={moving?.kind === "folder" ? subtree(moving.data.id) : new Set()}
        onClose={() => setMoving(null)}
        onMove={async (target) => {
          if (moving) {
            const dest = target ? folderById.get(target)?.name : "Drive Saya";
            await act(() => moveItem(moving.kind, moving.data.id, target), `Dipindahkan ke ${dest}`);
          }
          setMoving(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(purging)}
        title="Hapus permanen?"
        body={
          <>
            <b>{purging?.data.name}</b>
            {purging?.kind === "folder" ? " beserta seluruh isinya" : ""} akan dihapus selamanya. Tindakan ini tidak
            bisa dibatalkan.
          </>
        }
        confirmLabel="Hapus permanen"
        onClose={() => setPurging(null)}
        onConfirm={async () => {
          const p = purging;
          if (p) {
            await act(() => deleteForever(p.kind, p.data.id), "Dihapus permanen");
          }
          setPurging(null);
        }}
      />
      <GenerateDialog
        open={generateOpen}
        destination={(t) => generateDestination(t)?.name ?? "Drive Saya"}
        onClose={() => setGenerateOpen(false)}
        onSubmit={async (docType, prompt) => {
          const dest = generateDestination(docType);
          try {
            const id = await createGenerateJob({ docType, prompt, folderId: dest?.id ?? null, userId });
            setGenerateOpen(false);
            toastSuccess("Permintaan dikirim. Dokumen sedang dibuat…");
            if (view !== "drive" || (dest?.id ?? null) !== currentFolderId) navigate({ folder: dest?.id ?? null });
            setSelectedId(id);
          } catch (e) {
            toastError((e as Error).message);
          }
          await refresh();
        }}
      />
      <PreviewDialog file={previewFile} onClose={() => setPreviewId(null)} onChanged={refresh} />
    </Box>
  );
}
