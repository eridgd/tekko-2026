/**
 * Inline SVG icon set. Bundled rather than loaded from a font or sprite sheet
 * so icons render offline and on the very first paint.
 */
type Props = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false as const,
});

export const IconNow = ({ size = 24, className }: Props) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconCalendar = ({ size = 24, className }: Props) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const IconStar = ({ size = 24, className, filled }: Props & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.6l2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 17.05 6.75 19.8l1-5.85L3.5 9.8l5.9-.9z" />
  </svg>
);

export const IconMap = ({ size = 24, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z" />
    <path d="M9 4v13M15 6.5v13" />
  </svg>
);

export const IconUsers = ({ size = 24, className }: Props) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3.5 19.5a5.5 5.5 0 0111 0" />
    <path d="M16.5 5.2a3.4 3.4 0 010 5.6M17.5 14.6a5.5 5.5 0 013 4.9" />
  </svg>
);

export const IconSearch = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

export const IconFilter = ({ size = 22, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

export const IconChevronLeft = ({ size = 24, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconChevronRight = ({ size = 24, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const IconClose = ({ size = 22, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconPin = ({ size = 14, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const IconDownload = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" />
    <path d="M4 17v2.5A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5V17" />
  </svg>
);

export const IconAlert = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M12 4.5l8.5 15h-17z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
);

export const IconSettings = ({ size = 22, className }: Props) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 14.5a1.7 1.7 0 00.35 1.9l.05.05a2 2 0 11-2.85 2.85l-.05-.05a1.7 1.7 0 00-1.9-.35 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.55 1.7 1.7 0 00-1.9.35l-.05.05A2 2 0 114 16.9l.05-.05a1.7 1.7 0 00.35-1.9 1.7 1.7 0 00-1.55-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.55-1.1 1.7 1.7 0 00-.35-1.9L4.25 6.9A2 2 0 117.1 4.05l.05.05a1.7 1.7 0 001.9.35H9.1a1.7 1.7 0 001-1.55V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.55 1.7 1.7 0 001.9-.35l.05-.05A2 2 0 1119.95 7.1l-.05.05a1.7 1.7 0 00-.35 1.9v.05a1.7 1.7 0 001.55 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);

export const IconExternal = ({ size = 16, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14v4.5A1.5 1.5 0 0116.5 20h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" />
  </svg>
);

export const IconPlus = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14" />
  </svg>
);

export const IconTarget = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

export const IconGrid = ({ size = 22, className }: Props) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M9 9v11M15 9v11" />
  </svg>
);

export const IconList = ({ size = 22, className }: Props) => (
  <svg {...base(size)} className={className}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);
