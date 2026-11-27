"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import type { SkillSummary } from "@/features/skills/api";
import { Composer, draftKey, splitSkill, type ComposerHandle } from "./Composer";
import { ChatNavButtons } from "./ChatList";
import { COLUMN } from "./Thread";
import { ChatDemo } from "./ChatDemo";

// An empty new chat (docs/CHAT.md → "UI"): a greeting with a looping example conversation (ChatDemo) in the middle,
// and the composer at the bottom with the enabled skills as chips above it (click → the composer gets "/name ").

export const NEW_DRAFT = "new";

export function NewChat({
  skills,
  prefillSkill,
  onOpenList,
  onNew,
  historyOpen,
  onSend,
}: {
  skills: SkillSummary[];
  prefillSkill: string | null; // /chat?skill=<name>
  onOpenList: (anchor: HTMLElement) => void; // the "Riwayat chat" button: list as a popover (drawer on a phone)
  onNew: () => void;
  historyOpen?: boolean;
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
        <ChatNavButtons onHistory={onOpenList} onNew={onNew} historyOpen={historyOpen} />
      </Box>
      {/* Middle: greeting + a looping example conversation showing how to use the chat */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", px: { xs: 1.5, sm: 3 } }}>
        <Box sx={{ my: "auto", width: "100%", maxWidth: COLUMN, mx: "auto", py: 2 }}>
          <Typography
            component="h1"
            sx={{
              textAlign: "center",
              fontSize: { xs: "1.75rem", sm: "2.25rem" },
              fontWeight: 400,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              color: "#1F1F1F",
              mb: 1,
            }}
          >
            Mulai dari mana?
          </Typography>
          <Typography sx={{ textAlign: "center", fontSize: "0.875rem", color: "#5F6368", mb: { xs: 3, sm: 4 } }}>
            Tanya apa saja, atau ketik <b>/</b> untuk memakai skill. Contohnya seperti ini:
          </Typography>
          <ChatDemo skill={skills[0]?.name ?? null} />
        </Box>
      </Box>

      {/* Bottom: skill shortcuts + the composer, where it stays once the chat starts */}
      <Box sx={{ px: { xs: 1, sm: 3 }, pb: 1, pt: 0.5, flexShrink: 0 }}>
        <Box sx={{ maxWidth: COLUMN, mx: "auto" }}>
          {skills.length > 0 && (
            <Box component="ul" aria-label="Saran skill" sx={{ listStyle: "none", m: 0, mb: 1, p: 0, display: "flex", flexWrap: "wrap", gap: 1 }}>
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
                      gap: 0.75,
                      maxWidth: "100%",
                      height: 34,
                      px: 1.5,
                      border: "1px solid #E3E3E3",
                      borderRadius: "9999px",
                      bgcolor: "#fff",
                      color: "#1F1F1F",
                      fontFamily: "inherit",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "#F0F4F9" },
                      "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
                    }}
                  >
                    <AutoAwesomeRounded sx={{ fontSize: 16, color: "#444746", flexShrink: 0 }} />
                    <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.title}
                    </Box>
                  </Box>
                </li>
              ))}
            </Box>
          )}
          <Composer ref={composer} draftId={NEW_DRAFT} skills={skills} placeholder="Ketik / untuk skill dan lainnya" autoFocus onSend={onSend} />
          <Typography sx={{ textAlign: "center", fontSize: "0.75rem", color: "#444746", mt: 1, lineHeight: 1.5 }}>
            AI bisa membuat kesalahan, periksa kembali hasilnya.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
