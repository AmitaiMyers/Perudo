import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  countMatchingDice,
  TURN_DURATION_MS,
  type BiddingView,
  type Face,
  type GameOverView,
  type PublicPlayer,
  type Reaction,
  type RevealSummary,
  type RevealView,
} from '@perudo/shared';
import { bonusDieGainer, playerTheme } from '../players';
import { useCountdown } from '../useCountdown';
import type { RevealStage } from '../useRevealStage';
import { Cup } from './Cup';
import { Die } from './Die';

export type InGameView = BiddingView | RevealView | GameOverView;

export interface TableReveal {
  summary: RevealSummary;
  stage: RevealStage;
}

interface TableProps {
  view: InGameView;
  reactions: Reaction[];
  /** Present during the reveal and at game over; drives lifted cups and the die animations. */
  reveal: TableReveal | null;
  /** What sits in the middle of the felt (current bid, reveal counter, winner…). */
  center: ReactNode;
}

/**
 * The round table: every player sits behind their own colored cup, with their dice count on it.
 * Seats are rotated so the viewer is at the bottom, and play runs clockwise from there.
 */
export function Table({ view, reactions, reveal, center }: TableProps) {
  const myIndex = view.players.findIndex((player) => player.id === view.myPlayerId);
  if (myIndex === -1) throw new Error('The room state does not include the current player.');
  const seatCount = view.players.length;

  return (
    <section className={`table table--${seatCount}`} aria-label="Table">
      <div className="table__felt" aria-hidden="true" />
      <div className="table__center">{center}</div>
      {view.players.map((player, index) => {
        const position = (index - myIndex + seatCount) % seatCount; // 0 = me, then clockwise
        return (
          <Seat
            key={player.id}
            view={view}
            player={player}
            style={seatPosition(position, seatCount)}
            reactions={reactions.filter((reaction) => reaction.playerId === player.id)}
            reveal={reveal}
          />
        );
      })}
      {reveal !== null && reveal.stage.settled && <DieFlights view={view} reveal={reveal} myIndex={myIndex} />}
    </section>
  );
}

// ── Seats ───────────────────────────────────────────────────────────────────

interface SeatProps {
  view: InGameView;
  player: PublicPlayer;
  style: CSSProperties;
  reactions: Reaction[];
  reveal: TableReveal | null;
}

function Seat({ view, player, style, reactions, reveal }: SeatProps) {
  const theme = playerTheme(view.players, player.id);
  const bidding = view.phase === 'bidding' ? view : null;
  const isMe = player.id === view.myPlayerId;
  const isTurn = bidding !== null && bidding.turnPlayerId === player.id;
  const hand = reveal === null ? null : revealedHand(reveal, player.id);
  const count = displayedDiceCount(player, reveal);
  const verdict = reveal !== null && reveal.stage.verdictShown ? reveal.summary : null;
  const isLoser = verdict !== null && verdict.loserId === player.id;
  const isBonus = verdict !== null && verdict.bonusPlayerId === player.id;
  const gainsDie = reveal !== null && bonusDieGainer(reveal.summary, view.players) === player.id;
  // The cups of the loser and the bonus winner come back down so the die can leave / enter them.
  const settledHere = reveal !== null && reveal.stage.settled && (isLoser || gainsDie);
  const lifted = hand !== null && !settledHere;

  const seatClasses = [
    'seat',
    isTurn ? 'seat--turn' : '',
    isMe ? 'seat--me' : '',
    isLoser ? 'seat--loser' : '',
    isBonus ? 'seat--bonus' : '',
    player.connected ? '' : 'seat--offline',
  ];
  const cupClasses = [
    'seat__cup',
    bidding !== null ? 'seat__cup--shake' : '', // plays once when a new round mounts the seat
    lifted ? 'seat__cup--lifted' : '',
    count === 0 ? 'seat__cup--out' : '',
    gainsDie && reveal !== null && reveal.stage.bonusLanded ? 'seat__cup--bump' : '',
  ];

  return (
    <div className={seatClasses.join(' ')} style={style}>
      <div className="seat__spot">
        {hand !== null && (
          <span className={`seat__dice ${lifted ? '' : 'seat__dice--covered'}`}>
            {hand.dice.map((face, index) => (
              <span key={index} className="seat__die" style={{ animationDelay: `${index * 40}ms` }}>
                <Die
                  face={face}
                  size={15}
                  theme={theme}
                  highlighted={hand.counts[index]}
                  dimmed={!hand.counts[index]}
                />
              </span>
            ))}
          </span>
        )}
        <span className={cupClasses.join(' ')}>
          <Cup theme={theme} size={54} />
          {count > 0 && <CountBadge count={count} />}
        </span>
        {player.isHost && (
          <span className="seat__crown" title="Host">
            👑
          </span>
        )}
        <span className="seat__tags">
          {bidding !== null && bidding.bidderId === player.id && <span className="pill pill--bid">bid</span>}
          {bidding !== null && bidding.katzelCallerId === player.id && <span className="pill pill--katzel">🤞</span>}
          {!player.connected && <span className="pill pill--offline">offline</span>}
        </span>
        <span className="seat__reactions" aria-live="polite">
          {reactions.map((reaction) => (
            <span key={reaction.id} className="bubble">
              {reaction.emoji}
            </span>
          ))}
        </span>
      </div>
      {isTurn && bidding !== null ? (
        <TurnName key={bidding.seq} label={isMe ? 'You' : player.name} remainingMs={bidding.turnRemainingMs} />
      ) : (
        <span className="seat__name">
          {count === 0 ? `${isMe ? 'You' : player.name} · out` : isMe ? 'You' : player.name}
        </span>
      )}
    </div>
  );
}

