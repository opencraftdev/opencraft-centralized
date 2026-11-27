// Shared motion tokens (Apple-like: quick start, long soft settle). Used with the `motion` library and in CSS.

/** cubic-bezier for motion.dev `ease` */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Same curve for CSS transitions */
export const EASE_OUT_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Springy-but-calm spring for things that move position (sliding pills, cards changing column). */
export const SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const;

/** Content entering: small rise + fade. */
export const ENTER = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE_OUT },
} as const;
