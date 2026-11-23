import type { ReactNode } from 'react';
import './LiquidGlassIcon.css';

export type GlassIconName =
  | 'meadow'
  | 'home'
  | 'book'
  | 'exam'
  | 'pdf'
  | 'clock'
  | 'timer'
  | 'focus'
  | 'math'
  | 'thai'
  | 'english'
  | 'law'
  | 'award'
  | 'bookmark'
  | 'check';

export type GlassIconTone =
  | 'sky'
  | 'meadow'
  | 'amber'
  | 'coral'
  | 'lavender'
  | 'neutral';

interface LiquidGlassIconProps {
  name: GlassIconName;
  tone?: GlassIconTone;
  size?: 'sm' | 'md' | 'lg';
  /** Use 'circle' inside pill/capsule buttons for Apple concentricity (F4); 'squircle' in cards. */
  shape?: 'squircle' | 'circle';
}

const GLYPHS: Record<GlassIconName, ReactNode> = {
  meadow: (
    <>
      <path d="M4 17c2.5-3 5.5-4 8-4s5.5 1 8 4" />
      <path d="M12 13V7" />
      <circle cx="12" cy="5.5" r="2" />
      <path d="M9.5 10.5c1-1 2.5-1 2.5 0" />
      <path d="M14.5 9.5c-1-1-2.5-1-2.5 0" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 10.5L12 4l8.5 6.5" />
      <path d="M5.5 9.5V19h13V9.5" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" />
      <path d="M4 5.5V21" />
      <path d="M8 7.5h8" />
      <path d="M8 11h6" />
    </>
  ),
  exam: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <path d="M8 8.5h8" />
      <path d="M8 12.5h5" />
      <path d="M8.5 16.5l1.5 1.5 3-3" />
    </>
  ),
  pdf: (
    <>
      <path d="M6 3.5h8l4.5 4.5V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8 13h8" />
      <path d="M8 16.5h5.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </>
  ),
  timer: (
    <>
      <path d="M9.5 3h5" />
      <path d="M12 3v2.5" />
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5l2.8-2.8" />
    </>
  ),
  focus: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" />
      <path d="M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18" />
    </>
  ),
  math: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h3M9.5 7.5v3" />
      <path d="M13.5 9h3" />
      <path d="M8 15h3" />
      <path d="M13.5 14h3M13.5 16.5h3" />
    </>
  ),
  thai: (
    <>
      <path d="M5 18.5c2-6 4.5-11 7-11s5 5 7 11" />
      <path d="M8.5 13.5h7" />
      <circle cx="12" cy="4.5" r="1.3" />
    </>
  ),
  english: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.5c2.6 2.4 4 5.3 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.3-4-8.5s1.4-6.1 4-8.5z" />
    </>
  ),
  law: (
    <>
      <path d="M12 4v15" />
      <path d="M6 7.5h12" />
      <path d="M6 7.5l-2.2 5a2.6 2.6 0 0 0 4.4 0z" />
      <path d="M18 7.5l-2.2 5a2.6 2.6 0 0 0 4.4 0z" />
      <path d="M8.5 19h7" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9.5" r="5" />
      <path d="M9.5 14l-1 6.5 3.5-2 3.5 2-1-6.5" />
    </>
  ),
  bookmark: (
    <path d="M6.5 4h11a1 1 0 0 1 1 1v15.5l-6.5-4-6.5 4V5a1 1 0 0 1 1-1z" />
  ),
  check: <path d="M5.5 12.5l4.2 4.2L18.5 8" />,
};

const SVG_SIZE: Record<'sm' | 'md' | 'lg', number> = {
  sm: 14,
  md: 20,
  lg: 23,
};

export function LiquidGlassIcon({
  name,
  tone = 'sky',
  size = 'md',
  shape = 'squircle',
}: LiquidGlassIconProps) {
  const px = SVG_SIZE[size];
  return (
    <span
      className={`lg-icon lg-icon--${size} lg-icon--${tone}${
        shape === 'circle' ? ' lg-icon--circle' : ''
      }`}
      aria-hidden="true"
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.95"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GLYPHS[name]}
      </svg>
    </span>
  );
}
