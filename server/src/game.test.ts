import { describe, expect, it } from 'vitest';
import { MAX_DICE, TURN_DURATION_MS, type Bid, type Face } from '@perudo/shared';
import { Game, type RoundState } from './game';

/** Every die rolled shows `table.face`, which tests change between rounds. */
function createGame(seatOrder: string[] = ['A', 'B', 'C'], starterId = 'A') {
  const table = { face: 3 as Face, now: 1_000 };
  const game = new Game(seatOrder, starterId, { rollDie: () => table.face, now: () => table.now });
  return { game, table };
}

function round(game: Game): RoundState {
  const phase = game.phase;
  if (phase.kind !== 'bidding') throw new Error(`Expected bidding, got ${phase.kind}`);
  return phase.round;
}

function reveal(game: Game) {
  const phase = game.phase;
  if (phase.kind === 'bidding') throw new Error('Expected a reveal');
  return phase.reveal;
}

function raise(game: Game, playerId: string, bid: Bid): void {
  expect(game.raise(playerId, bid, game.seq)).toBeNull();
}

describe('turn order and interruptions', () => {
  it('passes the turn clockwise after a raise', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 2, face: 3 });
    expect(round(game).turnPlayerId).toBe('B');
  });

  it('skips to the player after an interrupter', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 2, face: 3 });
    raise(game, 'C', { quantity: 3, face: 3 }); // B's turn, C jumps in
    expect(round(game).turnPlayerId).toBe('A');
    expect(round(game).lastAction).toMatchObject({ kind: 'raise', playerId: 'C', interruption: true });
  });

  it('lets anyone open the round by jumping in', () => {
    const { game } = createGame();
    raise(game, 'B', { quantity: 1, face: 4 });
    expect(round(game).turnPlayerId).toBe('C');
  });

  it('lets the bidder raise over their own bid', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 2, face: 3 });
    raise(game, 'A', { quantity: 3, face: 3 });
    expect(round(game).bidderId).toBe('A');
  });

  it('rejects actions sent against a stale sequence number', () => {
    const { game } = createGame();
    const staleSeq = game.seq;
    raise(game, 'A', { quantity: 2, face: 3 });
    expect(game.liar('B', staleSeq)).toMatch(/table changed/);
  });

  it('rejects Liar on your own bid and on your own Katzel', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 2, face: 3 });
    expect(game.liar('A', game.seq)).toMatch(/own bid/);
    expect(game.katzel('B', game.seq)).toBeNull();
    expect(game.liar('B', game.seq)).toMatch(/own Katzel/);
  });

  it('lets the bidder call Liar on a Katzel against their bid (two players)', () => {
    const { game } = createGame(['A', 'B'], 'A');
    raise(game, 'A', { quantity: 9, face: 3 }); // ten 3s on the table, so 9 is not exact
    expect(game.katzel('B', game.seq)).toBeNull(); // turn passes back to A, the bidder
    expect(round(game).turnPlayerId).toBe('A');
    expect(game.liar('A', game.seq)).toBeNull();
    expect(reveal(game)).toMatchObject({ liarCallerId: 'A', katzelCallerId: 'B', liarWasCorrect: true, loserId: 'B' });
  });

  it('still forbids Liar on your own bid when no Katzel is pending', () => {
    const { game } = createGame(['A', 'B'], 'A');
    raise(game, 'A', { quantity: 2, face: 3 });
    raise(game, 'A', { quantity: 3, face: 3 }); // A raises over their own bid
    expect(game.liar('A', game.seq)).toMatch(/own bid/);
  });

  it('allows only one pending Katzel per bid, and a raise clears it', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 2, face: 3 });
    expect(game.katzel('B', game.seq)).toBeNull();
    expect(round(game).turnPlayerId).toBe('C');
    expect(game.katzel('C', game.seq)).toMatch(/already pending/);
    raise(game, 'C', { quantity: 3, face: 3 });
    expect(round(game).katzelCallerId).toBeNull();
  });
});

