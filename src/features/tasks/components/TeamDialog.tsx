"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { saveMember, saveProject } from "../api";
import type { Member, Project, ProjectStatus } from "../types";
import { MemberAvatar } from "./bits";

// "Tim & proyek": add/edit the people tasks are assigned to, and the projects tasks are grouped in.

const MEMBER_COLORS = ["#1B2533", "#D9F2A6", "#A8C7FA", "#C4EEF2", "#FFD8E4", "#FFE8C2", "#E8DEF8", "#C4EED0"];
const PROJECT_COLORS = ["#C0453A", "#0B57D0", "#1B2533", "#146C2E", "#5B6B1F", "#0F5257", "#8E4B00", "#6750A4", "#80868B"];

export function TeamDialog({ open, members, projects, onClose, onChanged }: { open: boolean; members: Member[]; projects: Project[]; onClose: () => void; onChanged: () => void }) {
  const mobile = useMediaQuery("(max-width:700px)");
  const [tab, setTab] = useState<"members" | "projects">("members");
  const [editing, setEditing] = useState<string | null>(null); // id or "new"

  useEffect(() => {
    if (open) setEditing(null);
  }, [open, tab]);

  const tabBtn = (v: typeof tab, text: string) => (
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
        <Typography sx={{ fontSize: "1.25rem", flex: 1 }}>Tim & proyek</Typography>
        <IconButton onClick={onClose} aria-label="Tutup">
          <CloseRounded />
        </IconButton>
      </Box>
      <Box sx={{ display: "flex", gap: 1, px: 3, py: 1.5 }}>
        {tabBtn("members", "Anggota tim")}
        {tabBtn("projects", "Proyek")}
      </Box>
      <Box sx={{ px: 3, pb: 3, overflowY: "auto" }}>
        {tab === "members" ? (
          <>
            {members.map((m) =>
              editing === m.id ? (
                <MemberForm key={m.id} initial={m} onDone={(saved) => { setEditing(null); if (saved) onChanged(); }} />
              ) : (
                <Row key={m.id} onEdit={() => setEditing(m.id)} muted={!m.active}>
                  <MemberAvatar member={m} size={32} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500 }}>{m.name}{!m.active && " (nonaktif)"}</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>{m.role || "—"}</Typography>
                  </Box>
                </Row>
              ),
            )}
            {editing === "new" ? (
              <MemberForm initial={null} onDone={(saved) => { setEditing(null); if (saved) onChanged(); }} />
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
                <ProjectForm key={p.id} initial={p} onDone={(saved) => { setEditing(null); if (saved) onChanged(); }} />
              ) : (
                <Row key={p.id} onEdit={() => setEditing(p.id)} muted={p.status !== "active"}>
                  <Box sx={{ width: 32, height: 32, borderRadius: "8px", bgcolor: p.color, flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500 }}>{p.name}</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>{[p.label, PROJECT_STATUS[p.status]].filter(Boolean).join(" · ")}</Typography>
                  </Box>
                </Row>
              ),
            )}
            {editing === "new" ? (
              <ProjectForm initial={null} onDone={(saved) => { setEditing(null); if (saved) onChanged(); }} />
            ) : (
              <Button startIcon={<AddRounded />} onClick={() => setEditing("new")} sx={{ mt: 1, borderRadius: "9999px" }}>
                Tambah proyek
              </Button>
            )}
          </>
        )}
      </Box>
    </Dialog>
  );
}

const PROJECT_STATUS: Record<ProjectStatus, string> = { active: "Aktif", parked: "Diparkir", done: "Selesai" };

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

function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      {colors.map((c) => (
        <Box
          key={c}
          component="button"
          type="button"
          aria-label={`Warna ${c}`}
          onClick={() => onChange(c)}
          sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: c, border: "1px solid rgba(0,0,0,.12)", cursor: "pointer", boxShadow: value === c ? "0 0 0 2px #fff, 0 0 0 4px #0B57D0" : "none" }}
        />
      ))}
    </Box>
  );
}

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: "0.875rem" } } as const;

function FormBox({ children, onCancel, onSave, saving }: { children: React.ReactNode; onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <Box sx={{ border: "1px solid #A8C7FA", borderRadius: "14px", p: 2, my: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
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

function MemberForm({ initial, onDone }: { initial: Member | null; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    initials: initial?.initials ?? "",
    role: initial?.role ?? "",
    goal: initial?.goal ?? "",
    color: initial?.color ?? MEMBER_COLORS[2],
    active: initial?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim()) return toastError("Nama wajib diisi.");
    setSaving(true);
    try {
      await saveMember({
        id: initial?.id,
        name: f.name.trim(),
        initials: (f.initials.trim() || f.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("")).slice(0, 2).toUpperCase(),
        role: f.role.trim(),
        goal: f.goal.trim(),
        color: f.color,
        active: f.active,
      });
      toastSuccess("Anggota disimpan.");
      onDone(true);
    } catch (e) {
      const msg = (e as Error).message;
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };
  return (
    <FormBox onCancel={() => onDone(false)} onSave={() => void save()} saving={saving}>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField size="small" label="Nama" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} sx={{ ...fieldSx, flex: 1 }} autoFocus />
        <TextField size="small" label="Inisial" value={f.initials} onChange={(e) => setF({ ...f, initials: e.target.value })} sx={{ ...fieldSx, width: 90 }} slotProps={{ htmlInput: { maxLength: 2 } }} />
      </Box>
      <TextField size="small" label="Peran" placeholder="mis. Desain · Branding" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} sx={fieldSx} />
      <TextField size="small" label="Target hasil (opsional)" placeholder="mis. Landing page online" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} sx={fieldSx} />
      <Swatches colors={MEMBER_COLORS} value={f.color} onChange={(color) => setF({ ...f, color })} />
      {initial && (
        <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.875rem" }}>
          <Switch size="small" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Aktif (muncul di pilihan PIC)
        </Box>
      )}
    </FormBox>
  );
}

function ProjectForm({ initial, onDone }: { initial: Project | null; onDone: (saved: boolean) => void }) {
  const [f, setF] = useState({ name: initial?.name ?? "", label: initial?.label ?? "", color: initial?.color ?? PROJECT_COLORS[1], status: initial?.status ?? ("active" as ProjectStatus) });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!f.name.trim()) return toastError("Nama proyek wajib diisi.");
    setSaving(true);
    try {
      await saveProject({ id: initial?.id, name: f.name.trim(), label: f.label.trim(), color: f.color, status: f.status });
      toastSuccess("Proyek disimpan.");
      onDone(true);
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <FormBox onCancel={() => onDone(false)} onSave={() => void save()} saving={saving}>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField size="small" label="Nama proyek" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} sx={{ ...fieldSx, flex: 1 }} autoFocus />
        <TextField size="small" label="Label" placeholder="V1" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} sx={{ ...fieldSx, width: 130 }} />
      </Box>
      <Select size="small" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectStatus })} sx={{ borderRadius: "10px", fontSize: "0.875rem" }}>
        <MenuItem value="active">Aktif</MenuItem>
        <MenuItem value="parked">Diparkir (disembunyikan dari pilihan)</MenuItem>
        <MenuItem value="done">Selesai</MenuItem>
      </Select>
      <Swatches colors={PROJECT_COLORS} value={f.color} onChange={(color) => setF({ ...f, color })} />
    </FormBox>
  );
}
