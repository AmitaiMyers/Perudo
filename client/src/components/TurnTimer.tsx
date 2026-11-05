import { TURN_DURATION_MS } from '@perudo/shared';
import { useCountdown } from '../useCountdown';

/** Turn countdown bar. Give it `key={seq}` so each new turn restarts it. */
export function TurnTimer({ remainingMs }: { remainingMs: number }) {
  const left = useCountdown(remainingMs);
  const seconds = Math.ceil(left / 1000);
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