describe('Liar resolution', () => {
  it('on a regular turn, a correct Liar costs the bidder a die and the bidder starts next', () => {
    const { game, table } = createGame();
    table.face = 2; // round 1 dice were already rolled as 3s; round 2 will roll 2s
    raise(game, 'A', { quantity: 16, face: 3 }); // only 15 dice on the table
    expect(game.liar('B', game.seq)).toBeNull();
    expect(reveal(game)).toMatchObject({
      loserId: 'A',
      liarWasCorrect: true,
      bonusPlayerId: null,
      interruption: false,
    });
    expect(game.diceCountOf('A')).toBe(MAX_DICE - 1);
    game.startNextRound();
    expect(round(game)).toMatchObject({ number: 2, turnPlayerId: 'A', currentBid: null });
    expect(game.diceOf('A')).toEqual([2, 2, 2, 2]);
  });

  it('on a regular turn, a wrong Liar costs the caller a die', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 15, face: 3 });
    expect(game.liar('B', game.seq)).toBeNull();
    expect(reveal(game)).toMatchObject({ loserId: 'B', liarWasCorrect: false, actualCount: 15 });
  });

  it('a correct out-of-turn Liar regains a lost die', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 15, face: 3 });
    expect(game.liar('B', game.seq)).toBeNull(); // B is wrong → B has 4 dice and starts round 2
    game.startNextRound();
    raise(game, 'B', { quantity: 13, face: 4 }); // no 4s on the table; turn passes to C
    expect(game.liar('A', game.seq)).toBeNull(); // A jumps in on C's turn → no bonus needed (A has 5)
    expect(reveal(game)).toMatchObject({ loserId: 'B', interruption: true, bonusPlayerId: 'A' });
    expect(game.diceCountOf('A')).toBe(MAX_DICE); // capped at the maximum
    expect(game.diceCountOf('B')).toBe(MAX_DICE - 2);

    game.startNextRound(); // B starts
    raise(game, 'C', { quantity: 13, face: 5 }); // C jumps in; turn passes to A
    expect(game.liar('B', game.seq)).toBeNull(); // B jumps in on A's turn and is correct
    expect(reveal(game)).toMatchObject({ loserId: 'C', bonusPlayerId: 'B' });
    expect(game.diceCountOf('B')).toBe(MAX_DICE - 1);
  });

  it('with a pending Katzel, an exact count costs the Liar caller a die', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 15, face: 3 });
    expect(game.katzel('B', game.seq)).toBeNull();
    expect(game.liar('C', game.seq)).toBeNull();
    expect(reveal(game)).toMatchObject({ katzelCallerId: 'B', loserId: 'C', liarWasCorrect: false });
  });

  it('with a pending Katzel, a non-exact count costs the Katzel caller a die', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 14, face: 3 });
    expect(game.katzel('B', game.seq)).toBeNull();
    expect(game.liar('C', game.seq)).toBeNull();
    expect(reveal(game)).toMatchObject({ loserId: 'B', liarWasCorrect: true, bonusPlayerId: null });
  });

  it('an interrupting Liar on a Katzel is checked exactly and earns the bonus', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 14, face: 3 }); // B's turn
    expect(game.katzel('C', game.seq)).toBeNull(); // C jumps in; turn passes to A (the bidder)
    expect(game.liar('B', game.seq)).toBeNull(); // B jumps in on A's turn
    expect(reveal(game)).toMatchObject({ loserId: 'C', interruption: true, bonusPlayerId: 'B' });
  });
});

describe('turn timer', () => {
  it('forces the minimum opening bid when no bid exists', () => {
    const { game } = createGame();
    game.handleTurnTimeout();
    expect(round(game)).toMatchObject({ currentBid: { quantity: 1, face: 2 }, bidderId: 'A', turnPlayerId: 'B' });
    expect(round(game).lastAction).toMatchObject({ forcedByTimeout: true, interruption: false });
  });

  it('forces a regular Liar when a bid exists', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 16, face: 3 });
    game.handleTurnTimeout();
    expect(reveal(game)).toMatchObject({ liarCallerId: 'B', forcedByTimeout: true, interruption: false, loserId: 'A' });
  });

  it('forces Liar on the Katzel when the bidder times out after someone Katzels their bid', () => {
    const { game } = createGame();
    raise(game, 'A', { quantity: 15, face: 3 }); // B's turn
    expect(game.katzel('C', game.seq)).toBeNull(); // turn passes to A, the bidder
    game.handleTurnTimeout();
    expect(reveal(game)).toMatchObject({ liarCallerId: 'A', katzelCallerId: 'C', forcedByTimeout: true, loserId: 'A' });
  });

  it('gives every new turn a fresh deadline', () => {
    const { game, table } = createGame();
    table.now = 50_000;
    raise(game, 'A', { quantity: 2, face: 3 });
    expect(round(game).turnDeadline).toBe(50_000 + TURN_DURATION_MS);
  });
});

