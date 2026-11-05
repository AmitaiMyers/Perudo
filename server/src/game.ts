import {
  MAX_DICE,
  MINIMUM_OPENING_BID,
  REVEAL_DURATION_MS,
  TURN_DURATION_MS,
  automaticRaise,
  describeIllegalBid,
  resolveShowdown,
  type ActionNotice,
  type Bid,
  type Face,
  type RevealSummary,
} from '@perudo/shared';

export interface GameDependencies {
  rollDie: () => Face;
  now: () => number;
}

interface GamePlayer {
  readonly id: string;
  diceCount: number;
  dice: Face[];
}

export interface RoundState {
  number: number;
  currentBid: Bid | null;
  bidderId: string | null;
  katzelCallerId: string | null;
  turnPlayerId: string;
  turnDeadline: number;
  lastAction: ActionNotice | null;
}

export type GamePhase =
  | { kind: 'bidding'; round: RoundState }
  | { kind: 'reveal'; roundNumber: number; reveal: RevealSummary; revealEndsAt: number; nextStarterId: string }
  | { kind: 'gameOver'; reveal: RevealSummary; winnerId: string };

/** Error message returned to the acting player, or null when the action was applied. */
export type ActionResult = string | null;

/**
 * Authoritative state machine for one game. It owns no timers: the room reads
 * `turnDeadline` / `revealEndsAt` and calls `handleTurnTimeout` / `startNextRound`.
 */
export class Game {
  private readonly players: GamePlayer[];
  private currentPhase: GamePhase;
  /** Increments on every state change so clients cannot act on a bid they have not seen. */
  private sequence = 0;

  constructor(
    seatOrder: readonly string[],
    starterId: string,
    private readonly deps: GameDependencies,
  ) {
    this.players = seatOrder.map((id) => ({ id, diceCount: MAX_DICE, dice: [] }));
    this.currentPhase = { kind: 'bidding', round: this.rollNewRound(1, starterId) };
  }

  get phase(): GamePhase {
    return this.currentPhase;
  }

  get seq(): number {
    return this.sequence;
  }

  diceCountOf(playerId: string): number {
    return this.getPlayer(playerId).diceCount;
  }

  diceOf(playerId: string): Face[] {
    return [...this.getPlayer(playerId).dice];
  }

  raise(playerId: string, bid: Bid, seq: number): ActionResult {
    const round = this.roundForAction(playerId, seq);
    if (typeof round === 'string') return round;
    const illegal = describeIllegalBid(round.currentBid, bid);
    if (illegal !== null) return illegal;
    this.applyRaise(round, playerId, bid, false);
    return null;
  }

  katzel(playerId: string, seq: number): ActionResult {
    const round = this.roundForAction(playerId, seq);
    if (typeof round === 'string') return round;
    if (round.currentBid === null) return 'There is no bid to call Katzel on yet.';
    if (round.katzelCallerId !== null) return 'A Katzel is already pending on this bid.';
    this.applyKatzel(round, playerId);
    return null;
  }

  liar(playerId: string, seq: number): ActionResult {
    const round = this.roundForAction(playerId, seq);
    if (typeof round === 'string') return round;
    const liarError = describeLiarError(round, playerId);
    if (liarError !== null) return liarError;
    this.applyLiar(round, playerId, false);
    return null;
  }

  /**
   * Forced action for the turn player whose 30 seconds ran out:
   *  - no bid yet → the minimum opening bid
   *  - they may not call Liar (it is their own bid) → the smallest raise of the same face
   *  - otherwise → Liar
   */
  handleTurnTimeout(): void {
    const round = this.requireBiddingRound();
    const playerId = round.turnPlayerId;
    if (round.currentBid === null) {
      this.applyRaise(round, playerId, MINIMUM_OPENING_BID, true);
    } else if (describeLiarError(round, playerId) !== null) {
      this.applyRaise(round, playerId, automaticRaise(round.currentBid), true);
    } else {
      this.applyLiar(round, playerId, true);
    }
  }

  startNextRound(): void {
    const phase = this.currentPhase;
    if (phase.kind !== 'reveal') throw new Error(`Cannot start a round during phase "${phase.kind}".`);
    this.currentPhase = { kind: 'bidding', round: this.rollNewRound(phase.roundNumber + 1, phase.nextStarterId) };
    this.sequence += 1;
  }

  private biddingRoundOrNull(): RoundState | null {
    return this.currentPhase.kind === 'bidding' ? this.currentPhase.round : null;
  }

  private requireBiddingRound(): RoundState {
    const round = this.biddingRoundOrNull();
    if (round === null) throw new Error(`Expected bidding phase, got "${this.currentPhase.kind}".`);
    return round;
  }

