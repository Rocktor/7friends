import { describe, it, expect } from 'vitest';
import { buildDeck } from '../src/deck';
import { SUITS, RANKS, DECKS } from '../src/domain';

describe('buildDeck (§2 牌组构成)', () => {
  it('builds exactly 324 cards (6 decks × 54)', () => {
    expect(buildDeck()).toHaveLength(324);
  });

  it('has 6 copies of every (suit, rank) — 312 suited', () => {
    const deck = buildDeck();
    const suited = deck.filter((c) => c.kind === 'suited');
    expect(suited).toHaveLength(SUITS.length * RANKS.length * DECKS); // 4×13×6 = 312
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const n = suited.filter(
          (c) => c.kind === 'suited' && c.suit === suit && c.rank === rank,
        ).length;
        expect(n).toBe(DECKS);
      }
    }
  });

  it('has 6 大王 + 6 小王', () => {
    const deck = buildDeck();
    expect(deck.filter((c) => c.kind === 'joker' && c.joker === 'BJ')).toHaveLength(DECKS);
    expect(deck.filter((c) => c.kind === 'joker' && c.joker === 'LJ')).toHaveLength(DECKS);
  });

  it('has exactly 24 aces (4 suits × 6 decks) — 保护叫A机制的前提', () => {
    const deck = buildDeck();
    const aces = deck.filter((c) => c.kind === 'suited' && c.rank === 'A');
    expect(aces).toHaveLength(24);
  });
});
