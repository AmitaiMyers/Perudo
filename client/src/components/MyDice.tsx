import { useEffect, useState } from 'react';
import type { Face } from '@perudo/shared';
import { PREFERS_REDUCED_MOTION } from '../motion';
import type { PlayerTheme } from '../players';
import { Cup } from './Cup';
import { Die } from './Die';

const SHAKE_MS = 850;

/**
 * Your hidden hand. Mount it with `key={roundNumber}`: each new round first shakes the cup,
 * then the dice tumble out one by one.
 */
export function MyDice({ dice, theme }: { dice: Face[]; theme: PlayerTheme }) {
  const [shaking, setShaking] = useState(!PREFERS_REDUCED_MOTION);

  useEffect(() => {
    if (!shaking) return;
    const timeout = window.setTimeout(() => setShaking(false), SHAKE_MS);
    return () => window.clearTimeout(timeout);
  }, [shaking]);

  if (shaking) {
    return (
      <div className="my-dice my-dice--shaking" aria-label="Shaking your dice">
        <Cup theme={theme} size={50} />
      </div>
    );
  }
  return (
    <div className="my-dice" aria-label="Your dice (only you can see them)">
      {dice.map((face, index) => (
        <span key={index} className="my-dice__die" style={{ animationDelay: `${index * 70}ms` }}>
          <Die face={face} size={40} theme={theme} />
        </span>
      ))}
    </div>
  );
}
