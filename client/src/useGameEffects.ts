import { useEffect, useRef } from 'react';
import type { RoomView } from '@perudo/shared';
import { playSound, vibrate } from './sound';

/**
 * Plays sounds / vibration for table events by comparing each new state with the previous one:
 * new round → rattle, your turn → chime, raise/Katzel → click, Liar → slam.
 * (Reveal verdict sounds are played by the reveal stage, when the verdict actually appears.)
 */
export function useGameEffects(view: RoomView): void {
  const previousRef = useRef<RoomView | null>(null);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = view;
    if (previous === null) return; // first render after (re)joining: stay quiet

    if (view.phase === 'bidding') {
      const newRound = previous.phase !== 'bidding' || previous.roundNumber !== view.roundNumber;
      if (newRound) playSound('rattle');

      const wasMyTurn = previous.phase === 'bidding' && !newRound && previous.turnPlayerId === view.myPlayerId;
      const isMyTurn = view.turnPlayerId === view.myPlayerId;
      if (isMyTurn && !wasMyTurn) {
        playSound('chime');
        vibrate([60, 40, 60]);
      }

      const { lastAction } = view;
      const actionHappened = !newRound && previous.seq !== view.seq && lastAction !== null;
      if (actionHappened) playSound(lastAction.kind === 'katzel' ? 'katzel' : 'bid');
      return;
    }

    const liarJustCalled = previous.phase === 'bidding' && (view.phase === 'reveal' || view.phase === 'gameOver');
    if (liarJustCalled) {
      playSound('slam');
      vibrate(180);
    }
  }, [view]);
}
