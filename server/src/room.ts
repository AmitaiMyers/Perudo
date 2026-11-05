import { randomInt, randomUUID } from 'node:crypto';
import {
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_LIMIT,
  CHAT_MESSAGE_MAX_LENGTH,
  MAX_DICE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_MAX_LENGTH,
  REACTION_COOLDOWN_MS,
  REACTION_EMOJIS,
  type Bid,
  type ChatMessage,
  type Face,
  type PublicPlayer,
  type Reaction,
  type RoomView,
  type SessionInfo,
} from '@perudo/shared';
import { Game, type ActionResult } from './game';

/** A lobby seat whose player disconnected is freed after this long. */
const LOBBY_RECONNECT_GRACE_MS = 30_000;
/** A room with nobody connected is deleted after this long. */
const IDLE_ROOM_TTL_MS = 10 * 60_000;

interface Member {
  readonly id: string;
  readonly name: string;
  readonly token: string;
  socketId: string | null;
  lobbyRemovalTimer: NodeJS.Timeout | null;
  lastReactionAt: number;
  lastChatAt: number;
}

export interface RoomHooks {
  emitState: (socketId: string, view: RoomView) => void;
  emitReaction: (socketId: string, reaction: Reaction) => void;
  emitChat: (socketId: string, message: ChatMessage) => void;
  emitChatHistory: (socketId: string, messages: ChatMessage[]) => void;
  /** Called once the room should be forgotten (everyone left or went idle). */
  onClosed: (roomCode: string) => void;
}

export class Room {
  private members: Member[] = [];
  private hostId: string | null = null;
  private game: Game | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private nextReactionId = 1;
  private chatLog: ChatMessage[] = [];
  private nextChatId = 1;

  constructor(
    readonly code: string,
    private readonly hooks: RoomHooks,
  ) {}

  // ── Membership ────────────────────────────────────────────────────────────

  /** Adds a player and returns their session, or an error message. */
  join(rawName: unknown, socketId: string): SessionInfo | string {
    if (this.game !== null) return 'This game has already started.';
    if (this.members.length >= MAX_PLAYERS) return `This room is full (${MAX_PLAYERS} players max).`;
    const name = normalizeName(rawName);
    if (name === null) return `Name must be 1-${NAME_MAX_LENGTH} characters.`;
    const nameTaken = this.members.some((member) => member.name.toLowerCase() === name.toLowerCase());
    if (nameTaken) return 'That name is already taken in this room.';

    const member: Member = {
      id: randomUUID(),
      name,
      token: randomUUID(),
      socketId,
      lobbyRemovalTimer: null,
      lastReactionAt: 0,
      lastChatAt: 0,
    };
    this.members.push(member);
    this.handOverHostIfAbsent();
    this.cancelIdleTimer();
    this.broadcast();
    this.hooks.emitChatHistory(socketId, this.chatLog);
    return { roomCode: this.code, playerId: member.id, token: member.token };
  }

  /** Re-attaches a socket to an existing seat. Returns an error message or null. */
  resume(playerId: string, token: string, socketId: string): string | null {
    const member = this.members.find((candidate) => candidate.id === playerId);
    if (member === undefined || member.token !== token) return 'Your seat in this room no longer exists.';
    member.socketId = socketId;
    clearTimer(member.lobbyRemovalTimer);
    member.lobbyRemovalTimer = null;
    this.handOverHostIfAbsent();
    this.cancelIdleTimer();
    this.broadcast();
    this.hooks.emitChatHistory(socketId, this.chatLog);
    return null;
  }

  /** Called when the player's socket drops. Their seat is kept so they can resume. */
  disconnect(playerId: string, socketId: string): void {
    const member = this.requireMember(playerId);
    if (member.socketId !== socketId) return; // A newer tab already took over this seat.
    member.socketId = null;
    if (this.game === null) {
      member.lobbyRemovalTimer = setTimeout(() => this.removeMember(member.id), LOBBY_RECONNECT_GRACE_MS);
    }
    this.handOverHostIfAbsent();
    this.startIdleTimerIfEmpty();
    this.broadcast();
  }

  /** Explicit leave: frees a lobby seat; during a game the seat stays and the timer plays for it. */
  leave(playerId: string): void {
    if (this.game === null) {
      this.removeMember(playerId);
      return;
    }
    const member = this.requireMember(playerId);
    member.socketId = null;
    this.handOverHostIfAbsent();
    this.startIdleTimerIfEmpty();
    this.broadcast();
  }

