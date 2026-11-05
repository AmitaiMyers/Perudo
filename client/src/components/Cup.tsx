import { useId } from 'react';
import type { PlayerTheme } from '../players';

/**
 * A player's dice cup, drawn after the classic colored Perudo cups:
 * three stacked, ridged bands (zigzag and key patterns) under a lid embossed with the bird.
 */
export function Cup({ theme, size = 56 }: { theme: PlayerTheme; size?: number }) {
  const shineId = useId();
  return (
    <svg
      className="cup"
      viewBox="0 0 100 92"
      width={size}
      height={(size * 92) / 100}
      aria-hidden="true"
      style={{ color: theme.shade }}
    >
      <defs>
        <linearGradient id={shineId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      {/* Bands, bottom to top so each upper band overlaps the one below. */}
      <path d="M12 60 H88 L92 84 Q50 92 8 84 Z" fill={theme.cup} />
      <path d="M17 36 H83 L87 62 H13 Z" fill={theme.cup} />
      <path d="M24 12 H76 L80 38 H20 Z" fill={theme.cup} />
      {/* Ridges between bands. */}
      <path d="M13 61 H87 M18 37 H82" stroke="currentColor" strokeWidth="2.5" fill="none" />
      {/* Zigzag band and a row of small key squares, like the embossed cup pattern. */}
      <path
        d="M18 50 L24 43 L30 50 L36 43 L42 50 L48 43 L54 50 L60 43 L66 50 L72 43 L78 50 L84 43"
        stroke="currentColor"
        strokeWidth="2.4"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M27 22 h6 v6 h-6 z M41 22 h6 v6 h-6 z M55 22 h6 v6 h-6 z M69 22 h6 v6 h-6 z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="M14 72 H86" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" fill="none" />
      {/* Lid with the embossed bird. */}
      <ellipse cx="50" cy="12" rx="26" ry="6.5" fill={theme.cup} stroke="currentColor" strokeWidth="2" />
      <path d="M42 13 q4 -5 10 -2 l4 -3 l-1 4 q2 2 -1 4 q-6 3 -12 -3 z" fill="currentColor" />
      {/* Light from the left, shadow on the right. */}
      <path d="M24 12 H76 L80 38 H83 L87 62 H88 L92 84 Q50 92 8 84 L12 62 H13 L17 38 H20 Z" fill={`url(#${shineId})`} />
    </svg>
  );
}
