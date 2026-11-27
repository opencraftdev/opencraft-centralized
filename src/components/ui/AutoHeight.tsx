"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "./motion";

// Animates its own height to whatever its content needs, so a panel never "jumps" when its content changes
// (e.g. a dialog switching from a long task to a short checklist item). Uses real height, not a scale transform,
// so text never stretches.
export function AutoHeight({ children, duration = 0.34 }: { children: React.ReactNode; duration?: number }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={{ duration: reduce ? 0 : duration, ease: EASE_OUT }}
      style={{ overflow: "hidden" }}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/** Content that slides in from the direction you are going (1 = forward/deeper, -1 = back) and fades. */
export function SwapIn({ id, dir = 1, children }: { id: string; dir?: 1 | -1 | 0; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={id}
      initial={reduce ? false : { opacity: 0, x: dir * 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
