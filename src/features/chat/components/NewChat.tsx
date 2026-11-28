"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import type { SkillSummary } from "@/features/skills/api";
import { Composer, draftKey, splitSkill, type ComposerHandle } from "./Composer";
import { ChatNavButtons } from "./ChatList";
import { ChatTimButton } from "@/features/team-chat/TeamChat";
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
  onSend,
}: {
  skills: SkillSummary[];
  prefillSkill: string | null; // /chat?skill=<name>
  onOpenList?: () => void; // the list is hidden (collapsed panel, or a phone's drawer): show History/+ buttons
  onNew: () => void;
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
    <Box sx={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {onOpenList && <ChatNavButtons onHistory={onOpenList} onNew={onNew} />}
      <Box sx={{ display: { xs: onOpenList ? "flex" : "none", sm: "none" }, alignItems: "center", px: 1, minHeight: 56, flexShrink: 0 }}>
        {onOpenList && <ChatNavButtons inline onHistory={onOpenList} onNew={onNew} />}
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
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {skills.length > 0 && (
                <Box component="ul" aria-label="Saran skill" sx={{ listStyle: "none", m: 0, mb: 0.75, p: 0, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, max-content))", gap: 0.5 }}>
                  {skills.map((s) => (
                    <Box component="li" key={s.name} sx={{ minWidth: 0, display: "flex" }}>
                      <Box
                        component="button"
                        type="button"
                        title={s.description}
                        onClick={() => composer.current?.setValue(`/${s.name} `)}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          maxWidth: "100%",
                          height: 22,
                          px: 1,
                          border: "1px solid #E3E3E3",
                          borderRadius: "9999px",
                          bgcolor: "#fff",
                          color: "#1F1F1F",
                          fontFamily: "inherit",
                          fontSize: "0.6875rem",
                          cursor: "pointer",
                          "&:hover": { bgcolor: "#F0F4F9" },
                          "&:focus-visible": { outline: "2px solid #0B57D0", outlineOffset: -2 },
                        }}
                      >
                        <AutoAwesomeRounded sx={{ fontSize: 11, color: "#444746", flexShrink: 0 }} />
                        <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.title}
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              <Composer ref={composer} draftId={NEW_DRAFT} skills={skills} placeholder="Ketik / untuk skill dan lainnya" autoFocus onSend={onSend} />
            </Box>
            <ChatTimButton inline />
          </Box>
          <Typography sx={{ textAlign: "center", fontSize: "0.75rem", color: "#444746", mt: 1, lineHeight: 1.5 }}>
            AI bisa membuat kesalahan, periksa kembali hasilnya.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
