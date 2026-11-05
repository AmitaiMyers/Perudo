import type { PublicPlayer, RevealSummary } from '@perudo/shared';

/** Seat lookup for ids the server sent us; a missing id means the client and server disagree. */
export function findPlayer(players: readonly PublicPlayer[], playerId: string): PublicPlayer {
  const player = players.find((candidate) => candidate.id === playerId);
  if (player === undefined) throw new Error(`Unknown player id ${playerId}`);
  return player;
}

/** A player's colors: their cup, its darker shade, and the pip/bird color that reads on their dice. */
export interface PlayerTheme {
  cup: string;
  shade: string;
  pip: string;
}

/** One theme per seat (max 6 players), matching the classic colored Perudo cups. */
const SEAT_THEMES: readonly PlayerTheme[] = [
  { cup: '#e8392f', shade: '#a8231b', pip: '#ffffff' }, // red
  { cup: '#3d93e6', shade: '#2563a8', pip: '#ffffff' }, // blue
  { cup: '#f6c813', shade: '#b8920a', pip: '#1d1b16' }, // yellow
  { cup: '#2f9e44', shade: '#1d6e2e', pip: '#ffffff' }, // green
  { cup: '#d83a9c', shade: '#9c2271', pip: '#ffffff' }, // magenta
  { cup: '#f6871f', shade: '#b95d0b', pip: '#1d1b16' }, // orange
];

export function playerTheme(players: readonly PublicPlayer[], playerId: string): PlayerTheme {
  const seat = players.findIndex((candidate) => candidate.id === playerId);
  const theme = SEAT_THEMES[seat];
  if (theme === undefined) throw new Error(`No seat theme for player ${playerId}`);
  return theme;
}

/**
 * The jump-in bonus winner, but only if the bonus actually added a die
 * (a player already at the maximum keeps their count).
 */
export function bonusDieGainer(reveal: RevealSummary, players: readonly PublicPlayer[]): string | null {
  const { bonusPlayerId } = reveal;
  if (bonusPlayerId === null) return null;
  const rolled = reveal.dice[bonusPlayerId];
  if (rolled === undefined) throw new Error(`Reveal is missing dice for ${bonusPlayerId}`);
  return findPlayer(players, bonusPlayerId).diceCount > rolled.length ? bonusPlayerId : null;
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
