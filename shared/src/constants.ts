/** Dice each player starts with, and the most a player can ever hold. */
export const MAX_DICE = 5;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** Time each player has to act on their turn before an automatic action is forced. */
export const TURN_DURATION_MS = 30_000;

/** How long the revealed dice stay on screen before the next round starts (includes the reveal animation). */
export const REVEAL_DURATION_MS = 10_000;

export const NAME_MAX_LENGTH = 16;
export const ROOM_CODE_LENGTH = 4;

/** Emoji players can float over their seat. The server rejects anything else. */
export const REACTION_EMOJIS = ['😂', '😱', '🤥', '🔥', '👏'] as const;

/** Minimum gap between two reactions from the same player (spam guard). */
export const REACTION_COOLDOWN_MS = 1_000;

/** The face showing the bird. It is wild: it counts toward any non-Paco face being bid. */
export const PACO_FACE = 1;
