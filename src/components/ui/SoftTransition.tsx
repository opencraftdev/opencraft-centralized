"use client";

import { cloneElement, forwardRef, useRef } from "react";
import { Transition } from "react-transition-group";
import type { TransitionProps } from "@mui/material/transitions";
import useForkRef from "@mui/utils/useForkRef";

// Dialog open/close: rises in with a soft spring; closing sinks a little, shrinks and fades out quickly, so a
// click on × feels like the card being tucked away. Reduced motion: a plain fade.

const ENTER = 340;
const EXIT = 230;

const reduce = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const SoftTransition = forwardRef<HTMLElement, TransitionProps & { children: React.ReactElement<{ style?: React.CSSProperties; ref?: React.Ref<HTMLElement> }> }>(function SoftTransition(props, ref) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { in: inProp, children, onEnter, onEntered, onExit, onExited, appear = true, style, addEndListener, timeout, easing, ...other } = props;
  const nodeRef = useRef<HTMLElement>(null);
  const handleRef = useForkRef(nodeRef, (children as unknown as { ref?: React.Ref<HTMLElement> }).ref ?? null, ref);
  const calm = reduce();
  const states: Record<string, React.CSSProperties> = {
    entering: { opacity: 1, transform: "none", filter: "none" },
    // at rest: no transform/filter at all, so the browser draws the text crisp (a lingering layer looks blurry)
    entered: { opacity: 1 },
    exiting: { opacity: 0, transform: calm ? "none" : "translateY(10px) scale(0.955)", filter: calm ? "none" : "blur(1.5px)" },
    exited: { opacity: 0, transform: calm ? "none" : "translateY(18px) scale(0.96)", filter: "none", visibility: inProp ? undefined : "hidden" },
  };
  return (
    <Transition
      in={inProp}
      appear={appear}
      nodeRef={nodeRef}
      timeout={{ enter: ENTER, exit: EXIT }}
      onEnter={(isAppearing: boolean) => onEnter?.(nodeRef.current as HTMLElement, isAppearing)}
      onEntered={(isAppearing: boolean) => onEntered?.(nodeRef.current as HTMLElement, isAppearing)}
      onExit={() => onExit?.(nodeRef.current as HTMLElement)}
      onExited={() => onExited?.(nodeRef.current as HTMLElement)}
      {...(other as object)}
    >
      {(state: string) =>
        cloneElement(children, {
          ref: handleRef,
          ...({ "data-tstate": state } as object), // lets the content react to opening / closing (sections sliding)
          style: {
            transformOrigin: "50% 60%",
            transition:
              state === "exiting"
                ? `opacity ${EXIT}ms cubic-bezier(0.4, 0, 1, 1), transform ${EXIT}ms cubic-bezier(0.4, 0, 1, 1), filter ${EXIT}ms ease-in`
                : `opacity ${ENTER * 0.7}ms ease-out, transform ${ENTER}ms cubic-bezier(0.34, 1.36, 0.64, 1), filter ${ENTER}ms ease-out`,
            ...states[state],
            ...style,
            ...children.props.style,
          },
        })
      }
    </Transition>
  );
});
