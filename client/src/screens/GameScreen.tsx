import { useEffect, type ReactNode } from 'react';
import type { BiddingView, GameOverView, RevealView } from '@perudo/shared';
import { ActionPanel } from '../components/ActionPanel';
import { Avatar } from '../components/Avatar';
import { BidText } from '../components/BidText';
import { ChatButton } from '../components/ChatButton';
import { Confetti } from '../components/Confetti';
import { HowToPlay } from '../components/HowToPlay';
import { Icon } from '../components/Icon';
import { MyDice } from '../components/MyDice';
import { ReactionPicker } from '../components/ReactionPicker';
import { RevealCounter, RevealSummary } from '../components/RevealSummary';
import { SoundToggle } from '../components/SoundToggle';
import { Table, type InGameView } from '../components/Table';
import { TurnTimer } from '../components/TurnTimer';
import { describeActionTags, findPlayer, playerName, playerTheme } from '../players';
import { playSound } from '../sound';
import { useCountdown } from '../useCountdown';
import { useGameEffects } from '../useGameEffects';
import { useRevealStage } from '../useRevealStage';
import type { ChatController } from '../useChat';
import type { RoomController } from '../useRoom';

/** Delay after the final die animation before the winner celebration starts. */
const CELEBRATION_DELAY_MS = 600;

export function GameScreen({ view, room, chat }: { view: InGameView; room: RoomController; chat: ChatController }) {
  useGameEffects(view);
  if (view.phase === 'bidding') return <BiddingLayout view={view} room={room} chat={chat} />;
  if (view.phase === 'reveal') return <RevealLayout key={view.roundNumber} view={view} room={room} chat={chat} />;
  return <GameOverLayout view={view} room={room} chat={chat} />;
}

// ── Layouts per phase ───────────────────────────────────────────────────────

function BiddingLayout({ view, room, chat }: { view: BiddingView; room: RoomController; chat: ChatController }) {
  const me = findPlayer(view.players, view.myPlayerId);
  const isMyTurn = view.turnPlayerId === view.myPlayerId;

  return (
    <GameFrame
      view={view}
      room={room}
      chat={chat}
      status={`Round ${view.roundNumber}`}
      table={
        <Table
          view={view}
          reactions={room.reactions}
          speech={chat.bubbles}
          reveal={null}
          center={<BidCenter view={view} />}
        />
      }
      bottom={
        <div className={`dock ${isMyTurn ? 'dock--my-turn' : ''}`}>
          <div className="dock__turn">
            {isMyTurn ? (
              <span className="your-turn">Your turn!</span>
            ) : (
              <span className="dock__whose">
                <Avatar players={view.players} playerId={view.turnPlayerId} size={22} />
                {playerName(view.players, view.turnPlayerId)}&rsquo;s turn
                {!me.eliminated && <span className="dock__jump"> · jump in ⚡</span>}
              </span>
            )}
            <TurnTimer key={view.seq} remainingMs={view.turnRemainingMs} isMyTurn={isMyTurn} />
          </div>
          {me.eliminated ? (
            <p className="notice">You are out of dice. Enjoy the show 🍿</p>
          ) : (
            <>
              <MyDice key={view.roundNumber} dice={view.myDice} theme={playerTheme(view.players, view.myPlayerId)} />
              <ActionPanel
                view={view}
                onRaise={(bid) => room.raise(bid, view.seq)}
                onKatzel={() => room.katzel(view.seq)}
                onLiar={() => room.liar(view.seq)}
              />
            </>
          )}
        </div>
      }
    />
  );
}

function RevealLayout({ view, room, chat }: { view: RevealView; room: RoomController; chat: ChatController }) {
  const stage = useRevealStage(view.reveal, view.players, view.myPlayerId, `round-${view.roundNumber}`);
  const left = useCountdown(view.nextRoundInMs);
  return (
    <GameFrame
      view={view}
      room={room}
      chat={chat}
      status={`Next round ${Math.ceil(left / 1000)}s`}
      table={
        <Table
          view={view}
          reactions={room.reactions}
          speech={chat.bubbles}
          reveal={{ summary: view.reveal, stage }}
          center={<RevealCounter reveal={view.reveal} stage={stage} />}
        />
      }
      bottom={
        <div className="dock dock--summary">
          <RevealSummary reveal={view.reveal} players={view.players} stage={stage} />
        </div>
      }
    />
  );
}

