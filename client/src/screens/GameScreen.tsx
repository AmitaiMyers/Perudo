import type { ActionNotice, BiddingView, GameOverView, PublicPlayer, RevealView } from '@perudo/shared';
import { ActionPanel } from '../components/ActionPanel';
import { BidText } from '../components/BidText';
import { Die } from '../components/Die';
import { PlayerSeat } from '../components/PlayerSeat';
import { RevealPanel } from '../components/RevealPanel';
import { TurnTimer } from '../components/TurnTimer';
import { describeActionTags, findPlayer, playerName } from '../players';
import { useCountdown } from '../useCountdown';
import type { RoomController } from '../useRoom';

type InGameView = BiddingView | RevealView | GameOverView;

export function GameScreen({ view, room }: { view: InGameView; room: RoomController }) {
  const confirmLeave = () => {
    const message =
      view.phase === 'gameOver'
        ? 'Leave this room?'
        : 'Leave the game? Your seat stays at the table and the timer will act for you.';
    if (window.confirm(message)) room.leaveRoom();
  };

  return (
    <main className="screen game">
      <header className="game__header">
        <span>
          Room <strong>{view.roomCode}</strong>
        </span>
        {view.phase !== 'gameOver' && <span>Round {view.roundNumber}</span>}
        <button type="button" className="button button--ghost button--small" onClick={confirmLeave}>
          Leave
        </button>
      </header>

      <SeatList view={view} />

      {view.phase === 'bidding' && <BiddingPhase view={view} room={room} />}
      {view.phase === 'reveal' && <RevealPhase view={view} />}
      {view.phase === 'gameOver' && <GameOverPhase view={view} room={room} />}
    </main>
  );
}

function SeatList({ view }: { view: InGameView }) {
  const bidding = view.phase === 'bidding' ? view : null;
  return (
    <ul className="seats">
      {view.players.map((player) => (
        <PlayerSeat
          key={player.id}
          player={player}
          isMe={player.id === view.myPlayerId}
          isTurn={bidding !== null && bidding.turnPlayerId === player.id}
          isBidder={bidding !== null && bidding.bidderId === player.id}
          isKatzelCaller={bidding !== null && bidding.katzelCallerId === player.id}
        />
      ))}
    </ul>
  );
}

function BiddingPhase({ view, room }: { view: BiddingView; room: RoomController }) {
  const turnName = playerName(view.players, view.turnPlayerId);
  const isMyTurn = view.turnPlayerId === view.myPlayerId;
  const me = findPlayer(view.players, view.myPlayerId);

  return (
    <>
      <section className="table-center" aria-live="polite">
        {view.currentBid === null || view.bidderId === null ? (
          <p className="table-center__waiting">Waiting for the opening bid…</p>
        ) : (
          <>
            <p className="table-center__label">Current bid by {playerName(view.players, view.bidderId)}</p>
            <span className="table-center__bid">
              <BidText bid={view.currentBid} dieSize={44} />
            </span>
          </>
        )}
        {view.katzelCallerId !== null && (
          <p className="table-center__katzel">
            {playerName(view.players, view.katzelCallerId)} called Katzel: a Liar call will now check for an{' '}
            <strong>exact</strong> count.
          </p>
        )}
        {view.lastAction !== null && (
          <p className="table-center__last">{describeNotice(view.lastAction, view.players)}</p>
        )}
      </section>

      <section className="turn">
        <p className="turn__who">{isMyTurn ? 'Your turn!' : `${turnName}'s turn`}</p>
        <TurnTimer key={view.seq} remainingMs={view.turnRemainingMs} />
      </section>

      {me.eliminated ? (
        <p className="notice">You are out of dice. Watch the rest of the game!</p>
      ) : (
        <>
          <section className="my-dice" aria-label="Your dice (only you can see them)">
            {view.myDice.map((face, index) => (
              <Die key={index} face={face} size={52} />
            ))}
          </section>
          <ActionPanel
            view={view}
            onRaise={(quantity, face) => room.raise({ quantity, face }, view.seq)}
            onKatzel={() => room.katzel(view.seq)}
            onLiar={() => room.liar(view.seq)}
          />
        </>
      )}
    </>
  );
}

function RevealPhase({ view }: { view: RevealView }) {
  const left = useCountdown(view.nextRoundInMs);
  return (
    <>
      <RevealPanel reveal={view.reveal} players={view.players} />
      <p className="notice">Next round in {Math.ceil(left / 1000)}s…</p>
    </>
  );
}

function GameOverPhase({ view, room }: { view: GameOverView; room: RoomController }) {
  const isHost = findPlayer(view.players, view.myPlayerId).isHost;
  const iWon = view.winnerId === view.myPlayerId;
  return (
    <>
      <section className="winner">
        <p className="winner__title">{iWon ? 'You win!' : `${playerName(view.players, view.winnerId)} wins!`}</p>
      </section>
      <RevealPanel reveal={view.reveal} players={view.players} />
      {isHost ? (
        <button type="button" className="button button--primary" onClick={room.rematch}>
          Rematch with everyone still here
        </button>
      ) : (
        <p className="notice">Waiting for the host to start a rematch…</p>
      )}
    </>
  );
}

function describeNotice(notice: ActionNotice, players: PublicPlayer[]) {
  const actor = playerName(players, notice.playerId);
  const suffix = describeActionTags(notice.interruption, notice.forcedByTimeout);
  return (
    <>
      {actor} {notice.kind === 'katzel' ? 'called Katzel on' : 'bid'} <BidText bid={notice.bid} dieSize={18} />
      {suffix}
    </>
  );
}
