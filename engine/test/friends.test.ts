import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import { callRank, resolveFriends, isBuriable } from '../src/friends';

const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });
const BJ: Card = { kind: 'joker', joker: 'BJ' };

describe('callRank 打A叫K (§8)', () => {
  it('打 7 → 叫 A', () => expect(callRank('7')).toBe('A'));
  it('打 K → 叫 A', () => expect(callRank('K')).toBe('A'));
  it('打 A → 叫 K', () => expect(callRank('A')).toBe('K'));
});

describe('resolveFriends 按打出先后揭友 (§8)', () => {
  // 叫：第2张红桃A + 第5张黑桃A
  const calls = [
    { suit: 'H' as Suit, nth: 2 },
    { suit: 'S' as Suit, nth: 5 },
  ];

  it('maps nth play of a suit to its player', () => {
    const plays = [
      { player: 3, suit: 'H' as Suit }, // 红桃A 第1张
      { player: 5, suit: 'H' as Suit }, // 红桃A 第2张 → 朋友1 = P5
      { player: 1, suit: 'S' as Suit }, // 黑桃A 第1张
      { player: 2, suit: 'S' as Suit },
      { player: 6, suit: 'S' as Suit },
      { player: 0, suit: 'S' as Suit },
      { player: 4, suit: 'S' as Suit }, // 黑桃A 第5张 → 朋友2 = P4
    ];
    expect(resolveFriends(calls, plays)).toEqual([5, 4]);
  });

  it('unplayed nth → null (朋友位空缺)', () => {
    const plays = [{ player: 3, suit: 'H' as Suit }]; // 红桃A 只出 1 张
    expect(resolveFriends(calls, plays)).toEqual([null, null]);
  });

  it('same player can satisfy both calls (叫到同一人)', () => {
    const calls2 = [
      { suit: 'H' as Suit, nth: 1 },
      { suit: 'S' as Suit, nth: 1 },
    ];
    const plays = [
      { player: 2, suit: 'H' as Suit },
      { player: 2, suit: 'S' as Suit },
    ];
    expect(resolveFriends(calls2, plays)).toEqual([2, 2]);
  });
});

describe('isBuriable 叫牌点不可扣底 (§8)', () => {
  it('打 7：A 不可扣，其余可扣', () => {
    expect(isBuriable(c('S', 'A'), '7')).toBe(false);
    expect(isBuriable(c('S', 'K'), '7')).toBe(true);
    expect(isBuriable(BJ, '7')).toBe(true);
  });
  it('打 A：K 不可扣，A 可扣（A 已是主、非朋友牌）', () => {
    expect(isBuriable(c('S', 'K'), 'A')).toBe(false);
    expect(isBuriable(c('S', 'A'), 'A')).toBe(true);
  });
});