describe('last-die round', () => {
  /** The turn player bids more 3s than exist; the next player calls Liar, so the bidder loses a die. */
  function bidderLosesDie(game: Game, bidderId: string, callerId: string): void {
    raise(game, bidderId, { quantity: 16, face: 3 });
    expect(game.liar(callerId, game.seq)).toBeNull();
  }

  it('follows every drop from two dice to one, with the face locked to the opening bid', () => {
    const { game } = createGame(['A', 'B', 'C'], 'A');
    for (let lost = 1; lost <= 3; lost += 1) {
      bidderLosesDie(game, 'A', 'B'); // 5 → 2 dice: normal rounds
      game.startNextRound();
      expect(round(game).lastDiePlayerId).toBeNull();
    }
    bidderLosesDie(game, 'A', 'B'); // 2 → 1 die
    game.startNextRound();
    expect(round(game)).toMatchObject({ lastDiePlayerId: 'A', turnPlayerId: 'A', currentBid: null });

    // Nobody can jump in before the player on their last die opens…
    expect(game.raise('B', { quantity: 1, face: 4 }, game.seq)).toMatch(/last die may open/);
    // …who may open on Pacos, and the face then stays Pacos for everyone.
    raise(game, 'A', { quantity: 1, face: 1 });
    expect(game.raise('B', { quantity: 3, face: 4 }, game.seq)).toMatch(/must be on Pacos/);
    raise(game, 'B', { quantity: 2, face: 1 });
    expect(round(game).currentBid).toEqual({ quantity: 2, face: 1 });

    // A bid on Pacos counts only Pacos, and every die rolled here is a 3: the count is 0.
    expect(game.liar('C', game.seq)).toBeNull();
    expect(reveal(game)).toMatchObject({ loserId: 'B', actualCount: 0 });
    game.startNextRound();
    expect(round(game).lastDiePlayerId).toBeNull(); // B went 5 → 4: a normal round
  });

  it('opens with one 2 for the player on their last die when their timer runs out', () => {
    const { game } = createGame(['A', 'B'], 'A');
    for (let lost = 1; lost <= 4; lost += 1) {
      bidderLosesDie(game, 'A', 'B');
      game.startNextRound();
    }
    expect(round(game).lastDiePlayerId).toBe('A');
    game.handleTurnTimeout();
    expect(round(game)).toMatchObject({ currentBid: { quantity: 1, face: 2 }, bidderId: 'A' });
    expect(game.raise('B', { quantity: 2, face: 3 }, game.seq)).toMatch(/must be on 2s/);
  });
});

describe('elimination', () => {
  it('ends the game when one player remains', () => {
    const { game } = createGame(['A', 'B'], 'A');
    for (let lost = 1; lost <= MAX_DICE; lost += 1) {
      raise(game, 'A', { quantity: 11, face: 3 });
      expect(game.liar('B', game.seq)).toBeNull();
      if (lost < MAX_DICE) game.startNextRound();
    }
    expect(game.phase).toMatchObject({ kind: 'gameOver', winnerId: 'B' });
  });

  it('starts the next round with the next active player when the loser is eliminated', () => {
    const { game } = createGame(['A', 'B', 'C'], 'A');
    for (let lost = 1; lost <= MAX_DICE; lost += 1) {
      raise(game, 'A', { quantity: 16, face: 3 });
      expect(game.liar('B', game.seq)).toBeNull();
      game.startNextRound();
    }
    expect(game.diceCountOf('A')).toBe(0);
    expect(round(game).turnPlayerId).toBe('B');
    expect(game.raise('A', { quantity: 1, face: 2 }, game.seq)).toMatch(/eliminated/);
  });
});
