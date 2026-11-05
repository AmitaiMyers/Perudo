import { useEffect } from 'react';
import { TURN_DURATION_MS } from '@perudo/shared';
import { playSound } from '../sound';
import { useCountdown } from '../useCountdown';

/** Seconds at which your own turn starts ticking audibly. */
const TICK_FROM_SECONDS = 5;

/** Turn countdown bar. Give it `key={seq}` so each new turn restarts it. */
export function TurnTimer({ remainingMs, isMyTurn }: { remainingMs: number; isMyTurn: boolean }) {
  const left = useCountdown(remainingMs);
  const seconds = Math.ceil(left / 1000);

  useEffect(() => {
    if (isMyTurn && seconds > 0 && seconds <= TICK_FROM_SECONDS) playSound('tick');
  }, [isMyTurn, seconds]);

  return (
    <div
      className={`turn-timer ${left < 10_000 ? 'turn-timer--urgent' : ''}`}
      role="timer"
      aria-label={`${seconds} seconds left`}
    >
      <div className="turn-timer__bar" style={{ transform: `scaleX(${left / TURN_DURATION_MS})` }} />
      <span className="turn-timer__label">{seconds}s</span>
    </div>
  );
}
