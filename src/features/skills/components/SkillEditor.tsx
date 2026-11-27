"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseRounded from "@mui/icons-material/CloseRounded";
import InfoRounded from "@mui/icons-material/InfoRounded";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/features/drive/components/DriveDialogs";
import { ChatMarkdown } from "@/features/chat/components/Markdown";
import { createSkill, deleteSkill, SKILL_NAME_RE, updateSkill, type Skill } from "../api";

// Create / edit one skill (docs/CHAT.md → "UI" → /skills). The name is the folder name and "/name" in the chat, so it
// is fixed once the skill exists.

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const STARTER = `# Judul skill

Jelaskan langkah-langkah yang harus diikuti AI saat memakai skill ini.

1. …
2. …
`;

export function SkillEditor({
  open,
  skill,
  onClose,
  onSaved,
}: {
  open: boolean;
  skill: Skill | null; // null = new
  onClose: () => void;
  onSaved: () => void;
}) {
  const fullScreen = useMediaQuery("(max-width:599.95px)");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(skill?.name ?? "");
    setNameTouched(Boolean(skill));
    setTitle(skill?.title ?? "");
    setDescription(skill?.description ?? "");
    setBody(skill?.body ?? STARTER);
    setEnabled(skill?.enabled ?? true);
    setTab("write");
    setTried(false);
  }, [open, skill]);

  const isNew = !skill;
  const nameError = !name ? "Wajib diisi" : !SKILL_NAME_RE.test(name) ? "Huruf kecil, angka, dan tanda -; diawali huruf/angka" : null;
  const titleError = !title.trim() ? "Wajib diisi" : null;
  const descError = !description.trim() ? "Wajib diisi" : null;
  const invalid = Boolean((isNew && nameError) || titleError || descError);
  const dirty =
    !skill ||
    title !== skill.title ||
    description !== skill.description ||
    body !== skill.body ||
    enabled !== skill.enabled;

  const save = async () => {
    setTried(true);
    if (invalid || saving) return;
    setSaving(true);
    try {
      const fields = { title: title.trim(), description: description.trim().replace(/\s+/g, " "), body, enabled };
      if (isNew) await createSkill({ name, ...fields });
      else await updateSkill(skill.id, fields);
      toastSuccess(isNew ? "Skill dibuat" : "Skill disimpan");
      onSaved();
      onClose();
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (saving) return;
    if (dirty && !isNew && !window.confirm("Buang perubahan yang belum disimpan?")) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "16px", height: fullScreen ? "100%" : "min(860px, 92vh)" } } }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 1, sm: 3 }, pl: { xs: 2, sm: 3 }, minHeight: 64, borderBottom: "1px solid #E0E3E7", flexShrink: 0 }}>
          <Typography component="h2" sx={{ flex: 1, minWidth: 0, fontSize: "1.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {isNew ? "Skill baru" : skill.title}
          </Typography>
          <IconButton onClick={close} aria-label="Tutup">
            <CloseRounded />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, sm: 3 }, py: 2.5, display: "flex", flexDirection: "column", gap: 2.25 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField
              label="Judul"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (isNew && !nameTouched) setName(slugify(e.target.value));
              }}
              error={tried && Boolean(titleError)}
              helperText={(tried && titleError) || "Nama yang dibaca orang, mis. “Dokumen OpenCraft”"}
              autoFocus={isNew}
              fullWidth
            />
            <TextField
              label="Nama"
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
              disabled={!isNew}
              error={isNew && (tried || Boolean(name)) && Boolean(nameError)}
              helperText={
                isNew
                  ? (tried || name ? nameError : null) ?? `Dipakai di chat sebagai /${name || "nama-skill"} · tidak bisa diubah nanti`
                  : `Dipakai di chat sebagai /${name}`
              }
              slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: "none", style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } } }}
              fullWidth
            />
          </Box>
          <TextField
            label="Deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={tried && Boolean(descError)}
            helperText={(tried && descError) || "Satu kalimat: kapan AI memakai skill ini."}
            multiline
            minRows={2}
            maxRows={4}
            fullWidth
          />

          <Box sx={{ display: "flex", flexDirection: "column", minHeight: 320, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, borderBottom: "1px solid #E0E3E7" }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "#444746" }}>Instruksi</Typography>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontSize: "0.875rem" } }}>
                <Tab value="write" label="Tulis" />
                <Tab value="preview" label="Pratinjau" />
              </Tabs>
            </Box>
            {tab === "write" ? (
              <TextField
                value={body}
                onChange={(e) => setBody(e.target.value)}
                multiline
                minRows={12}
                fullWidth
                placeholder="Instruksi dalam Markdown…"
                slotProps={{
                  htmlInput: { "aria-label": "Instruksi (Markdown)", spellCheck: false },
                }}
                sx={{
                  mt: 1.5,
                  "& textarea": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.8125rem", lineHeight: 1.6 },
                }}
              />
            ) : (
              <Box sx={{ mt: 1.5, p: 2, border: "1px solid #E0E3E7", borderRadius: "8px", minHeight: 280 }}>
                {body.trim() ? <ChatMarkdown text={body} /> : <Typography sx={{ color: "#9AA0A6", fontSize: "0.875rem" }}>Belum ada instruksi.</Typography>}
              </Box>
            )}
          </Box>

          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={
              <Box>
                <Typography sx={{ fontSize: "0.9375rem" }}>Aktif</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>Skill nonaktif tidak dipakai AI dan tidak muncul di menu “/”.</Typography>
              </Box>
            }
            sx={{ alignItems: "flex-start", ml: 0, gap: 1, "& .MuiSwitch-root": { mt: -0.5 } }}
          />
          <Typography sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.75rem", color: "#5F6368" }}>
            <InfoRounded sx={{ fontSize: 16 }} />
            Perubahan sampai ke agen chat dalam ±30 detik.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2, sm: 3 }, py: 1.5, borderTop: "1px solid #E0E3E7", flexShrink: 0 }}>
          {!isNew && (
            <Button color="error" onClick={() => setConfirmDelete(true)} disabled={saving} sx={{ borderRadius: "9999px" }}>
              Hapus
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={close} disabled={saving} sx={{ borderRadius: "9999px", px: 2.5 }}>
            Batal
          </Button>
          <Button type="submit" variant="contained" disableElevation disabled={saving || !dirty} sx={{ borderRadius: "9999px", px: 2.5 }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : "Simpan"}
          </Button>
        </Box>
      </Box>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus skill?"
        body={
          <>
            <b>{skill?.title}</b> (/{skill?.name}) akan dihapus dan tidak bisa dipakai lagi di chat. Tindakan ini tidak bisa dibatalkan.
          </>
        }
        confirmLabel="Hapus"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!skill) return;
          try {
            await deleteSkill(skill.id);
            toastSuccess("Skill dihapus");
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
