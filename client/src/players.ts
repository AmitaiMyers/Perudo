import type { PublicPlayer } from '@perudo/shared';

/** Seat lookup for ids the server sent us; a missing id means the client and server disagree. */
export function findPlayer(players: readonly PublicPlayer[], playerId: string): PublicPlayer {
  const player = players.find((candidate) => candidate.id === playerId);
  if (player === undefined) throw new Error(`Unknown player id ${playerId}`);
  return player;
}

export function playerName(players: readonly PublicPlayer[], playerId: string): string {
  return findPlayer(players, playerId).name;
}

/** " (jumped in, time ran out)" style suffix for an action, or "" when it was an ordinary turn. */
export function describeActionTags(interruption: boolean, forcedByTimeout: boolean): string {
  const tags = [interruption ? 'jumped in' : null, forcedByTimeout ? 'time ran out' : null].filter(
    (tag) => tag !== null,
  );
  return tags.length > 0 ? ` (${tags.join(', ')})` : '';
}