  /** Floats an emoji over the player's seat for everyone in the room. */
  react(playerId: string, emoji: unknown): string | null {
    if (typeof emoji !== 'string' || !(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
      return 'Unknown reaction.';
    }
    const member = this.requireMember(playerId);
    const now = Date.now();
    if (now - member.lastReactionAt < REACTION_COOLDOWN_MS) return 'Easy there! One reaction per second.';
    member.lastReactionAt = now;
    const reaction: Reaction = { id: this.nextReactionId, playerId, emoji };
    this.nextReactionId += 1;
    this.forEachConnectedSocket((socketId) => this.hooks.emitReaction(socketId, reaction));
    return null;
  }

  /** Posts a chat message to everyone in the room and keeps it in the recent history. */
  sendChat(playerId: string, rawText: unknown): string | null {
    const text = normalizeChatText(rawText);
    if (text === null) return `Messages must be 1-${CHAT_MESSAGE_MAX_LENGTH} characters.`;
    const member = this.requireMember(playerId);
    const now = Date.now();
    if (now - member.lastChatAt < CHAT_COOLDOWN_MS) return 'Slow down a little!';
    member.lastChatAt = now;
    const message: ChatMessage = { id: this.nextChatId, playerId, name: member.name, text };
    this.nextChatId += 1;
    this.chatLog = [...this.chatLog, message].slice(-CHAT_HISTORY_LIMIT);
    this.forEachConnectedSocket((socketId) => this.hooks.emitChat(socketId, message));
    return null;
  }

  // ── Game lifecycle ────────────────────────────────────────────────────────

  start(playerId: string): string | null {
    if (playerId !== this.hostId) return 'Only the host can start the game.';
    if (this.game !== null) return 'The game has already started.';
    if (this.members.length < MIN_PLAYERS) return `At least ${MIN_PLAYERS} players are needed.`;
    this.beginGame();
    return null;
  }

  /** Host restarts a finished game with every player who is still connected. */
  rematch(playerId: string): string | null {
    if (playerId !== this.hostId) return 'Only the host can start a rematch.';
    if (this.game === null || this.game.phase.kind !== 'gameOver') return 'The current game is not over yet.';
    const connected = this.members.filter((member) => member.socketId !== null);
    if (connected.length < MIN_PLAYERS) return `At least ${MIN_PLAYERS} connected players are needed.`;
    this.members = connected;
    this.beginGame();
    return null;
  }

  raise(playerId: string, bid: Bid, seq: number): ActionResult {
    return this.applyGameAction((game) => game.raise(playerId, bid, seq));
  }

  katzel(playerId: string, seq: number): ActionResult {
    return this.applyGameAction((game) => game.katzel(playerId, seq));
  }

  liar(playerId: string, seq: number): ActionResult {
    return this.applyGameAction((game) => game.liar(playerId, seq));
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private beginGame(): void {
    // Seats are kept for the whole game, so pending lobby removals must not fire mid-game.
    for (const member of this.members) {
      clearTimer(member.lobbyRemovalTimer);
      member.lobbyRemovalTimer = null;
    }
    const seatOrder = this.members.map((member) => member.id);
    const starterId = seatOrder[randomInt(seatOrder.length)];
    if (starterId === undefined) throw new Error('Cannot start a game without players.');
    this.game = new Game(seatOrder, starterId, {
      rollDie: () => randomInt(1, 7) as Face,
      now: Date.now,
    });
    this.afterGameChange();
  }

  private applyGameAction(action: (game: Game) => ActionResult): ActionResult {
    if (this.game === null) return 'The game has not started.';
    const error = action(this.game);
    if (error === null) this.afterGameChange();
    return error;
  }

  /** Re-arms the single phase timer (turn timeout or end of reveal) and pushes fresh state. */
  private afterGameChange(): void {
    const game = this.requireGame();
    clearTimer(this.phaseTimer);
    this.phaseTimer = null;
    const phase = game.phase;
    if (phase.kind === 'bidding') {
      this.phaseTimer = setTimeout(() => {
        game.handleTurnTimeout();
        this.afterGameChange();
      }, phase.round.turnDeadline - Date.now());
    } else if (phase.kind === 'reveal') {
      this.phaseTimer = setTimeout(() => {
        game.startNextRound();
        this.afterGameChange();
      }, phase.revealEndsAt - Date.now());
    }
    this.broadcast();
  }

  private removeMember(playerId: string): void {
    const member = this.requireMember(playerId);
    clearTimer(member.lobbyRemovalTimer);
    this.members = this.members.filter((candidate) => candidate.id !== playerId);
    if (this.members.length === 0) {
      this.close();
      return;
    }
    this.handOverHostIfAbsent();
    this.startIdleTimerIfEmpty();
    this.broadcast();
  }

  /** Makes the first connected member host when the current host is gone or offline. */
  private handOverHostIfAbsent(): void {
    const host = this.members.find((member) => member.id === this.hostId);
    if (host !== undefined && host.socketId !== null) return;
    const replacement = this.members.find((member) => member.socketId !== null);
    if (replacement !== undefined) this.hostId = replacement.id;
  }

  private startIdleTimerIfEmpty(): void {
    const anyoneConnected = this.members.some((member) => member.socketId !== null);
    if (anyoneConnected || this.idleTimer !== null) return;
    this.idleTimer = setTimeout(() => this.close(), IDLE_ROOM_TTL_MS);
  }

  private cancelIdleTimer(): void {
    clearTimer(this.idleTimer);
    this.idleTimer = null;
  }

  private close(): void {
    clearTimer(this.phaseTimer);
    this.cancelIdleTimer();
    for (const member of this.members) clearTimer(member.lobbyRemovalTimer);
    this.hooks.onClosed(this.code);
  }

  private broadcast(): void {
    this.forEachConnectedSocket((socketId, member) => this.hooks.emitState(socketId, this.buildView(member.id)));
  }

  private forEachConnectedSocket(send: (socketId: string, member: Member) => void): void {
    for (const member of this.members) {
      if (member.socketId !== null) send(member.socketId, member);
    }
  }

  private buildView(viewerId: string): RoomView {
    const base = { roomCode: this.code, myPlayerId: viewerId, players: this.publicPlayers() };
    if (this.game === null) return { ...base, phase: 'lobby' };
    const phase = this.game.phase;
    switch (phase.kind) {
      case 'bidding': {
        const { round } = phase;
        return {
          ...base,
          phase: 'bidding',
          roundNumber: round.number,
          seq: this.game.seq,
          currentBid: round.currentBid,
          bidderId: round.bidderId,
          katzelCallerId: round.katzelCallerId,
          turnPlayerId: round.turnPlayerId,
          turnRemainingMs: Math.max(0, round.turnDeadline - Date.now()),
          myDice: this.game.diceOf(viewerId),
          lastAction: round.lastAction,
        };
      }
      case 'reveal':
        return {
          ...base,
          phase: 'reveal',
          roundNumber: phase.roundNumber,
          reveal: phase.reveal,
          nextRoundInMs: Math.max(0, phase.revealEndsAt - Date.now()),
        };
      case 'gameOver':
        return { ...base, phase: 'gameOver', winnerId: phase.winnerId, reveal: phase.reveal };
    }
  }

  private publicPlayers(): PublicPlayer[] {
    return this.members.map((member) => {
      const diceCount = this.game === null ? MAX_DICE : this.game.diceCountOf(member.id);
      return {
        id: member.id,
        name: member.name,
        diceCount,
        connected: member.socketId !== null,
        isHost: member.id === this.hostId,
        eliminated: diceCount === 0,
      };
    });
  }

  private requireMember(playerId: string): Member {
    const member = this.members.find((candidate) => candidate.id === playerId);
    if (member === undefined) throw new Error(`Player ${playerId} is not in room ${this.code}.`);
    return member;
  }

  private requireGame(): Game {
    if (this.game === null) throw new Error(`Room ${this.code} has no game.`);
    return this.game;
  }
}

function normalizeName(rawName: unknown): string | null {
  if (typeof rawName !== 'string') return null;
  const name = rawName.trim();
  return name.length >= 1 && name.length <= NAME_MAX_LENGTH ? name : null;
}

/** Trims the message and turns control characters (newlines, tabs…) into spaces; null if empty or too long. */
function normalizeChatText(rawText: unknown): string | null {
  if (typeof rawText !== 'string') return null;
  const text = rawText.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  return text.length >= 1 && text.length <= CHAT_MESSAGE_MAX_LENGTH ? text : null;
}

function clearTimer(timer: NodeJS.Timeout | null): void {
  if (timer !== null) clearTimeout(timer);
}
