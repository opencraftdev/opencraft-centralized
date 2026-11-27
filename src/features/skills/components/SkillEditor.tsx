"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
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

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const labelSx = { fontSize: "0.75rem", fontWeight: 500, color: "#444746" } as const;
const fieldSx = {
  "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: "0.875rem" },
  "& .MuiFormHelperText-root": { mx: 0.25, fontSize: "0.7188rem" },
} as const;

/** A label above its field (not floating), so long values never collide with it. */
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <Box>
      <Box component="label" htmlFor={htmlFor} sx={{ display: "block", mb: 0.75, ...labelSx }}>
        {label}
      </Box>
      {children}
    </Box>
  );
}

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
      slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "20px", height: fullScreen ? "100%" : "min(860px, 92vh)" } } }}
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1.5, pl: { xs: 2, sm: 3 }, pt: 1.5, pb: 1, flexShrink: 0 }}>
          <Typography component="h2" sx={{ flex: 1, minWidth: 0, fontSize: "1.125rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {isNew ? "Skill baru" : title.trim() || skill.title}
          </Typography>
          <IconButton onClick={close} aria-label="Tutup" sx={{ color: "#444746" }}>
            <CloseRounded />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 2, sm: 3 }, pt: 0.5, pb: 2, display: "flex", flexDirection: "column", gap: 1.75 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.75 }}>
            <Field label="Judul" htmlFor="skill-title">
              <TextField
                id="skill-title"
                size="small"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (isNew && !nameTouched) setName(slugify(e.target.value));
                }}
                error={tried && Boolean(titleError)}
                helperText={(tried && titleError) || "Nama yang dibaca orang."}
                autoFocus={isNew}
                fullWidth
                sx={fieldSx}
              />
            </Field>
            <Field label="Nama perintah" htmlFor="skill-name">
              <TextField
                id="skill-name"
                size="small"
                value={isNew ? name : `/${name}`}
                onChange={(e) => {
                  setNameTouched(true);
                  setName(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
                slotProps={{
                  input: { readOnly: !isNew },
                  htmlInput: { spellCheck: false, autoCapitalize: "none", style: { fontFamily: MONO, fontSize: "0.8125rem" } },
                }}
                error={isNew && (tried || Boolean(name)) && Boolean(nameError)}
                helperText={
                  isNew
                    ? (tried || name ? nameError : null) ?? `Dipanggil di chat dengan /${name || "nama-skill"} · tidak bisa diubah nanti`
                    : `Dipanggil di chat dengan /${name}`
                }
                fullWidth
                sx={{ ...fieldSx, ...(isNew ? {} : { "& .MuiOutlinedInput-root": { ...fieldSx["& .MuiOutlinedInput-root"], bgcolor: "#F8FAFD", color: "#5F6368" } }) }}
              />
            </Field>
          </Box>
          <Field label="Deskripsi" htmlFor="skill-desc">
            <TextField
              id="skill-desc"
              size="small"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={tried && Boolean(descError)}
              helperText={(tried && descError) || "Satu kalimat: kapan AI memakai skill ini."}
              multiline
              minRows={1}
              maxRows={5}
              fullWidth
              sx={fieldSx}
            />
          </Field>

          <Box sx={{ display: "flex", flexDirection: "column", minHeight: 300, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.75 }}>
              <Typography component="span" sx={labelSx}>
                Instruksi
              </Typography>
              <Box role="tablist" aria-label="Mode instruksi" sx={{ display: "inline-flex", bgcolor: "#F0F4F9", borderRadius: "9999px", p: "3px" }}>
                {(["write", "preview"] as const).map((v) => (
                  <Box
                    key={v}
                    component="button"
                    type="button"
                    role="tab"
                    aria-selected={tab === v}
                    onClick={() => setTab(v)}
                    sx={{
                      border: "none",
                      fontFamily: "inherit",
                      fontSize: "0.8125rem",
                      px: 1.75,
                      py: 0.5,
                      borderRadius: "9999px",
                      cursor: "pointer",
                      bgcolor: tab === v ? "#fff" : "transparent",
                      color: tab === v ? "#0B57D0" : "#444746",
                      fontWeight: tab === v ? 500 : 400,
                      boxShadow: tab === v ? "0 1px 2px rgba(60,64,67,.2)" : "none",
                      transition: "background-color 200ms, color 200ms, box-shadow 200ms",
                      "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: 1 },
                    }}
                  >
                    {v === "write" ? "Tulis" : "Pratinjau"}
                  </Box>
                ))}
              </Box>
            </Box>
            {tab === "write" ? (
              <Box
                component="textarea"
                value={body}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                placeholder="Instruksi dalam Markdown…"
                aria-label="Instruksi (Markdown)"
                spellCheck={false}
                sx={{
                  flex: 1,
                  minHeight: 260,
                  width: "100%",
                  resize: "none",
                  border: "1px solid #E3E3E3",
                  borderRadius: "12px",
                  bgcolor: "#F8FAFD",
                  color: "#1F1F1F",
                  fontFamily: MONO,
                  fontSize: "0.8125rem",
                  lineHeight: 1.7,
                  px: 2,
                  py: 1.5,
                  outline: "none",
                  transition: "border-color 150ms, background-color 150ms",
                  "&:focus": { borderColor: "#0B57D0", bgcolor: "#fff" },
                }}
              />
            ) : (
              <Box sx={{ flex: 1, minHeight: 260, px: 2, py: 1.5, border: "1px solid #E3E3E3", borderRadius: "12px", overflowY: "auto", fontSize: "0.875rem" }}>
                {body.trim() ? <ChatMarkdown text={body} /> : <Typography sx={{ color: "#9AA0A6", fontSize: "0.875rem" }}>Belum ada instruksi.</Typography>}
              </Box>
            )}
          </Box>

          <Typography sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.75rem", color: "#5F6368" }}>
            <InfoRounded sx={{ fontSize: 15 }} />
            Perubahan sampai ke agen chat dalam ±30 detik.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2, sm: 3 }, py: 1.5, borderTop: "1px solid #EEF1F4", flexShrink: 0 }}>
          <Tooltip title="Skill nonaktif tidak dipakai AI dan tidak muncul di menu “/”.">
            <FormControlLabel
              control={<Switch size="small" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
              label="Aktif"
              sx={{ ml: 0, mr: 0.5, gap: 0.75, "& .MuiFormControlLabel-label": { fontSize: "0.875rem" } }}
            />
          </Tooltip>
          {!isNew && (
            <Button color="error" onClick={() => setConfirmDelete(true)} disabled={saving} sx={{ borderRadius: "9999px", textTransform: "none", fontSize: "0.875rem" }}>
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
