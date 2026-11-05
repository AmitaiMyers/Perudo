import { PACO_FACE } from './constants';
import type { Bid, Face } from './types';

export const FACES: readonly Face[] = [1, 2, 3, 4, 5, 6];

/** The lowest legal opening bid, also used when a starting player's timer runs out. */
export const MINIMUM_OPENING_BID: Bid = { quantity: 1, face: 2 };

export function isPaco(face: Face): boolean {
  return face === PACO_FACE;
}

export function isFace(value: unknown): value is Face {
  return typeof value === 'number' && FACES.includes(value as Face);
}

/** Validates a bid received from the network. Returns an error message, or null if well-formed. */
export function describeMalformedBid(bid: unknown): string | null {
  if (typeof bid !== 'object' || bid === null) return 'Bid must be an object.';
  const { quantity, face } = bid as Record<string, unknown>;
  if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1) {
    return 'Bid quantity must be a whole number of at least 1.';
  }
  if (!isFace(face)) return 'Bid face must be between 1 and 6.';
  return null;
}

/**
 * Counts dice that satisfy a bid on `face`.
 * Pacos are wild for every other face; a bid on Pacos counts only Pacos.
 */
export function countMatchingDice(dice: readonly Face[], face: Face): number {
  return dice.filter((die) => die === face || (!isPaco(face) && isPaco(die))).length;
}

/**
 * The smallest quantity a bid on `face` must have to beat `previous`
 * (or to open the round when `previous` is null).
 *
 * Classic Paco conversion:
 *  - normal → normal: higher face keeps the quantity, same/lower face needs +1
 *  - normal → Paco:   half the quantity, rounded up
 *  - Paco → Paco:     +1
 *  - Paco → normal:   double plus one
 */
export function minimumQuantity(previous: Bid | null, face: Face): number {
  if (previous === null) return 1;
  const previousIsPaco = isPaco(previous.face);
  const nextIsPaco = isPaco(face);
  if (!previousIsPaco && !nextIsPaco) {
    return face > previous.face ? previous.quantity : previous.quantity + 1;
  }
  if (!previousIsPaco && nextIsPaco) return Math.ceil(previous.quantity / 2);
  if (previousIsPaco && nextIsPaco) return previous.quantity + 1;
  return previous.quantity * 2 + 1;
}

/** Returns why `next` cannot follow `previous`, or null if it is a legal bid. */
export function describeIllegalBid(previous: Bid | null, next: Bid): string | null {
  if (previous === null && isPaco(next.face)) {
    return 'The first bid of a round cannot be on Pacos.';
  }
  const required = minimumQuantity(previous, next.face);
  if (next.quantity < required) {
    return `A bid on ${next.face === PACO_FACE ? 'Pacos' : `${next.face}s`} needs at least ${required} dice.`;
  }
  return null;
}

export interface ShowdownInput {
  bid: Bid;
  allDice: readonly Face[];
  bidderId: string;
  /** Set when a Katzel is pending: the bid is then checked for an exact match. */
  katzelCallerId: string | null;
  liarCallerId: string;
  /** True when Liar was called out of turn. */
  interruption: boolean;
}

export interface ShowdownOutcome {
  actualCount: number;
  liarWasCorrect: boolean;
  loserId: string;
  bonusPlayerId: string | null;
}

/**
 * Resolves a Liar call.
 *  - Without Katzel: Liar is correct when fewer dice than bid exist; otherwise the caller loses.
 *  - With Katzel:    Liar is correct when the count is not exactly the bid; the Katzel caller then loses.
 *  - An out-of-turn Liar caller who is correct regains a die (bonus).
 */
export function resolveShowdown(input: ShowdownInput): ShowdownOutcome {
  const actualCount = countMatchingDice(input.allDice, input.bid.face);
  const katzelPending = input.katzelCallerId !== null;
  const liarWasCorrect = katzelPending ? actualCount !== input.bid.quantity : actualCount < input.bid.quantity;
  const wrongPlayerId = input.katzelCallerId ?? input.bidderId;
  return {
    actualCount,
    liarWasCorrect,
    loserId: liarWasCorrect ? wrongPlayerId : input.liarCallerId,
    bonusPlayerId: liarWasCorrect && input.interruption ? input.liarCallerId : null,
  };
}
