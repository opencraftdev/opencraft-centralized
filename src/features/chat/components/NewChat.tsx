"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import type { SkillSummary } from "@/features/skills/api";
import { Composer, draftKey, splitSkill, type ComposerHandle } from "./Composer";
import { SidebarIcon } from "./ChatList";
import { COLUMN } from "./Thread";

// An empty new chat (docs/CHAT.md → "UI"), like Gemini's start screen: a big centred greeting, the composer, and
// the enabled skills as suggestion rows under it (click → the composer gets "/name ").

export const NEW_DRAFT = "new";

export function NewChat({
  skills,
  prefillSkill,
  onOpenList,
  onSend,
}: {
  skills: SkillSummary[];
  prefillSkill: string | null; // /chat?skill=<name>
  onOpenList?: () => void; // the chat list is hidden (drawer on a phone, collapsed on desktop)
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, minHeight: 56, flexShrink: 0 }}>
        {onOpenList && (
          <Tooltip title="Daftar chat">
            <IconButton onClick={onOpenList} aria-label="Buka daftar chat" sx={{ color: "#444746" }}>
              <SidebarIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", px: { xs: 1.5, sm: 3 }, pb: 3 }}>
        {/* margin auto centres the block vertically yet lets it scroll when the keyboard leaves little room */}
        <Box sx={{ my: "auto", width: "100%", maxWidth: COLUMN, mx: "auto", pb: { xs: 2, sm: 8 } }}>
          <Typography
            component="h1"
            sx={{
              textAlign: "center",
              fontSize: { xs: "1.75rem", sm: "2.25rem" },
              fontWeight: 400,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              color: "#1F1F1F",
              mb: { xs: 3, sm: 4 },
            }}
          >
            Mulai dari mana?
          </Typography>
          <Composer
            ref={composer}
            draftId={NEW_DRAFT}
            skills={skills}
            placeholder="Ketik / untuk skill dan lainnya"
            autoFocus
            menuBelow
            onSend={onSend}
          />
          {skills.length > 0 && (
            <Box component="ul" aria-label="Saran skill" sx={{ listStyle: "none", m: 0, mt: 2.5, px: { xs: 0, sm: 2.5 }, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {skills.map((s) => (
                <li key={s.name}>
                  <Box
                    component="button"
                    type="button"
                    title={s.description}
                    onClick={() => composer.current?.setValue(`/${s.name} `)}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1.5,
                      maxWidth: "100%",
                      height: 44,
                      px: 1.5,
                      border: "none",
                      borderRadius: "9999px",
                      bgcolor: "transparent",
                      color: "#1F1F1F",
                      fontFamily: "inherit",
                      fontSize: "1rem",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "#F0F4F9" },
                      "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
                    }}
                  >
                    <AutoAwesomeOutlined sx={{ fontSize: 20, color: "#444746", flexShrink: 0 }} />
                    <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.title}
                    </Box>
                  </Box>
                </li>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
