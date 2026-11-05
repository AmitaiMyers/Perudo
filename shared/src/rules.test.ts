import { describe, expect, it } from 'vitest';
import { countMatchingDice, describeIllegalBid, describeMalformedBid, minimumQuantity, resolveShowdown } from './rules';
import type { Face } from './types';

describe('countMatchingDice', () => {
  const dice: Face[] = [1, 1, 3, 3, 4, 6];

  it('counts Pacos as wild for normal faces', () => {
    expect(countMatchingDice(dice, 3)).toBe(4);
    expect(countMatchingDice(dice, 5)).toBe(2);
  });

  it('counts only Pacos when Pacos are bid', () => {
    expect(countMatchingDice(dice, 1)).toBe(2);
  });
});

describe('minimumQuantity', () => {
  it('opens at 1', () => {
    expect(minimumQuantity(null, 4)).toBe(1);
  });

  it('allows same quantity with a higher face, otherwise needs one more', () => {
    expect(minimumQuantity({ quantity: 4, face: 3 }, 5)).toBe(4);
    expect(minimumQuantity({ quantity: 4, face: 3 }, 3)).toBe(5);
    expect(minimumQuantity({ quantity: 4, face: 3 }, 2)).toBe(5);
  });

  it('halves (rounded up) when switching to Pacos', () => {
    expect(minimumQuantity({ quantity: 6, face: 4 }, 1)).toBe(3);
    expect(minimumQuantity({ quantity: 5, face: 4 }, 1)).toBe(3);
  });

  it('needs one more Paco when staying on Pacos', () => {
    expect(minimumQuantity({ quantity: 3, face: 1 }, 1)).toBe(4);
  });

  it('doubles plus one when leaving Pacos', () => {
    expect(minimumQuantity({ quantity: 3, face: 1 }, 2)).toBe(7);
    expect(minimumQuantity({ quantity: 3, face: 1 }, 6)).toBe(7);
  });
});

describe('describeIllegalBid', () => {
  it('rejects Pacos on the opening bid', () => {
    expect(describeIllegalBid(null, { quantity: 2, face: 1 }, false)).toMatch(/first bid/);
  });

  it('accepts Pacos after the opening bid', () => {
    expect(describeIllegalBid({ quantity: 4, face: 3 }, { quantity: 2, face: 1 }, false)).toBeNull();
  });

  it('rejects a bid that is not higher', () => {
    expect(describeIllegalBid({ quantity: 4, face: 3 }, { quantity: 4, face: 3 }, false)).not.toBeNull();
    expect(describeIllegalBid({ quantity: 4, face: 3 }, { quantity: 5, face: 2 }, false)).toBeNull();
  });
});

describe('last-die round', () => {
  it('lets the opening bid be on Pacos', () => {
    expect(describeIllegalBid(null, { quantity: 1, face: 1 }, true)).toBeNull();
  });

  it('keeps the opening face for every later bid', () => {
    const opening = { quantity: 2, face: 3 } as const;
    expect(describeIllegalBid(opening, { quantity: 3, face: 3 }, true)).toBeNull();
    expect(describeIllegalBid(opening, { quantity: 2, face: 3 }, true)).toMatch(/at least 3/);
    expect(describeIllegalBid(opening, { quantity: 3, face: 5 }, true)).toMatch(/must be on 3s/);
    expect(describeIllegalBid(opening, { quantity: 2, face: 1 }, true)).toMatch(/must be on 3s/);
  });

  it('keeps Pacos when the round opened on Pacos', () => {
    const opening = { quantity: 1, face: 1 } as const;
    expect(describeIllegalBid(opening, { quantity: 2, face: 1 }, true)).toBeNull();
    expect(describeIllegalBid(opening, { quantity: 9, face: 6 }, true)).toMatch(/must be on Pacos/);
  });
});

describe('describeMalformedBid', () => {
  it('rejects junk from the network', () => {
    expect(describeMalformedBid(null)).not.toBeNull();
    expect(describeMalformedBid({ quantity: 0, face: 3 })).not.toBeNull();
    expect(describeMalformedBid({ quantity: 2.5, face: 3 })).not.toBeNull();
    expect(describeMalformedBid({ quantity: 2, face: 7 })).not.toBeNull();
    expect(describeMalformedBid({ quantity: 2, face: 3 })).toBeNull();
  });
});

describe('resolveShowdown', () => {
  const allDice: Face[] = [3, 3, 1, 5, 6]; // three dice count as 3s
  const base = { allDice, bidderId: 'bidder', liarCallerId: 'caller', katzelCallerId: null, interruption: false };

  it('bidder loses when fewer dice than bid exist', () => {
    const outcome = resolveShowdown({ ...base, bid: { quantity: 4, face: 3 } });
    expect(outcome).toEqual({ actualCount: 3, liarWasCorrect: true, loserId: 'bidder', bonusPlayerId: null });
  });

  it('Liar caller loses when the count is exact or higher', () => {
    expect(resolveShowdown({ ...base, bid: { quantity: 3, face: 3 } }).loserId).toBe('caller');
    expect(resolveShowdown({ ...base, bid: { quantity: 2, face: 3 } }).loserId).toBe('caller');
  });

  it('a correct out-of-turn Liar earns a bonus die', () => {
    const outcome = resolveShowdown({ ...base, interruption: true, bid: { quantity: 4, face: 3 } });
    expect(outcome.bonusPlayerId).toBe('caller');
  });

  it('a wrong out-of-turn Liar earns no bonus', () => {
    const outcome = resolveShowdown({ ...base, interruption: true, bid: { quantity: 3, face: 3 } });
    expect(outcome).toMatchObject({ loserId: 'caller', bonusPlayerId: null });
  });

  it('with a pending Katzel, an exact count makes the Liar caller lose', () => {
    const outcome = resolveShowdown({ ...base, katzelCallerId: 'katzel', bid: { quantity: 3, face: 3 } });
    expect(outcome).toMatchObject({ liarWasCorrect: false, loserId: 'caller' });
  });

  it('with a pending Katzel, any non-exact count makes the Katzel caller lose', () => {
    const over = resolveShowdown({ ...base, katzelCallerId: 'katzel', bid: { quantity: 2, face: 3 } });
    const under = resolveShowdown({ ...base, katzelCallerId: 'katzel', bid: { quantity: 4, face: 3 } });
    expect(over).toMatchObject({ liarWasCorrect: true, loserId: 'katzel' });
    expect(under).toMatchObject({ liarWasCorrect: true, loserId: 'katzel' });
  });
});
