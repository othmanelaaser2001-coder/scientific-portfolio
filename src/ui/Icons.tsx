interface IconProps {
  size?: number;
  strokeWidth?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const ScanIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <path d="M3 12h18" />
  </svg>
);

export const CloseIcon = ({ size = 20, strokeWidth = 2 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const BoltIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

export const BugIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M8 6a4 4 0 0 1 8 0M6 10h12v4a6 6 0 0 1-12 0v-4Z" />
    <path d="M3 11h3M18 11h3M4 17l2.5-1.5M20 17l-2.5-1.5M5 6l2 1.6M19 6l-2 1.6" />
  </svg>
);

export const RulerIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M3.5 14.5 14.5 3.5a1.5 1.5 0 0 1 2.1 0l3.9 3.9a1.5 1.5 0 0 1 0 2.1L9.5 20.5a1.5 1.5 0 0 1-2.1 0l-3.9-3.9a1.5 1.5 0 0 1 0-2.1Z" />
    <path d="M7.5 10.5 9 12M10.5 7.5 12 9M13.5 4.5 15 6M4.5 13.5 6 15" />
  </svg>
);

export const CropIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M6 2v16h16M2 6h16v16" />
  </svg>
);

export const RotateIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M4 9a8 8 0 1 1 .6 6" />
    <path d="M3 4v5h5" />
  </svg>
);

export const StraightenIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M2 16h20" />
    <path d="M4 12.5 20 7" />
    <path d="M7 19v2M12 19v2M17 19v2" />
  </svg>
);

export const RedoIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M20 9a8 8 0 1 0-.6 6" />
    <path d="M21 4v5h-5" />
  </svg>
);

export const ShareIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M12 3v13" />
    <path d="m8 7 4-4 4 4" />
    <path d="M5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13" />
  </svg>
);

export const SaveIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M12 3v12" />
    <path d="m8 11 4 4 4-4" />
    <path d="M5 15v3.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V15" />
  </svg>
);

export const PlusIcon = ({ size = 20, strokeWidth = 2 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const InfoIcon = ({ size = 20, strokeWidth = 1.8 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

export const CheckIcon = ({ size = 20, strokeWidth = 2 }: IconProps) => (
  <svg {...base(size)} strokeWidth={strokeWidth} aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);
