"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import ColorizeRounded from "@mui/icons-material/ColorizeRounded";
import UploadRounded from "@mui/icons-material/UploadRounded";
import WarningRounded from "@mui/icons-material/WarningRounded";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { AutoHeight } from "@/components/ui/AutoHeight";
import { driveContentUrl } from "@/lib/drive/links";
import { saveMember, saveProject } from "../api";
import { imageSize, uploadImage } from "../attachments";
import type { Member, Project, ProjectStatus } from "../types";
import { MemberAvatar, ProjectMark } from "./bits";

// "Tim & project": add/edit the people tasks are assigned to (with an optional photo), and the projects tasks are
// grouped in (colour, Apple emoji or custom logo).

const MEMBER_COLORS = ["#1B2533", "#D9F2A6", "#A8C7FA", "#C4EEF2", "#FFD8E4", "#FFE8C2", "#E8DEF8", "#C4EED0"];
export const PROJECT_COLORS = ["#C0453A", "#0B57D0", "#1B2533", "#146C2E", "#5B6B1F", "#0F5257", "#8E4B00", "#6750A4", "#80868B"];
const EMOJIS = ["📦", "🔑", "🧸", "🐨", "🎀", "👜", "🛍️", "🏷️", "🖨️", "🧩", "💡", "🔌", "📡", "🤖", "💻", "📱", "⌚", "🎧", "🛠️", "⚙️", "🧪", "🚀", "🎯", "📈", "💰", "🧾", "🏪", "🛒", "📣", "🎨", "✏️", "📐", "📝", "📚", "🌱", "☕", "🎮", "⭐", "🔥", "💎"];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_IMAGE_MB = 5;

type Tab = "members" | "projects";

export function TeamDialog({
  open,
  initialTab = "members",
  members,
  projects,
  onClose,
  onChanged,
}: {
  open: boolean;
  initialTab?: Tab;
  members: Member[];
  projects: Project[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const mobile = useMediaQuery("(max-width:700px)");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editing, setEditing] = useState<string | null>(null); // id or "new"

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);
  useEffect(() => {
    setEditing(null);
  }, [open, tab]);

  const done = (saved: boolean) => {
    setEditing(null);
    if (saved) onChanged();
  };

  const tabBtn = (v: Tab, text: string) => (
    <Box
      component="button"
      type="button"
      onClick={() => setTab(v)}
      sx={{ border: "none", bgcolor: tab === v ? "#D3E3FD" : "transparent", color: tab === v ? "#0B57D0" : "#444746", fontWeight: tab === v ? 600 : 500, fontFamily: "inherit", fontSize: "0.875rem", px: 2, height: 34, borderRadius: "9999px", cursor: "pointer" }}
    >
      {text}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} fullScreen={mobile} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: mobile ? 0 : "20px" } } }}>
      <Box sx={{ display: "flex", alignItems: "center", px: 3, pt: 2 }}>
        <Typography sx={{ fontSize: "1.25rem", flex: 1 }}>Tim & project</Typography>
        <IconButton onClick={onClose} aria-label="Tutup">
          <CloseRounded />
        </IconButton>
      </Box>
      <Box sx={{ display: "flex", gap: 1, px: 3, py: 1.5 }}>
        {tabBtn("members", "Anggota tim")}
        {tabBtn("projects", "Project")}
      </Box>
      <Box sx={{ px: 3, pb: 3, overflowY: "auto" }}>
        <AutoHeight>
        {tab === "members" ? (
          <>
            {members.map((m) =>
              editing === m.id ? (
                <MemberForm key={m.id} initial={m} onDone={done} />
              ) : (
                <Row key={m.id} onEdit={() => setEditing(m.id)} muted={!m.active}>
                  <MemberAvatar member={m} size={36} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500 }}>
                      {m.name}
                      {!m.active && " (nonaktif)"}
                    </Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>{m.role || "—"}</Typography>
                  </Box>
                </Row>
              ),
            )}
            {editing === "new" ? (
              <MemberForm initial={null} onDone={done} />
            ) : (
              <Button startIcon={<AddRounded />} onClick={() => setEditing("new")} sx={{ mt: 1, borderRadius: "9999px" }}>
                Tambah anggota
              </Button>
            )}
          </>
        ) : (
          <>
            {projects.map((p) =>
              editing === p.id ? (
                <ProjectForm key={p.id} initial={p} onDone={done} />
              ) : (
                <Row key={p.id} onEdit={() => setEditing(p.id)} muted={p.status !== "active"}>
                  <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: `${p.color}1F`, display: "grid", placeItems: "center", flexShrink: 0, border: `1px solid ${p.color}33` }}>
                    {p.emoji || p.logo_file_id ? <ProjectMark project={p} size={20} /> : <Box sx={{ width: 14, height: 14, borderRadius: "4px", bgcolor: p.color }} />}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500 }}>{p.name}</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>{[p.label, PROJECT_STATUS[p.status]].filter(Boolean).join(" · ")}</Typography>
                  </Box>
                </Row>
              ),
            )}
            {editing === "new" ? (
              <ProjectForm initial={null} onDone={done} />
            ) : (
              <Button startIcon={<AddRounded />} onClick={() => setEditing("new")} sx={{ mt: 1, borderRadius: "9999px" }}>
                Tambah project
              </Button>
            )}
          </>
        )}
        </AutoHeight>
      </Box>
    </Dialog>
  );
}

