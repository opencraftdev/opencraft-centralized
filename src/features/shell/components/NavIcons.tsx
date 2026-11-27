// Duotone sidebar icons (24px grid). Layer "ic-b" = light, "ic-a" = strong; colours come from the CSS
// variables --a / --b set by the nav row (idle: soft blue, hover/active: logo blue).

type P = { className?: string };

function Svg({ children, className }: P & { children: React.ReactNode }) {
  return (
    <svg className={`nav-ic ${className ?? ""}`} width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const ChatIcon = (p: P) => (
  <Svg {...p}>
    <path className="ic-b" d="M5 3h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9.2L5 17v-3.2A3 3 0 0 1 2 11V6a3 3 0 0 1 3-3z" />
    <path className="ic-a" d="M11 9h8a3 3 0 0 1 3 3v4.5a3 3 0 0 1-2 2.83V22l-3.6-2.5H11a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3z" />
  </Svg>
);

export const SkillsIcon = (p: P) => (
  <Svg {...p}>
    <path className="ic-b" d="M18.5 1.5c.45 2.2 1.1 2.85 3.3 3.3-2.2.45-2.85 1.1-3.3 3.3-.45-2.2-1.1-2.85-3.3-3.3 2.2-.45 2.85-1.1 3.3-3.3z" />
    <circle className="ic-b" cx="19" cy="18.5" r="1.8" />
    <path className="ic-a" d="M10 4.5c.95 4.9 2.6 6.55 7.5 7.5-4.9.95-6.55 2.6-7.5 7.5-.95-4.9-2.6-6.55-7.5-7.5 4.9-.95 6.55-2.6 7.5-7.5z" />
  </Svg>
);

export const TasksIcon = (p: P) => (
  <Svg {...p}>
    <rect className="ic-b" x="3.5" y="3.5" width="17" height="19" rx="3.5" />
    <rect className="ic-a" x="8" y="1.5" width="8" height="4.5" rx="2" />
    <path className="ic-a" d="M10.6 17.2 7.9 14.5a1.15 1.15 0 0 1 1.6-1.6l1.9 1.9 4.2-4.2a1.15 1.15 0 0 1 1.6 1.6l-5 5a1.15 1.15 0 0 1-1.6 0z" />
  </Svg>
);

export const DocsIcon = (p: P) => (
  <Svg {...p}>
    <path className="ic-b" d="M6.5 2H14l6 6v11a3 3 0 0 1-3 3H6.5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" />
    <path className="ic-a" d="M14 2l6 6h-4a2 2 0 0 1-2-2z" />
    <rect className="ic-a" x="7" y="12" width="9.5" height="2.2" rx="1.1" />
    <rect className="ic-a" x="7" y="16.2" width="6.5" height="2.2" rx="1.1" />
  </Svg>
);

export const FinanceIcon = (p: P) => (
  <Svg {...p}>
    <rect className="ic-a" x="4.5" y="1.8" width="12.5" height="6" rx="2" />
    <rect className="ic-b" x="2" y="5" width="19" height="16.5" rx="3.5" />
    <path className="ic-a" d="M15 10h7a.8.8 0 0 1 .8.8v5.4a.8.8 0 0 1-.8.8h-7a3.5 3.5 0 0 1 0-7z" />
    <circle className="ic-b" cx="15.3" cy="13.5" r="1.3" />
  </Svg>
);

export const ScrapersIcon = (p: P) => (
  <Svg {...p}>
    <circle className="ic-b" cx="10" cy="10" r="8.2" />
    <circle className="ic-a" cx="15.2" cy="15.2" r="5" />
    <circle className="ic-b" cx="15.2" cy="15.2" r="2.6" />
    <path className="ic-a" d="M18.4 17.2l3.3 3.3a1.2 1.2 0 0 1-1.7 1.7l-3.3-3.3z" />
  </Svg>
);
