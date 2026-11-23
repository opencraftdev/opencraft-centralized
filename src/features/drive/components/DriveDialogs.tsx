"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import FolderRounded from "@mui/icons-material/FolderRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import type { DriveDocType, DriveFolder } from "@/lib/drive/types";

const pill = { borderRadius: "9999px", px: 2.5 } as const;

function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

// ── Name (new folder / rename) ──────────────────────────────
export function NameDialog({
  open,
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const { busy, run } = useBusy();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initial);
    // Select the name without its extension, like Drive.
    const t = setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const dot = initial.lastIndexOf(".");
      el.setSelectionRange(0, dot > 0 ? dot : initial.length);
    }, 50);
    return () => clearTimeout(t);
  }, [open, initial]);

  const submit = () => {
    const name = value.trim();
    if (!name || busy) return;
    run(() => onSubmit(name));
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "1.375rem", fontWeight: 400, pb: 1 }}>{title}</DialogTitle>
      <DialogContent>
        <TextField
          inputRef={inputRef}
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} sx={pill}>
          Batal
        </Button>
        <Button onClick={submit} disabled={busy || !value.trim()} sx={pill}>
          {busy ? <CircularProgress size={16} /> : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Confirm ─────────────────────────────────────────────────
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { busy, run } = useBusy();
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "1.375rem", fontWeight: 400 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: "0.875rem", color: "#444746" }}>{body}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} sx={pill}>
          Batal
        </Button>
        <Button onClick={() => run(onConfirm)} disabled={busy} color="error" sx={pill}>
          {busy ? <CircularProgress size={16} color="inherit" /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Move (folder picker) ────────────────────────────────────
export function MoveDialog({
  open,
  itemName,
  currentParent,
  folders,
  blocked,
  onClose,
  onMove,
}: {
  open: boolean;
  itemName: string;
  currentParent: string | null;
  folders: DriveFolder[]; // non-trashed
  blocked: Set<string>; // the moved folder + its descendants
  onClose: () => void;
  onMove: (folderId: string | null) => Promise<void>;
}) {
  const [cursor, setCursor] = useState<string | null>(currentParent);
  const { busy, run } = useBusy();
  useEffect(() => {
    if (open) setCursor(currentParent);
  }, [open, currentParent]);

  const byId = new Map(folders.map((f) => [f.id, f]));
  const here = cursor ? byId.get(cursor) : null;
  const children = folders
    .filter((f) => f.parent_id === cursor)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "1.375rem", fontWeight: 400, pb: 0.5 }}>
        Pindahkan &ldquo;{itemName}&rdquo;
      </DialogTitle>
      <DialogContent sx={{ px: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, height: 44 }}>
          {cursor && (
            <IconButton size="small" onClick={() => setCursor(here?.parent_id ?? null)} aria-label="Kembali">
              <ArrowBackRounded fontSize="small" />
            </IconButton>
          )}
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500 }}>{here?.name ?? "Drive Saya"}</Typography>
        </Box>
        <Box sx={{ minHeight: 220, maxHeight: 320, overflowY: "auto" }}>
          {children.length === 0 && (
            <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", px: 2, py: 3 }}>Tidak ada subfolder.</Typography>
          )}
          {children.map((f) => {
            const disabled = blocked.has(f.id);
            return (
              <Box
                key={f.id}
                onClick={() => !disabled && setCursor(f.id)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 2,
                  height: 44,
                  borderRadius: "9999px",
                  cursor: disabled ? "default" : "pointer",
                  opacity: disabled ? 0.4 : 1,
                  "&:hover": disabled ? undefined : { bgcolor: "#F0F4F9" },
                }}
              >
                <FolderRounded sx={{ fontSize: 20, color: "#444746" }} />
                <Typography sx={{ flex: 1, fontSize: "0.875rem" }}>{f.name}</Typography>
                {!disabled && <ChevronRightRounded sx={{ fontSize: 20, color: "#5F6368" }} />}
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} sx={pill}>
          Batal
        </Button>
        <Button
          variant="contained"
          disabled={busy || cursor === currentParent}
          onClick={() => run(() => onMove(cursor))}
          sx={pill}
        >
          {busy ? <CircularProgress size={16} color="inherit" /> : "Pindahkan ke sini"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Generate ────────────────────────────────────────────────
const TYPES: { key: DriveDocType; label: string; hint: string }[] = [
  { key: "sph", label: "SPH", hint: "Surat penawaran harga" },
  { key: "mou", label: "MoU", hint: "Nota kesepahaman" },
  { key: "deck", label: "Deck", hint: "Presentasi" },
  { key: "other", label: "Lainnya", hint: "Dokumen lain" },
];

export function GenerateDialog({
  open,
  destination,
  onClose,
  onSubmit,
}: {
  open: boolean;
  destination: (t: DriveDocType) => string;
  onClose: () => void;
  onSubmit: (docType: DriveDocType, prompt: string) => Promise<void>;
}) {
  const [docType, setDocType] = useState<DriveDocType>("sph");
  const [prompt, setPrompt] = useState("");
  const { busy, run } = useBusy();
  useEffect(() => {
    if (open) setPrompt("");
  }, [open]);

  const submit = () => {
    if (!prompt.trim() || busy) return;
    run(() => onSubmit(docType, prompt));
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: "1.375rem", fontWeight: 400, pb: 0.5 }}>Generate dokumen</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: "0.8125rem", color: "#5F6368", mb: 2 }}>
          Ceritakan dokumen yang dibutuhkan. Agen akan membuatnya di server dan menaruh hasilnya di folder{" "}
          <b>{destination(docType)}</b>.
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          {TYPES.map((t) => {
            const active = t.key === docType;
            return (
              <Box
                key={t.key}
                component="button"
                type="button"
                title={t.hint}
                onClick={() => setDocType(t.key)}
                sx={{
                  height: 32,
                  px: 2,
                  borderRadius: "8px",
                  border: active ? "1px solid #C2E7FF" : "1px solid #747775",
                  bgcolor: active ? "#C2E7FF" : "transparent",
                  color: active ? "#001D35" : "#444746",
                  fontFamily: "inherit",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </Box>
            );
          })}
        </Box>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={5}
          maxRows={14}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
          placeholder="Buatkan SPH untuk PT Maju Jaya, paket chatbot customer service, kontak Bapak Andi"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy} sx={pill}>
          Batal
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy || !prompt.trim()} sx={pill}>
          {busy ? <CircularProgress size={16} color="inherit" /> : "Generate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