  /** Returns the round the player may act on, or the reason they cannot act. */
  private roundForAction(playerId: string, seq: number): RoundState | string {
    const round = this.biddingRoundOrNull();
    if (round === null) return 'No round is in progress.';
    if (seq !== this.sequence) return 'The table changed before your action arrived. Check the new bid.';
    if (this.getPlayer(playerId).diceCount === 0) return 'You have been eliminated.';
    return round;
  }

  private applyRaise(round: RoundState, playerId: string, bid: Bid, forcedByTimeout: boolean): void {
    round.lastAction = this.notice(round, 'raise', playerId, bid, forcedByTimeout);
    round.currentBid = bid;
    round.bidderId = playerId;
    round.katzelCallerId = null;
    this.passTurnAfter(round, playerId);
  }

  private applyKatzel(round: RoundState, playerId: string): void {
    if (round.currentBid === null) throw new Error('Katzel requires a current bid.');
    round.lastAction = this.notice(round, 'katzel', playerId, round.currentBid, false);
    round.katzelCallerId = playerId;
    this.passTurnAfter(round, playerId);
  }

  private applyLiar(round: RoundState, liarCallerId: string, forcedByTimeout: boolean): void {
    if (round.currentBid === null || round.bidderId === null) throw new Error('Liar requires a current bid.');
    const interruption = liarCallerId !== round.turnPlayerId;
    const outcome = resolveShowdown({
      bid: round.currentBid,
      allDice: this.players.flatMap((player) => player.dice),
      bidderId: round.bidderId,
      katzelCallerId: round.katzelCallerId,
      liarCallerId,
      interruption,
    });

    const loser = this.getPlayer(outcome.loserId);
    loser.diceCount -= 1;
    if (outcome.bonusPlayerId !== null) {
      const bonusPlayer = this.getPlayer(outcome.bonusPlayerId);
      bonusPlayer.diceCount = Math.min(MAX_DICE, bonusPlayer.diceCount + 1);
    }

    const reveal: RevealSummary = {
      dice: Object.fromEntries(this.players.map((player) => [player.id, [...player.dice]])),
      bid: round.currentBid,
      bidderId: round.bidderId,
      katzelCallerId: round.katzelCallerId,
      liarCallerId,
      interruption,
      forcedByTimeout,
      ...outcome,
    };

    const survivors = this.players.filter((player) => player.diceCount > 0);
    const onlySurvivor = survivors[0];
    if (survivors.length === 1 && onlySurvivor !== undefined) {
      this.currentPhase = { kind: 'gameOver', reveal, winnerId: onlySurvivor.id };
    } else {
      this.currentPhase = {
        kind: 'reveal',
        roundNumber: round.number,
        reveal,
        revealEndsAt: this.deps.now() + REVEAL_DURATION_MS,
        nextStarterId: loser.diceCount > 0 ? loser.id : this.nextActivePlayerAfter(loser.id),
      };
    }
    this.sequence += 1;
  }

  private notice(
    round: RoundState,
    kind: ActionNotice['kind'],
    playerId: string,
    bid: Bid,
    forcedByTimeout: boolean,
  ): ActionNotice {
    return { kind, playerId, bid, interruption: playerId !== round.turnPlayerId, forcedByTimeout };
  }

  private passTurnAfter(round: RoundState, actorId: string): void {
    round.turnPlayerId = this.nextActivePlayerAfter(actorId);
    round.turnDeadline = this.deps.now() + TURN_DURATION_MS;
    this.sequence += 1;
  }

  private rollNewRound(number: number, starterId: string): RoundState {
    for (const player of this.players) {
      player.dice = Array.from({ length: player.diceCount }, () => this.deps.rollDie());
    }
    return {
      number,
      currentBid: null,
      bidderId: null,
      katzelCallerId: null,
      turnPlayerId: starterId,
      turnDeadline: this.deps.now() + TURN_DURATION_MS,
      lastAction: null,
    };
  }

  /** Next player clockwise (seat order) who still has dice. Works from an eliminated seat too. */
  private nextActivePlayerAfter(playerId: string): string {
    const start = this.players.findIndex((player) => player.id === playerId);
    if (start === -1) throw new Error(`Unknown player ${playerId}.`);
    for (let offset = 1; offset <= this.players.length; offset += 1) {
      const candidate = this.players[(start + offset) % this.players.length];
      if (candidate !== undefined && candidate.diceCount > 0) return candidate.id;
    }
    throw new Error('No active players remain.');
  }

  private getPlayer(playerId: string): GamePlayer {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (player === undefined) throw new Error(`Unknown player ${playerId}.`);
    return player;
  }
}

function describeLiarError(round: RoundState, playerId: string): string | null {
  if (round.currentBid === null) return 'There is no bid to call Liar on yet.';
  if (playerId === round.bidderId) return 'You cannot call Liar on your own bid.';
  if (playerId === round.katzelCallerId) return 'You cannot call Liar on your own Katzel.';
  return null;
}
