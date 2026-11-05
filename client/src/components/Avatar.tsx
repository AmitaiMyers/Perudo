import type { PublicPlayer } from '@perudo/shared';
import { findPlayer, playerTheme } from '../players';

interface AvatarProps {
  players: readonly PublicPlayer[];
  playerId: string;
  size?: number;
}

/** Initial in the player's cup color; used wherever a name appears in text. */
export function Avatar({ players, playerId, size = 40 }: AvatarProps) {
  const theme = playerTheme(players, playerId);
  const initial = Array.from(findPlayer(players, playerId).name)[0]?.toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r="46" fill={theme.cup} />
        <text x="50" y="52" textAnchor="middle" dominantBaseline="central" className="avatar__initial" fill={theme.pip}>
          {initial}
        </text>
      </svg>
    </span>
  );
}
