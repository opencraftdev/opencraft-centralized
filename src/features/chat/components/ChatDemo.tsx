"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/ui/motion";

// The empty-chat placeholder: a short looping "how to use this" conversation in bubbles. A question gets typed into
// a user bubble, the answer shows typing dots, then the reply lands. Then the next example. Reduced motion: the first
// example, still.

interface Example {
  ask: string;
  answer: string;
}

function examples(skill: string | null): Example[] {
  const list: Example[] = [
    {
      ask: "Ringkas proposal Klinik Aura jadi 3 poin",
      answer: "Siap. 1) Ruang lingkup pekerjaan. 2) Timeline pengerjaan. 3) Biaya dan termin pembayaran.",
    },
    {
      ask: "Cari invoice Vercel bulan lalu",
      answer: "Ketemu 1 file di Document: Invoice Vercel (PDF). Mau saya buka?",
    },
  ];
  if (skill) {
    list.splice(1, 0, {
      ask: `/${skill} buat draf penawaran untuk Remeh`,
      answer: "Skill dipakai. Draf penawaran sudah jadi dan tersimpan di Document.",
    });
  }
  return list;
}

type Phase = "typing" | "thinking" | "answer" | "out";

export function ChatDemo({ skill }: { skill: string | null }) {
  const reduce = useReducedMotion();
  const list = examples(skill);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [chars, setChars] = useState(0);
  const ex = list[i % list.length];

  useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (chars < ex.ask.length) t = setTimeout(() => setChars((c) => c + 1), 38);
      else t = setTimeout(() => setPhase("thinking"), 450);
    } else if (phase === "thinking") {
      t = setTimeout(() => setPhase("answer"), 1100);
    } else if (phase === "answer") {
      t = setTimeout(() => setPhase("out"), 3200);
    } else {
      t = setTimeout(() => {
        setI((n) => n + 1);
        setChars(0);
        setPhase("typing");
      }, 450);
    }
    return () => clearTimeout(t);
  }, [phase, chars, ex.ask.length, reduce]);

  const shown = reduce ? ex.ask : ex.ask.slice(0, chars);
  const showReply = reduce || phase === "thinking" || phase === "answer";
  const showAnswer = reduce || phase === "answer";

  return (
    <Box aria-hidden sx={{ width: "100%", maxWidth: 520, mx: "auto", minHeight: 176, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <AnimatePresence mode="wait">
        {phase !== "out" && (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.36, ease: EASE_OUT }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {/* user bubble, right */}
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Box sx={{ maxWidth: "85%", bgcolor: "#E9EEF6", color: "#1F1F1F", borderRadius: "20px 4px 20px 20px", px: 2, py: 1.25, fontSize: "0.9375rem", lineHeight: 1.5, minHeight: 44 }}>
                <Skillish text={shown} />
                {!reduce && phase === "typing" && <Caret />}
              </Box>
            </Box>
            {/* answer, left */}
            <AnimatePresence initial={false}>
              {showReply && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: EASE_OUT }}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
                >
                  <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: "#F0F4F9", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#0B57D0", fontSize: 14 }}>✦</Box>
                  <Box sx={{ maxWidth: "85%", bgcolor: "#fff", border: "1px solid #E3E3E3", borderRadius: "4px 20px 20px 20px", px: 2, py: 1.25, fontSize: "0.9375rem", lineHeight: 1.5, color: "#1F1F1F" }}>
                    <AnimatePresence mode="wait" initial={false}>
                      {showAnswer ? (
                        <motion.span key="a" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                          {ex.answer}
                        </motion.span>
                      ) : (
                        <motion.span key="d" exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ display: "inline-flex", gap: 4, padding: "6px 0" }}>
                          {[0, 1, 2].map((d) => (
                            <motion.span
                              key={d}
                              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                              transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15, ease: "easeInOut" }}
                              style={{ width: 6, height: 6, borderRadius: 3, background: "#80868B", display: "inline-block" }}
                            />
                          ))}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

/** "/skill rest": the skill part in blue, like the real composer. */
function Skillish({ text }: { text: string }) {
  if (!text.startsWith("/")) return <>{text}</>;
  const sp = text.indexOf(" ");
  const head = sp === -1 ? text : text.slice(0, sp);
  return (
    <>
      <Box component="span" sx={{ color: "#0B57D0", fontWeight: 500 }}>
        {head}
      </Box>
      {sp === -1 ? "" : text.slice(sp)}
    </>
  );
}

function Caret() {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity }}
      style={{ display: "inline-block", width: 2, height: "1.05em", background: "#0B57D0", marginLeft: 2, verticalAlign: "text-bottom" }}
    />
  );
}
