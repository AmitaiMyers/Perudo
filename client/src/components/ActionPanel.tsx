import { useEffect, useState, type ReactNode } from 'react';
import {
  FACES,
  countMatchingDice,
  describeBlockedFace,
  describeIllegalBid,
  faceName,
  isPaco,
  minimumQuantity,
  type Bid,
  type BiddingView,
  type Face,
} from '@perudo/shared';
import { playerName } from '../players';
import { BidText } from './BidText';
import { Die } from './Die';

/** How long the "Sure? Tap again" state of the Liar button lasts. */
const LIAR_CONFIRM_WINDOW_MS = 2_000;

interface ActionPanelProps {
  view: BiddingView;
  onRaise: (bid: Bid) => void;
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
  const [liarArmed, setLiarArmed] = useState(false);

  // A new bid on the table resets the draft to "the smallest raise on the same face" and disarms Liar,
  // so a pending confirmation can never fire against a bid the player has not seen.
  // Keyed on the bid's values (not object identity) so unrelated state updates keep the draft.
  const bidKey = currentBid === null ? 'none' : `${currentBid.quantity}x${currentBid.face}`;
  useEffect(() => {
    setFace(defaultFace(currentBid));
    setQuantity(minimumQuantity(currentBid, defaultFace(currentBid)));
    setLiarArmed(false);
  }, [bidKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!liarArmed) return;
    const timeout = window.setTimeout(() => setLiarArmed(false), LIAR_CONFIRM_WINDOW_MS);
    return () => window.clearTimeout(timeout);
  }, [liarArmed]);

  const draft: Bid = { quantity, face };
  const minimum = minimumQuantity(currentBid, face);
  const lastDieRound = view.lastDiePlayerId !== null;
  const raiseError = describeOpeningWait(view) ?? describeIllegalBid(currentBid, draft, lastDieRound);
  const katzelBlock = describeKatzelBlock(view);
  const liarBlock = describeLiarBlock(view);
  const held = countMatchingDice(view.myDice, face);

  const chooseFace = (nextFace: Face) => {
    setFace(nextFace);
    setQuantity(minimumQuantity(currentBid, nextFace));
  };

  const pressLiar = () => {
    if (!liarArmed) {
      setLiarArmed(true);
      return;
    }
    setLiarArmed(false);
    onLiar();
  };

  return (
    <section className="actions" aria-label="Your move">
      <div className="bid-builder">
        <button
          type="button"
          className="stepper"
          onClick={() => setQuantity(quantity - 1)}
          disabled={quantity <= minimum}
          aria-label="Fewer dice"
        >
          −
        </button>
        <div className="bid-builder__preview" aria-live="polite">
          <BidText bid={draft} dieSize={34} />
          <span className="bid-builder__hint">
            you hold {held}
            {!isPaco(face) && ' incl. Pacos'}
          </span>
        </div>
        <button type="button" className="stepper" onClick={() => setQuantity(quantity + 1)} aria-label="More dice">
          +
        </button>
      </div>

      <div className="face-picker" role="radiogroup" aria-label="Face value">
        {FACES.map((candidate) => {
          const blockedReason = describeBlockedFace(currentBid, candidate, lastDieRound);
          return (
            <button
              key={candidate}
              type="button"
              role="radio"
              aria-checked={candidate === face}
              aria-label={faceName(candidate)}
              className={`face-picker__option ${candidate === face ? 'face-picker__option--selected' : ''}`}
              onClick={() => chooseFace(candidate)}
              disabled={blockedReason !== null}
              title={blockedReason ?? undefined}
            >
              <Die face={candidate} size={32} />
            </button>
          );
        })}
      </div>

      <div className="action-buttons">
        <ActionButton
          className="button--raise"
          label={currentBid === null ? 'Open' : 'Raise'}
          disabledReason={raiseError}
          onClick={() => onRaise(draft)}
        >
          <BidText bid={draft} dieSize={18} />
        </ActionButton>
        <ActionButton
          className="button--katzel"
          label="Katzel"
          caption={katzelBlock ?? 'exactly'}
          disabledReason={katzelBlock}
          onClick={onKatzel}
        />
        <ActionButton
          className={`button--liar ${liarArmed ? 'button--armed' : ''}`}
          label={liarArmed ? 'Sure?' : 'Liar!'}
          caption={liarBlock ?? (liarArmed ? 'tap again' : 'too high')}
          disabledReason={liarBlock}
          onClick={pressLiar}
        />
      </div>
      {raiseError !== null && <p className="actions__reason">{raiseError}</p>}
    </section>
  );
}

interface ActionButtonProps {
  className: string;
  label: string;
  /** Disables the button when set. */
  disabledReason: string | null;
  onClick: () => void;
  /** Small line under the label; defaults to `caption`. */
  children?: ReactNode;
  caption?: string;
}

function ActionButton({ className, label, caption, disabledReason, onClick, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`button action-button ${className}`}
      disabled={disabledReason !== null}
      onClick={onClick}
    >
      <span className="action-button__label">{label}</span>
      {children ?? <span className="action-button__caption">{caption}</span>}
    </button>
  );
}

function defaultFace(currentBid: Bid | null): Face {
  return currentBid === null ? 2 : currentBid.face;
}

/** In a last-die round nobody else may bid until the player on their last die has opened. */
function describeOpeningWait(view: BiddingView): string | null {
  const opener = view.lastDiePlayerId;
  if (opener === null || view.currentBid !== null || opener === view.myPlayerId) return null;
  return `Waiting for ${playerName(view.players, opener)} to open this last-die round.`;
}

function describeKatzelBlock(view: BiddingView): string | null {
  if (view.currentBid === null) return 'no bid yet';
  if (view.katzelCallerId !== null) return 'already called';
  return null;
}

/** Mirrors the server: with a Katzel pending, Liar challenges the Katzel, so the bidder may call it too. */
function describeLiarBlock(view: BiddingView): string | null {
  if (view.currentBid === null) return 'no bid yet';
  if (view.katzelCallerId === view.myPlayerId) return 'your Katzel';
  if (view.bidderId === view.myPlayerId && view.katzelCallerId === null) return 'your own bid';
  return null;
}