function GameOverLayout({ view, room, chat }: { view: GameOverView; room: RoomController; chat: ChatController }) {
  const stage = useRevealStage(view.reveal, view.players, view.myPlayerId, 'final');
  const isHost = findPlayer(view.players, view.myPlayerId).isHost;
  const iWon = view.winnerId === view.myPlayerId;
  // The winner is celebrated once the last die has left the loser's cup.
  const celebrate = stage.settled;

  useEffect(() => {
    if (!celebrate || !iWon) return;
    const timeout = window.setTimeout(() => playSound('fanfare'), CELEBRATION_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [celebrate, iWon]);

  return (
    <GameFrame
      view={view}
      room={room}
      chat={chat}
      status="Game over"
      table={
        <Table
          view={view}
          reactions={room.reactions}
          speech={chat.bubbles}
          reveal={{ summary: view.reveal, stage }}
          center={
            celebrate ? (
              <div className="center-winner" role="status">
                <span className="center-winner__trophy">🏆</span>
                <span className="center-winner__name">
                  {iWon ? 'You win!' : `${playerName(view.players, view.winnerId)} wins!`}
                </span>
              </div>
            ) : (
              <RevealCounter reveal={view.reveal} stage={stage} />
            )
          }
        />
      }
      bottom={
        <div className="dock dock--summary">
          <RevealSummary reveal={view.reveal} players={view.players} stage={stage} />
          {isHost ? (
            <button type="button" className="button button--primary button--block" onClick={room.rematch}>
              Rematch 🎲
            </button>
          ) : (
            <p className="dock__next">Waiting for the host to start a rematch…</p>
          )}
          {celebrate && <Confetti />}
        </div>
      }
    />
  );
}

// ── Shared pieces ───────────────────────────────────────────────────────────

interface GameFrameProps {
  view: InGameView;
  room: RoomController;
  chat: ChatController;
  /** Short text in the top bar pill (round number, next-round countdown…). */
  status: string;
  table: ReactNode;
  /** Bottom area: the player's controls while bidding, the round summary otherwise. */
  bottom: ReactNode;
}

/** Top bar, the round table, and a bottom area that changes with the phase. */
function GameFrame({ view, room, chat, status, table, bottom }: GameFrameProps) {
  const confirmLeave = () => {
    const message =
      view.phase === 'gameOver'
        ? 'Leave this room?'
        : 'Leave the game? Your seat stays at the table and the timer will act for you.';
    if (window.confirm(message)) room.leaveRoom();
  };

  return (
    <main className="game">
      <header className="topbar">
        <span className="topbar__room">
          <span className="topbar__room-label">Room </span>
          <strong>{view.roomCode}</strong>
        </span>
        <span className="topbar__round">{status}</span>
        <span className="topbar__actions">
          <ChatButton chat={chat} players={view.players} myPlayerId={view.myPlayerId} />
          <ReactionPicker onReact={room.react} />
          <SoundToggle />
          <HowToPlay variant="icon" />
          <button type="button" className="icon-button" onClick={confirmLeave} aria-label="Leave room">
            <Icon name="exit" />
          </button>
        </span>
      </header>
      {table}
      {bottom}
    </main>
  );
}

/** Middle of the table while bidding: the bid to beat, a pending Katzel, and how many dice are in play. */
function BidCenter({ view }: { view: BiddingView }) {
  const { currentBid, bidderId, lastAction } = view;
  const totalDice = view.players.reduce((total, player) => total + player.diceCount, 0);
  const nameOrYou = (playerId: string) => (playerId === view.myPlayerId ? 'You' : playerName(view.players, playerId));

  return (
    <div className="center-bid" aria-live="polite">
      {currentBid === null || bidderId === null ? (
        <>
          <span className="center-bid__who">{nameOrYou(view.turnPlayerId)} to open</span>
          <span className="center-bid__hint">no Pacos on the first bid</span>
        </>
      ) : (
        <>
          <span className="center-bid__who">
            {nameOrYou(bidderId)} bid
            {lastAction !== null && lastAction.kind === 'raise' && (
              <span className="center-bid__tags">
                {describeActionTags(lastAction.interruption, lastAction.forcedByTimeout)}
              </span>
            )}
          </span>
          <span key={`${currentBid.quantity}x${currentBid.face}`} className="center-bid__bid">
            <BidText bid={currentBid} dieSize={30} />
          </span>
        </>
      )}
      {view.katzelCallerId !== null && (
        <span className="center-bid__katzel">🤞 {nameOrYou(view.katzelCallerId)}: Katzel (exact)</span>
      )}
      <span className="center-bid__total">🎲 {totalDice} dice in play</span>
    </div>
  );
}
