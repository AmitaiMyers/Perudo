import { useMemo, type CSSProperties } from 'react';
import { PREFERS_REDUCED_MOTION } from '../motion';

const PIECE_COUNT = 90;
const COLORS = ['#f2a93b', '#4fc1cf', '#ef7a6b', '#a68af0', '#7cc96f', '#ee8fc6', '#f6efe0'];

/** CSS-only confetti burst for the winner screen (skipped with reduced motion). */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.4 + Math.random() * 1.8,
        drift: (Math.random() - 0.5) * 160,
        spin: 360 + Math.random() * 720,
        color: COLORS[index % COLORS.length],
        wide: Math.random() > 0.5,
      })),
    [],
  );
  if (PREFERS_REDUCED_MOTION) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={`confetti__piece ${piece.wide ? 'confetti__piece--wide' : ''}`}
          style={
            {
              left: `${piece.left}%`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--drift': `${piece.drift}px`,
              '--spin': `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
