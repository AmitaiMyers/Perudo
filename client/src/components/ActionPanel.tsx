import { useEffect, useState } from 'react';
import { FACES, describeIllegalBid, minimumQuantity, type Bid, type BiddingView, type Face } from '@perudo/shared';
import { Die } from './Die';

interface ActionPanelProps {
  view: BiddingView;
  onRaise: (quantity: number, face: Face) => void;
  onKatzel: () => void;
  onLiar: () => void;
}

/**
 * Bid builder plus the three actions. Every action is available out of turn too
 * ("jumping in"); the server is the final judge and rejects anything stale or illegal.
 */
export function ActionPanel({ view, onRaise, onKatzel, onLiar }: ActionPanelProps) {
  const { currentBid } = view;
  const [face, setFace] = useState<Face>(defaultFace(currentBid));
  const [quantity, setQuantity] = useState(() => minimumQuantity(currentBid, defaultFace(currentBid)));

  // A new bid on the table resets the draft to "the smallest raise on the same face".
  // Keyed on the bid's values (not object identity) so unrelated state updates keep the draft.
  const bidKey = currentBid === null ? 'none' : `${currentBid.quantity}x${currentBid.face}`;
  useEffect(() => {
    setFace(defaultFace(currentBid));
    setQuantity(minimumQuantity(currentBid, defaultFace(currentBid)));
  }, [bidKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isMyTurn = view.turnPlayerId === view.myPlayerId;
  const minimum = minimumQuantity(currentBid, face);
  const raiseError = describeIllegalBid(currentBid, { quantity, face });
  const liarBlocked = describeLiarBlock(view);
  const katzelBlocked =
    currentBid === null ? 'No bid yet' : view.katzelCallerId !== null ? 'Katzel already called' : null;

  const chooseFace = (nextFace: Face) => {
    setFace(nextFace);
    setQuantity(minimumQuantity(currentBid, nextFace));
  };

  return (
    <section className={`actions ${isMyTurn ? 'actions--my-turn' : ''}`} aria-label="Your actions">
      <p className="actions__hint">
        {isMyTurn ? 'Raise, call Katzel, or call Liar' : 'Not your turn, but you can still jump in'}
      </p>

      <div className="bid-builder">
        <div className="stepper">
          <button
            type="button"
            className="stepper__button"
            onClick={() => setQuantity(quantity - 1)}
            disabled={quantity <= minimum}
            aria-label="Fewer dice"
          >
            −
          </button>
          <span className="stepper__value" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            className="stepper__button"
            onClick={() => setQuantity(quantity + 1)}
            aria-label="More dice"
          >
            +
          </button>
        </div>
        <div className="face-picker" role="radiogroup" aria-label="Face value">
          {FACES.map((candidate) => {
            const blocked = currentBid === null && candidate === 1;
            return (
              <button
                key={candidate}
                type="button"
                role="radio"
                aria-checked={candidate === face}
                className={`face-picker__option ${candidate === face ? 'face-picker__option--selected' : ''}`}
                onClick={() => chooseFace(candidate)}
                disabled={blocked}
                title={blocked ? 'No Pacos on the first bid' : undefined}
              >
                <Die face={candidate} size={34} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="action-buttons">
        <button
          type="button"
          className="button button--raise"
          disabled={raiseError !== null}
          onClick={() => onRaise(quantity, face)}
        >
          {currentBid === null ? 'Bid' : 'Raise'}
        </button>
        <button
          type="button"
          className="button button--katzel"
          disabled={katzelBlocked !== null}
          onClick={onKatzel}
          title={katzelBlocked ?? 'Bet the count is exactly the bid'}
        >
          Katzel
        </button>
        <button
          type="button"
          className="button button--liar"
          disabled={liarBlocked !== null}
          onClick={onLiar}
          title={liarBlocked ?? 'Call the bid a lie'}
        >
          Liar!
        </button>
      </div>
      {raiseError !== null && <p className="actions__reason">{raiseError}</p>}
    </section>
  );
}

function defaultFace(currentBid: Bid | null): Face {
  return currentBid === null ? 2 : currentBid.face;
}

function describeLiarBlock(view: BiddingView): string | null {
  if (view.currentBid === null) return 'No bid yet';
  if (view.bidderId === view.myPlayerId) return 'It is your own bid';
  if (view.katzelCallerId === view.myPlayerId) return 'It is your own Katzel';
  return null;
}
