import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import { cardPoints, sumPoints, kittyMultiplier, kittyBonus, defendersTrickPoints } from '../src/scoring';

const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });
const BJ: Card = { kind: 'joker', joker: 'BJ' };

describe('cardPoints (§10.1)', () => {
  it('5=5, 10=10, K=10, others 0', () => {
    expect(cardPoints(c('H', '5'))).toBe(5);
    expect(cardPoints(c('H', '10'))).toBe(10);
    expect(cardPoints(c('H', 'K'))).toBe(10);
    expect(cardPoints(c('H', 'A'))).toBe(0);
    expect(cardPoints(c('H', '7'))).toBe(0);
    expect(cardPoints(BJ)).toBe(0);
  });
});

describe('sumPoints', () => {
  it('sums a hand', () => {
    expect(sumPoints([c('H', '5'), c('H', '10'), c('S', 'K'), c('D', '2')])).toBe(25);
  });
  it('全场 600 分校验（5/10/K 各 24 张）', () => {
    const all: Card[] = [];
    for (let i = 0; i < 24; i++) all.push(c('H', '5'), c('H', '10'), c('H', 'K'));
    expect(sumPoints(all)).toBe(600);
  });
});

describe('kittyMultiplier / kittyBonus (§10.2)', () => {
  it('倍数 = 2^张数：单×2 双×4 三×8', () => {
    expect(kittyMultiplier(1)).toBe(2);
    expect(kittyMultiplier(2)).toBe(4);
    expect(kittyMultiplier(3)).toBe(8);
  });
  it('闲家赢末墩(双张) 底 30 分 → +120', () => {
    const kitty = [c('H', '10'), c('H', '10'), c('H', '10'), c('S', 'A')]; // 30 分
    expect(kittyBonus(kitty, 2, true)).toBe(120);
  });
  it('庄队赢末墩 = 保底 → 0', () => {
    const kitty = [c('H', '10'), c('H', '10'), c('H', '10')];
    expect(kittyBonus(kitty, 2, false)).toBe(0);
  });
});

describe('defendersTrickPoints (§10.1 按最终阵营归集)', () => {
  it('only defender-camp tricks count', () => {
    const tricks = [
      { camp: 'defender' as const, cards: [c('H', '5'), c('H', '10')] }, // 15
      { camp: 'declarer' as const, cards: [c('S', 'K')] }, // 不计
      { camp: 'defender' as const, cards: [c('D', 'K')] }, // 10
    ];
    expect(defendersTrickPoints(tricks)).toBe(25);
  });
});
