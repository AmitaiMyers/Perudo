import type { CSSProperties } from 'react';
import type { Face } from '@perudo/shared';
import type { PlayerTheme } from '../players';

const PIP_POSITIONS: Record<Exclude<Face, 1>, Array<[number, number]>> = {
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 25],
    [72, 25],
    [28, 50],
    [72, 50],
    [28, 75],
    [72, 75],
  ],
};

interface DieProps {
  face: Face;
  size?: number;
  /** Visually marks a die that counts toward the bid during a reveal. */
  highlighted?: boolean;
  dimmed?: boolean;
  /** Color the die like its owner's cup; without a theme the die is neutral ivory. */
  theme?: PlayerTheme | null;
}

export function Die({ face, size = 44, highlighted = false, dimmed = false, theme = null }: DieProps) {
  const className = ['die', highlighted ? 'die--highlighted' : '', dimmed ? 'die--dimmed' : ''].join(' ');
  return (
    <svg
      className={className}
      style={theme === null ? undefined : themeStyle(theme)}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={face === 1 ? 'Paco' : `${face}`}
    >
      <rect x="3" y="3" width="94" height="94" rx="18" className="die__body" />
      {face === 1 ? (
        <PacoBird />
      ) : (
        PIP_POSITIONS[face].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" className="die__pip" />)
      )}
    </svg>
  );
}

/** CSS variables read by the die styles (body, edge, pips and the Paco bird). */
function themeStyle(theme: PlayerTheme): CSSProperties {
  return {
    '--die-body': theme.cup,
    '--die-edge': theme.shade,
    '--die-pip': theme.pip,
    '--die-bird': theme.pip,
    '--die-wing': theme.shade,
    '--die-eye': theme.cup,
  } as CSSProperties;
}

/** The bird drawn on the Paco face (same artwork as the app icon). */
function PacoBird() {
  return (
    <g transform="scale(0.3125) translate(-96 -96)">
      <g className="die__bird">
        <ellipse cx="246" cy="290" rx="92" ry="62" />
        <circle cx="318" cy="214" r="44" />
        <path d="M168 282 L104 238 L132 318 Z" />
      </g>
      <path d="M354 204 L404 222 L356 236 Z" className="die__beak" />
      <path d="M210 270 Q262 216 300 280 Q256 300 210 270 Z" className="die__wing" />
      <circle cx="328" cy="206" r="9" className="die__eye" />
    </g>
  );
}
