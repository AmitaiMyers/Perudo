import { useEffect, useState } from 'react';
import { countMatchingDice, type Face, type PublicPlayer, type RevealSummary } from '@perudo/shared';
import { PREFERS_REDUCED_MOTION } from './motion';
import { bonusDieGainer } from './players';
import { playSound, vibrate } from './sound';

/**
 * Pause before the first cup is lifted, time between cups, the beat before the verdict,
 * and how long everyone can study the dice before the loser's die leaves the table.
 */
const LIFT_DELAY_MS = 500;
const HAND_STEP_MS = 550;
const VERDICT_PAUSE_MS = 600;
const SETTLE_DELAY_MS = 1_600;
/** Flight time of the bonus die from the middle of the table into the winner's cup (matches the CSS). */
const BONUS_FLIGHT_MS = 950;

export interface RevealHand {
  playerId: string;
  dice: Face[];
  matches: number;
}

export interface RevealStage {
  hands: RevealHand[];
  /** How many hands (in seat order) have been revealed so far. */
  handsShown: number;
  /** Matching dice among the revealed hands: the number that "counts up" on screen. */
  countSoFar: number;
  verdictShown: boolean;
  /** The verdict has been applied at the table: the loser's die flies out, a bonus die flies in. */
  settled: boolean;
  /** The bonus die (if any) has landed in its cup. */
  bonusLanded: boolean;
}

/**
 * Drives the dramatic reveal: cups are lifted one player at a time while the count ticks up,
 * then the verdict lands (with its sound). Restarts whenever `resetKey` changes.
 */
export function useRevealStage(
  reveal: RevealSummary,
  players: readonly PublicPlayer[],
  myPlayerId: string,
  resetKey: string,
): RevealStage {
  const hands = players
    .map((player) => {
      const dice = reveal.dice[player.id];
      if (dice === undefined) throw new Error(`Reveal is missing dice for ${player.id}`);
      return { playerId: player.id, dice, matches: countMatchingDice(dice, reveal.bid.face) };
    })
    .filter((hand) => hand.dice.length > 0); // players eliminated before this round had no cup

  const totalMs = LIFT_DELAY_MS + hands.length * HAND_STEP_MS + VERDICT_PAUSE_MS;
  const [startedAt, setStartedAt] = useState(() => performance.now());
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    const start = performance.now();
    setStartedAt(start);
    setNow(start);
    const interval = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(interval);
  }, [resetKey]);

  const elapsed = PREFERS_REDUCED_MOTION ? Number.POSITIVE_INFINITY : now - startedAt;
  const handsShown = Math.max(0, Math.min(hands.length, Math.floor((elapsed - LIFT_DELAY_MS) / HAND_STEP_MS) + 1));
  const verdictShown = elapsed >= totalMs;
  const settled = elapsed >= totalMs + SETTLE_DELAY_MS;
  const bonusLanded = elapsed >= totalMs + SETTLE_DELAY_MS + BONUS_FLIGHT_MS;
  const gainerId = bonusDieGainer(reveal, players);
  const countSoFar = hands.slice(0, handsShown).reduce((total, hand) => total + hand.matches, 0);

  useEffect(() => {
    if (handsShown > 0 && !verdictShown) playSound('tick');
  }, [handsShown, verdictShown]);

  useEffect(() => {
    if (verdictShown) playSound('verdict');
  }, [verdictShown]);

  useEffect(() => {
    if (!settled) return;
    playSound(gainerId === null ? 'dieOut' : 'dieOutAndIn');
    if (reveal.loserId === myPlayerId) vibrate([120, 60, 120]);
  }, [settled, gainerId, reveal.loserId, myPlayerId]);

  return { hands, handsShown, countSoFar, verdictShown, settled, bonusLanded };
}
