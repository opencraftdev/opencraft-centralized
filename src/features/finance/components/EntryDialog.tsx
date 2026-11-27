"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/features/drive/components/DriveDialogs";
import { createEntry, deleteEntry, updateEntry } from "../api";
import { CATEGORIES, KIND_META, formatIDR, type EntryKind, type FinanceEntry } from "../types";

// Add / edit one row of the book: Tanggal · Keterangan · Kategori · Jumlah · Catatan (like the spreadsheet).
export function EntryDialog({
  entry,
  kind: initialKind,
  defaultDate,
  onClose,
  onSaved,
}: {
  entry: FinanceEntry | null; // null = new
  kind: EntryKind;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? initialKind);
  const [date, setDate] = useState(entry?.entry_date ?? defaultDate);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cats = CATEGORIES[kind];
  const categoryValue = category || "Lain-lain";
  const options = cats.includes(categoryValue) ? cats : [...cats, categoryValue];
  const amountNum = Number(amount.replace(/\D/g, "")) || 0;
  const valid = description.trim() && date && amountNum > 0;

  const save = async () => {
    setSaving(true);
    try {
      const input = { kind, entry_date: date, description: description.trim(), category: categoryValue, amount: amountNum, note: note.trim() };
      if (entry) await updateEntry(entry.id, input);
      else await createEntry(input);
      toastSuccess(entry ? "Tersimpan" : `${KIND_META[kind].label} ditambahkan`);
      onSaved();
      onClose();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: "28px" } } }}>
      <Box sx={{ display: "flex", alignItems: "center", pl: 3, pr: 1.5, pt: 2 }}>
        <Typography component="h2" sx={{ flex: 1, fontSize: "1.375rem", color: "#1F1F1F" }}>
          {entry ? "Edit catatan" : "Tambah catatan"}
        </Typography>
        <IconButton aria-label="Tutup" onClick={onClose} sx={{ color: "#444746" }}>
          <CloseRounded />
        </IconButton>
      </Box>

      <Box sx={{ px: 3, pt: 1.5, pb: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={kind}
          onChange={(_, v: EntryKind | null) => {
            if (!v) return;
            setKind(v);
            if (!CATEGORIES[v].includes(category)) setCategory("");
          }}
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", borderRadius: "9999px", fontSize: "0.875rem" } }}
        >
          {(["expense", "income"] as EntryKind[]).map((k) => (
            <ToggleButton
              key={k}
              value={k}
              sx={{ "&.Mui-selected, &.Mui-selected:hover": { bgcolor: KIND_META[k].bg, color: KIND_META[k].color } }}
            >
              {KIND_META[k].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <TextField
          label="Tanggal"
          type="date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Keterangan"
          size="small"
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={kind === "income" ? "mis. Pembayaran project website" : "mis. Langganan Canva"}
        />
        <TextField select label="Kategori" size="small" value={categoryValue} onChange={(e) => setCategory(e.target.value)}>
          {options.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Jumlah (Rp)"
          size="small"
          inputMode="numeric"
          value={amountNum ? amountNum.toLocaleString("id-ID") : amount.replace(/\D/g, "")}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          helperText={amountNum ? formatIDR(amountNum) : " "}
        />
        <TextField label="Catatan" size="small" multiline minRows={1} maxRows={4} value={note} onChange={(e) => setNote(e.target.value)} />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, pb: 2.5, pt: 1 }}>
        {entry && (
          <Button color="error" disabled={saving} onClick={() => setConfirmDelete(true)} sx={{ borderRadius: "9999px" }}>
            Hapus
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: "9999px" }}>
          Batal
        </Button>
        <Button variant="contained" disableElevation disabled={!valid || saving} onClick={() => void save()} sx={{ borderRadius: "9999px" }}>
          {saving ? <CircularProgress size={16} color="inherit" /> : entry ? "Simpan" : "Tambah"}
        </Button>
      </Box>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus catatan?"
        body={
          <>
            <b>{entry?.description}</b> ({entry ? formatIDR(entry.amount) : ""}) akan dihapus. Tindakan ini tidak bisa dibatalkan.
          </>
        }
        confirmLabel="Hapus"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!entry) return;
          try {
            await deleteEntry(entry.id);
            toastSuccess("Catatan dihapus");
            setConfirmDelete(false);
            onSaved();
            onClose();
          } catch (e) {
            toastError((e as Error).message);
          }
        }}
      />
    </Dialog>
  );
}