const PROJECT_STATUS: Record<ProjectStatus, string> = { active: "Aktif", parked: "On Hold", done: "Selesai" };

function Row({ children, onEdit, muted }: { children: React.ReactNode; onEdit: () => void; muted?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, borderBottom: "1px solid #EEF1F4", opacity: muted ? 0.6 : 1 }}>
      {children}
      <Box sx={{ flex: 1 }} />
      <Button size="small" onClick={onEdit} sx={{ borderRadius: "9999px" }}>
        Ubah
      </Button>
    </Box>
  );
}

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: "0.875rem" } } as const;
const label = (text: string) => <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#5F6368", mb: 0.75 }}>{text}</Typography>;

/** Preset swatches + a custom colour (native picker behind a swatch) + hex field. */
function ColorPicker({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const custom = !colors.some((c) => c.toLowerCase() === value.toLowerCase());
  const ring = (on: boolean) => (on ? "0 0 0 2px #fff, 0 0 0 4px #0B57D0" : "none");
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
      {colors.map((c) => (
        <Box
          key={c}
          component="button"
          type="button"
          aria-label={`Warna ${c}`}
          aria-pressed={value.toLowerCase() === c.toLowerCase()}
          onClick={() => onChange(c)}
          sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: c, border: "1px solid rgba(0,0,0,.12)", cursor: "pointer", boxShadow: ring(value.toLowerCase() === c.toLowerCase()), transition: "box-shadow 150ms" }}
        />
      ))}
      {/* Custom colour: the native picker sits invisibly on top of a swatch */}
      <Box
        component="label"
        title="Pilih warna lain"
        sx={{ position: "relative", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: ring(custom), background: custom ? value : "conic-gradient(#C0453A,#E37400,#F9AB00,#146C2E,#0F5257,#0B57D0,#6750A4,#C0453A)", border: "1px solid rgba(0,0,0,.12)" }}
      >
        <ColorizeRounded sx={{ fontSize: 14, color: "#fff", filter: "drop-shadow(0 0 1px rgba(0,0,0,.6))" }} />
        <input type="color" value={HEX_RE.test(value) ? value : "#0b57d0"} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label="Pilih warna lain" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, height: 32, pl: 0.75, pr: 1, ml: 0.5, border: "1px solid #C4C7C5", borderRadius: "9999px", width: 116 }}>
        <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: HEX_RE.test(hex) ? hex : "transparent", border: "1px solid rgba(0,0,0,.12)", flexShrink: 0 }} />
        <InputBase
          value={hex}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setHex(v.slice(0, 7));
            if (HEX_RE.test(v)) onChange(v.toUpperCase());
          }}
          onBlur={() => setHex(value)}
          inputProps={{ "aria-label": "Kode warna hex", spellCheck: false }}
          sx={{ fontSize: "0.8125rem", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", flex: 1 }}
        />
      </Box>
    </Box>
  );
}

