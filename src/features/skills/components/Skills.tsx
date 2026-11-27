"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ChatBubbleRounded from "@mui/icons-material/ChatBubbleRounded";
import { toastError } from "@/components/ui/Toast";
import { formatRelative } from "@/features/drive/format";
import { listSkills, updateSkill, type Skill } from "../api";
import { SkillEditor } from "./SkillEditor";

// /skills (docs/CHAT.md → "UI"): the skills the chat agent can use. Each one becomes a SKILL.md for the agent and
// "/name" in the chat's message box.

export function Skills({ initialSkills }: { initialSkills: Skill[] }) {
  const [skills, setSkills] = useState(initialSkills);
  const [editing, setEditing] = useState<Skill | "new" | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      setSkills(await listSkills());
      setNow(Date.now());
    } catch (e) {
      toastError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const toggle = async (s: Skill, enabled: boolean) => {
    setSkills((list) => list.map((x) => (x.id === s.id ? { ...x, enabled } : x)));
    try {
      await updateSkill(s.id, { enabled });
    } catch (e) {
      toastError((e as Error).message);
    }
    await refresh();
  };

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9", px: { xs: 1, md: 2 }, pt: 1, pb: { xs: 1, md: 2 } }}>
      <Box sx={{ maxWidth: 960, mx: "auto", bgcolor: "#fff", borderRadius: "16px", overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, gap: 2, px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2, flexWrap: "wrap" }}>
          <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
            <Typography component="h1" sx={{ fontSize: "1.5rem", color: "#1F1F1F" }}>
              Skills
            </Typography>
            <Typography sx={{ fontSize: "0.875rem", color: "#5F6368", mt: 0.25 }}>
              Instruksi yang dipakai AI di Chat. Ketik <b>/nama</b> di chat untuk memakainya langsung.
            </Typography>
          </Box>
          <Button variant="contained" disableElevation startIcon={<AddRounded />} onClick={() => setEditing("new")} sx={{ borderRadius: "9999px", flexShrink: 0 }}>
            Skill baru
          </Button>
        </Box>

        {skills.length === 0 ? (
          <Box sx={{ textAlign: "center", color: "#5F6368", px: 2, py: 8, borderTop: "1px solid #E0E3E7" }}>
            <AutoAwesomeRounded sx={{ fontSize: 40, color: "#C4C7C5", mb: 1 }} />
            <Typography sx={{ fontSize: "0.9375rem" }}>Belum ada skill.</Typography>
          </Box>
        ) : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
            {skills.map((s) => (
              <Box
                component="li"
                key={s.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: { xs: 1, sm: 2 },
                  borderTop: "1px solid #E0E3E7",
                  pr: { xs: 1, sm: 2 },
                  "&:hover": { bgcolor: "#F8FAFD" },
                }}
              >
                <Box
                  component="button"
                  type="button"
                  onClick={() => setEditing(s)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    pl: { xs: 2, sm: 3 },
                    pr: 0,
                    py: 1.75,
                    border: "none",
                    bgcolor: "transparent",
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "10px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: s.enabled ? "#EADDFF" : "#F1F3F4",
                      color: s.enabled ? "#6750A4" : "#9AA0A6",
                    }}
                  >
                    <AutoAwesomeRounded sx={{ fontSize: 20 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 500, color: s.enabled ? "#1F1F1F" : "#5F6368" }}>{s.title}</Typography>
                      <Typography sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.75rem", color: "#5F6368" }}>/{s.name}</Typography>
                      {!s.enabled && (
                        <Box component="span" sx={{ px: 0.75, borderRadius: "9999px", bgcolor: "#F1F3F4", color: "#5F6368", fontSize: "0.6875rem", fontWeight: 500 }}>
                          Nonaktif
                        </Box>
                      )}
                    </Box>
                    <Typography
                      sx={{
                        fontSize: "0.8125rem",
                        color: "#444746",
                        mt: 0.25,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {s.description}
                    </Typography>
                    <Typography suppressHydrationWarning sx={{ fontSize: "0.75rem", color: "#9AA0A6", mt: 0.5 }}>
                      Diubah {formatRelative(s.updated_at, now)}
                    </Typography>
                  </Box>
                </Box>
                {s.enabled && (
                  <Tooltip title="Pakai di chat">
                    <IconButton component={Link} href={`/chat?skill=${encodeURIComponent(s.name)}`} aria-label={`Pakai ${s.title} di chat`} sx={{ color: "#444746", display: { xs: "none", sm: "inline-flex" } }}>
                      <ChatBubbleRounded sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={s.enabled ? "Nonaktifkan" : "Aktifkan"}>
                  <Switch checked={s.enabled} onChange={(e) => void toggle(s, e.target.checked)} slotProps={{ input: { "aria-label": `Aktifkan ${s.title}` } }} />
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <SkillEditor
        open={editing != null}
        skill={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => void refresh()}
      />
    </Box>
  );
}
