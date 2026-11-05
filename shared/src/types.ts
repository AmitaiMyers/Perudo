export type Face = 1 | 2 | 3 | 4 | 5 | 6;

/** "At least `quantity` dice showing `face` on the whole table" (Pacos count as wild unless face is Paco). */
export interface Bid {
  quantity: number;
  face: Face;
}

export interface PublicPlayer {
  id: string;
  name: string;
  diceCount: number;
  connected: boolean;
  isHost: boolean;
  eliminated: boolean;
}

/** Actions that keep the round going (a Liar call ends the round and produces a reveal instead). */
export type ActionKind = 'raise' | 'katzel';

/** The most recent table action, shown to everyone so interruptions are visible. */
export interface ActionNotice {
  kind: ActionKind;
  playerId: string;
  /** The bid that was made (raise) or that the Katzel was called on. */
  bid: Bid;
  /** True when the player acted out of turn (jumped in). */
  interruption: boolean;
  /** True when the server acted on the player's behalf because their timer ran out. */
  forcedByTimeout: boolean;
}

export interface RevealSummary {
  /** Every player's dice for the round, keyed by player id. */
  dice: Record<string, Face[]>;
  bid: Bid;
  bidderId: string;
  katzelCallerId: string | null;
  liarCallerId: string;
  interruption: boolean;
  forcedByTimeout: boolean;
  actualCount: number;
  liarWasCorrect: boolean;
  loserId: string;
  /** Interrupting Liar caller who was correct and regained a die (null if none). */
  bonusPlayerId: string | null;
}

interface RoomViewBase {
  roomCode: string;
  myPlayerId: string;
  /** Players in seat order; play proceeds through this list (clockwise). */
  players: PublicPlayer[];
}

export interface LobbyView extends RoomViewBase {
  phase: 'lobby';
}

export interface BiddingView extends RoomViewBase {
  phase: 'bidding';
  roundNumber: number;
  /** Increments on every state change; actions must echo it to avoid acting on a stale bid. */
  seq: number;
  currentBid: Bid | null;
  bidderId: string | null;
  katzelCallerId: string | null;
  /**
   * Set in a last-die round: the player who just dropped to one die. Only they may open, and every
   * bid in the round keeps the opening bid's face.
   */
  lastDiePlayerId: string | null;
  turnPlayerId: string;
  turnRemainingMs: number;
  myDice: Face[];
  lastAction: ActionNotice | null;
}

export interface RevealView extends RoomViewBase {
  phase: 'reveal';
  roundNumber: number;
  reveal: RevealSummary;
  nextRoundInMs: number;
}

export interface GameOverView extends RoomViewBase {
  phase: 'gameOver';
  winnerId: string;
  reveal: RevealSummary;
}

export type RoomView = LobbyView | BiddingView | RevealView | GameOverView;

/** A short-lived emoji shown over a player's seat. Not part of the room state. */
export interface Reaction {
  /** Unique within the room, so clients can key and expire each bubble. */
  id: number;
  playerId: string;
  emoji: string;
}

/** One line of table talk. The sender's name is copied in so history still reads after they leave. */
export interface ChatMessage {
  /** Increasing within the room; clients use it for keys and unread tracking. */
  id: number;
  playerId: string;
  name: string;
  text: string;
}

export interface SessionInfo {
  roomCode: string;
  playerId: string;
  /** Secret used to reclaim a seat after a refresh or dropped connection. */
  token: string;
}

export type AckResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
export type Ack<T extends object = object> = (result: AckResult<T>) => void;

export interface ClientToServerEvents {
  'room:create': (payload: { name: string }, ack: Ack<{ session: SessionInfo }>) => void;
  'room:join': (payload: { roomCode: string; name: string }, ack: Ack<{ session: SessionInfo }>) => void;
  'room:resume': (payload: SessionInfo, ack: Ack) => void;
  'room:leave': (ack: Ack) => void;
  'game:start': (ack: Ack) => void;
  'game:raise': (payload: { bid: Bid; seq: number }, ack: Ack) => void;
  'game:katzel': (payload: { seq: number }, ack: Ack) => void;
  'game:liar': (payload: { seq: number }, ack: Ack) => void;
  'game:rematch': (ack: Ack) => void;
  'room:react': (payload: { emoji: string }, ack: Ack) => void;
  'chat:send': (payload: { text: string }, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
  'room:reaction': (reaction: Reaction) => void;
  /** A new message for everyone in the room. */
  'chat:message': (message: ChatMessage) => void;
  /** The room's recent messages, sent to a player when they join or reconnect. */
  'chat:history': (messages: ChatMessage[]) => void;
}