/** Upload an image right away; reports warnings (size/shape) without blocking. */
function ImageUpload({
  value,
  onChange,
  meta,
  recommended,
  shape,
  buttonText,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  meta: Record<string, unknown>;
  recommended: number;
  shape: "circle" | "rounded";
  buttonText: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const pick = async (file: File) => {
    setWarning(null);
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return toastError("Pakai gambar PNG, JPG, WebP, atau SVG.");
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return toastError(`Ukuran gambar maksimal ${MAX_IMAGE_MB} MB.`);
    const dim = await imageSize(file);
    const warn: string[] = [];
    if (dim && dim.w !== dim.h) warn.push(`Gambar tidak persegi (${dim.w}×${dim.h} px), sebagian akan terpotong.`);
    if (dim && Math.min(dim.w, dim.h) < recommended) warn.push(`Lebih kecil dari ${recommended}×${recommended} px, bisa terlihat buram.`);
    setBusy(true);
    try {
      onChange(await uploadImage(file, meta));
      if (warn.length) setWarning(`${warn.join(" ")} Disarankan ${recommended}×${recommended} px.`);
    } catch (e) {
      toastError(`Upload gagal: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: shape === "circle" ? "50%" : "12px",
            border: "1px dashed #C4C7C5",
            bgcolor: "#F0F4F9",
            backgroundImage: value ? `url("${driveContentUrl(value)}")` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <Box>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button size="small" variant="outlined" startIcon={<UploadRounded />} disabled={busy} onClick={() => input.current?.click()} sx={{ borderRadius: "9999px", borderColor: "#C4C7C5", color: "#444746" }}>
              {busy ? "Mengunggah…" : value ? "Ganti" : buttonText}
            </Button>
            {value && !busy && (
              <Button size="small" onClick={() => { onChange(null); setWarning(null); }} sx={{ borderRadius: "9999px", color: "#B3261E" }}>
                Hapus
              </Button>
            )}
          </Box>
          <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368", mt: 0.5 }}>
            PNG, JPG, WebP atau SVG, persegi {recommended}×{recommended} px, maks {MAX_IMAGE_MB} MB.
          </Typography>
        </Box>
      </Box>
      {warning && (
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start", mt: 1, px: 1.25, py: 0.75, borderRadius: "10px", bgcolor: "#FFF0D6", color: "#8E4B00", fontSize: "0.75rem" }}>
          <WarningRounded sx={{ fontSize: 16, mt: "1px" }} />
          {warning}
        </Box>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f);
        }}
      />
    </Box>
  );
}

function FormBox({ children, onCancel, onSave, saving }: { children: React.ReactNode; onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <Box sx={{ border: "1px solid #A8C7FA", borderRadius: "14px", p: 2, my: 1, display: "flex", flexDirection: "column", gap: 2, animation: "oc-pop-in 220ms cubic-bezier(0.22, 1, 0.36, 1)" }}>
      {children}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button onClick={onCancel} sx={{ borderRadius: "9999px", color: "#444746" }}>
          Batal
        </Button>
        <Button variant="contained" disableElevation disabled={saving} onClick={onSave} sx={{ borderRadius: "9999px" }}>
          Simpan
        </Button>
      </Box>
    </Box>
  );
}

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function MemberForm({ initial, onDone }: { initial: Member | null; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    initials: initial?.initials ?? "",
    role: initial?.role ?? "",
    goal: initial?.goal ?? "",
    color: initial?.color ?? MEMBER_COLORS[2],
    active: initial?.active ?? true,
    photo: initial?.photo_file_id ?? null,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim()) return toastError("Nama wajib diisi.");
    setSaving(true);
    try {
      const photoChanged = (initial?.photo_file_id ?? null) !== f.photo;
      await saveMember({
        id: initial?.id,
        name: f.name.trim(),
        initials: (f.initials.trim() || initialsOf(f.name)).slice(0, 2).toUpperCase(),
        role: f.role.trim(),
        goal: f.goal.trim(),
        color: f.color,
        active: f.active,
        ...(photoChanged ? { photo_file_id: f.photo } : {}),
      });
      toastSuccess("Anggota disimpan.");
      onDone(true);
    } catch (e) {
      toastError(friendly((e as Error).message));
    } finally {
      setSaving(false);
    }
  };
  return (
    <FormBox onCancel={() => onDone(false)} onSave={() => void save()} saving={saving}>
      <Box>
        {label("Foto profil")}
        <ImageUpload value={f.photo} onChange={(photo) => setF({ ...f, photo })} meta={{ kind: "member_photo", member_id: initial?.id ?? null }} recommended={400} shape="circle" buttonText="Upload foto" />
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField size="small" label="Nama" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} sx={{ ...fieldSx, flex: 1 }} autoFocus={!initial} />
        <TextField size="small" label="Inisial" value={f.initials} onChange={(e) => setF({ ...f, initials: e.target.value })} sx={{ ...fieldSx, width: 90 }} slotProps={{ htmlInput: { maxLength: 2 } }} />
      </Box>
      <TextField size="small" label="Peran" placeholder="mis. Desain · Branding" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} sx={fieldSx} />
      <TextField size="small" label="Target hasil (opsional)" placeholder="mis. Landing page online" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} sx={fieldSx} />
      {initial && (
        <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.875rem" }}>
          <Switch size="small" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Aktif (muncul di pilihan PIC)
        </Box>
      )}
    </FormBox>
  );
}

function ProjectForm({ initial, onDone }: { initial: Project | null; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    label: initial?.label ?? "",
    color: initial?.color ?? PROJECT_COLORS[1],
    status: initial?.status ?? ("active" as ProjectStatus),
    emoji: initial?.emoji ?? "",
    logo: initial?.logo_file_id ?? null,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim()) return toastError("Nama project wajib diisi.");
    setSaving(true);
    try {
      const iconChanged = (initial?.emoji ?? "") !== f.emoji || (initial?.logo_file_id ?? null) !== f.logo;
      await saveProject({
        id: initial?.id,
        name: f.name.trim(),
        label: f.label.trim(),
        color: f.color,
        status: f.status,
        ...(iconChanged ? { emoji: f.emoji, logo_file_id: f.logo } : {}),
      });
      toastSuccess("Project disimpan.");
      onDone(true);
    } catch (e) {
      toastError(friendly((e as Error).message));
    } finally {
      setSaving(false);
    }
  };
  const preview: Project = { id: initial?.id ?? "new", name: f.name || "Project", label: f.label, color: f.color, status: f.status, sort: 0, emoji: f.emoji, logo_file_id: f.logo };
  return (
    <FormBox onCancel={() => onDone(false)} onSave={() => void save()} saving={saving}>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField size="small" label="Nama project" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} sx={{ ...fieldSx, flex: 1 }} autoFocus={!initial} />
        <TextField size="small" label="Label" placeholder="V1" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} sx={{ ...fieldSx, width: 130 }} />
      </Box>

      <Box>
        {label("Ikon (emoji)")}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))", gap: 0.5, p: 1, border: "1px solid #E0E3E7", borderRadius: "12px", opacity: f.logo ? 0.45 : 1 }}>
          {EMOJIS.map((e) => (
            <Box
              key={e}
              component="button"
              type="button"
              aria-label={`Ikon ${e}`}
              aria-pressed={f.emoji === e}
              onClick={() => setF({ ...f, emoji: f.emoji === e ? "" : e })}
              sx={{ height: 36, border: "none", borderRadius: "10px", cursor: "pointer", fontSize: 20, fontFamily: EMOJI_FONT, bgcolor: f.emoji === e ? "#D3E3FD" : "transparent", boxShadow: f.emoji === e ? "inset 0 0 0 1.5px #0B57D0" : "none", transition: "transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 150ms", "&:hover": { bgcolor: f.emoji === e ? "#D3E3FD" : "#F0F4F9", transform: "scale(1.15)" } }}
            >
              {e}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <TextField
            size="small"
            label="Emoji lain"
            placeholder="Tempel emoji"
            value={EMOJIS.includes(f.emoji) ? "" : f.emoji}
            onChange={(e) => setF({ ...f, emoji: [...e.target.value.trim()].slice(0, 4).join("") })}
            sx={{ ...fieldSx, width: 150, "& input": { fontFamily: EMOJI_FONT } }}
          />
          {f.emoji && (
            <Button size="small" onClick={() => setF({ ...f, emoji: "" })} sx={{ borderRadius: "9999px", color: "#5F6368" }}>
              Tanpa emoji
            </Button>
          )}
        </Box>
        {f.logo && <Typography sx={{ fontSize: "0.6875rem", color: "#5F6368", mt: 0.5 }}>Logo dipakai lebih dulu daripada emoji.</Typography>}
      </Box>

      <Box>
        {label("Logo custom (opsional)")}
        <ImageUpload value={f.logo} onChange={(logo) => setF({ ...f, logo })} meta={{ kind: "project_logo", project_id: initial?.id ?? null }} recommended={500} shape="rounded" buttonText="Upload logo" />
      </Box>

      <Box>
        {label("Warna")}
        <ColorPicker colors={PROJECT_COLORS} value={f.color} onChange={(color) => setF({ ...f, color })} />
      </Box>

      <Box>
        {label("Status")}
        <Select size="small" fullWidth value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectStatus })} sx={{ borderRadius: "10px", fontSize: "0.875rem" }}>
          <MenuItem value="active">Aktif</MenuItem>
          <MenuItem value="parked">On Hold (disembunyikan dari pilihan)</MenuItem>
          <MenuItem value="done">Selesai</MenuItem>
        </Select>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.75rem", color: "#5F6368" }}>
        Pratinjau:
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, height: 22, px: 1, borderRadius: "9999px", bgcolor: `${f.color}1A`, color: f.color, fontWeight: 600 }}>
          <ProjectMark project={preview} size={13} />
          {preview.name}
        </Box>
      </Box>
    </FormBox>
  );
}

/** The icon/photo columns come with migration 027: say so instead of a raw Postgres error. */
function friendly(msg: string): string {
  if (/emoji|logo_file_id|photo_file_id/.test(msg) && /column|schema cache/i.test(msg))
    return "Database belum diperbarui untuk ikon/foto. Jalankan SQL 027_tasks_icons_photos di Supabase dulu.";
  return msg;
}
