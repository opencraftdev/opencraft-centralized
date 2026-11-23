"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import type { SkillSummary } from "@/features/skills/api";
import { Composer, draftKey, splitSkill, type ComposerHandle } from "./Composer";
import { COLUMN } from "./Thread";

// An empty new chat (docs/CHAT.md → "UI"): a greeting, the composer, and the enabled skills as suggestion chips.

export const NEW_DRAFT = "new";

export function NewChat({
  skills,
  prefillSkill,
  onBack,
  onSend,
}: {
  skills: SkillSummary[];
  prefillSkill: string | null; // /chat?skill=<name>
  onBack?: () => void;
  onSend: (text: string) => Promise<boolean>;
}) {
  const composer = useRef<ComposerHandle>(null);

  // ?skill=<name>: the composer starts with "/name " (the draft's own text is kept)
  useEffect(() => {
    if (!prefillSkill) return;
    let draft = "";
    try {
      draft = window.localStorage.getItem(draftKey(NEW_DRAFT)) ?? "";
    } catch {}
    const rest = splitSkill(draft, skills).text;
    composer.current?.setValue(`/${prefillSkill} ${rest}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSkill]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {onBack && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 0.5, minHeight: 56, borderBottom: "1px solid #E0E3E7", flexShrink: 0 }}>
          <IconButton onClick={onBack} aria-label="Kembali ke daftar chat">
            <ArrowBackRounded />
          </IconButton>
          <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>Chat baru</Typography>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", px: { xs: 1.5, sm: 3 }, py: 3 }}>
        {/* margin auto centres the block vertically yet lets it scroll when the keyboard leaves little room */}
        <Box sx={{ my: "auto", width: "100%", maxWidth: COLUMN, mx: "auto" }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                mx: "auto",
                mb: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #8E5CF5, #0B57D0)",
                color: "#fff",
              }}
            >
              <AutoAwesomeRounded sx={{ fontSize: 24 }} />
            </Box>
            <Typography component="h1" sx={{ fontSize: { xs: "1.375rem", sm: "1.625rem" }, color: "#1F1F1F" }}>
              Mau dikerjakan apa hari ini?
            </Typography>
          </Box>
          <Composer
            ref={composer}
            draftId={NEW_DRAFT}
            skills={skills}
            placeholder="Tanya atau minta apa saja…"
            autoFocus
            onSend={onSend}
          />
          {skills.length > 0 && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center", mt: 2 }}>
              {skills.map((s) => (
                <Box
                  key={s.name}
                  component="button"
                  type="button"
                  title={s.description}
                  onClick={() => composer.current?.setValue(`/${s.name} `)}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    maxWidth: "100%",
                    height: 34,
                    px: 1.75,
                    borderRadius: "9999px",
                    border: "1px solid #C4C7C5",
                    bgcolor: "#fff",
                    color: "#444746",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#F0F4F9" },
                  }}
                >
                  <AutoAwesomeRounded sx={{ fontSize: 16, color: "#8E5CF5", flexShrink: 0 }} />
                  <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.title}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.6875rem", color: "#5F6368", textAlign: "center", mt: 2 }}>
            Enter untuk kirim · Shift+Enter untuk baris baru
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