/** Name pill of the player whose turn it is, with the turn timer draining inside it. */
function TurnName({ label, remainingMs }: { label: string; remainingMs: number }) {
  const left = useCountdown(remainingMs);
  return (
    <span className={`seat__name seat__name--turn ${left < 10_000 ? 'seat__name--urgent' : ''}`}>
      <span className="seat__name-timer" style={{ transform: `scaleX(${left / TURN_DURATION_MS})` }} />
      <span className="seat__name-text">{label}</span>
    </span>
  );
}

/** Dice left for a player, with a "−1" / "+1" that floats away whenever it changes. */
function CountBadge({ count }: { count: number }) {
  const previous = useRef(count);
  const [change, setChange] = useState<{ id: number; delta: number } | null>(null);

  useEffect(() => {
    if (count === previous.current) return;
    setChange({ id: performance.now(), delta: count - previous.current });
    previous.current = count;
  }, [count]);

  return (
    <>
      <span key={count} className="count-badge" aria-label={`${count} ${count === 1 ? 'die' : 'dice'} left`}>
        {count}
      </span>
      {change !== null && (
        <span
          key={change.id}
          className={`count-delta ${change.delta < 0 ? 'count-delta--minus' : 'count-delta--plus'}`}
        >
          {change.delta > 0 ? `+${change.delta}` : change.delta}
        </span>
      )}
    </>
  );
}

// ── Flying dice ─────────────────────────────────────────────────────────────

/** The loser's die pops out of their cup and leaves; a bonus die flies from the middle into its cup. */
function DieFlights({ view, reveal, myIndex }: { view: InGameView; reveal: TableReveal; myIndex: number }) {
  const { loserId, dice } = reveal.summary;
  const gainerId = bonusDieGainer(reveal.summary, view.players);
  const flight = (playerId: string, direction: 'out' | 'in', face: Face) => {
    const index = view.players.findIndex((player) => player.id === playerId);
    const position = (index - myIndex + view.players.length) % view.players.length;
    return (
      <span
        key={`${direction}-${playerId}`}
        className={`flying-die flying-die--${direction}`}
        style={seatPosition(position, view.players.length)}
        aria-hidden="true"
      >
        <Die face={face} size={26} theme={playerTheme(view.players, playerId)} />
      </span>
    );
  };
  const loserDice = dice[loserId];
  if (loserDice === undefined) throw new Error(`Reveal is missing dice for ${loserId}`);
  const lostFace = loserDice[loserDice.length - 1];
  if (lostFace === undefined) throw new Error('The loser had no dice to lose.');
  return (
    <>
      {flight(loserId, 'out', lostFace)}
      {gainerId !== null && flight(gainerId, 'in', 1)}
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Seat `position` (0 = viewer at the bottom) on an ellipse, going clockwise on screen.
 * CSS turns --sx/--sy (unit circle) into left/top inside the table.
 */
function seatPosition(position: number, seatCount: number): CSSProperties {
  const angle = ((90 + (position * 360) / seatCount) * Math.PI) / 180;
  return { '--sx': Math.cos(angle).toFixed(4), '--sy': Math.sin(angle).toFixed(4) } as CSSProperties;
}

/** The player's dice once their cup has been lifted in the reveal (null while still covered). */
function revealedHand(reveal: TableReveal, playerId: string): { dice: Face[]; counts: boolean[] } | null {
  const order = reveal.stage.hands.findIndex((hand) => hand.playerId === playerId);
  if (order === -1 || order >= reveal.stage.handsShown) return null;
  const dice = reveal.summary.dice[playerId];
  if (dice === undefined) throw new Error(`Reveal is missing dice for ${playerId}`);
  return { dice, counts: dice.map((face) => countMatchingDice([face], reveal.summary.bid.face) === 1) };
}

/**
 * The server already applied the round's result, so during a reveal the badge shows the dice the player
 * rolled until the verdict is played out at the table (then the real count, animating the change).
 */
function displayedDiceCount(player: PublicPlayer, reveal: TableReveal | null): number {
  if (reveal === null) return player.diceCount;
  const rolled = reveal.summary.dice[player.id];
  if (rolled === undefined) throw new Error(`Reveal is missing dice for ${player.id}`);
  const { settled, bonusLanded } = reveal.stage;
  // The bonus die only counts once it has landed in the cup.
  const applied = player.id === reveal.summary.bonusPlayerId ? bonusLanded : settled;
  return applied ? player.diceCount : rolled.length;
}
