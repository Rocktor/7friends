import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import { isTrump, rankValue, trumpStrength, suitOrdinal } from '../src/trump';

// 打 7、主黑桃
const ctx = { level: '7' as Rank, trump: 'S' as Suit };
const BJ: Card = { kind: 'joker', joker: 'BJ' };
const LJ: Card = { kind: 'joker', joker: 'LJ' };
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });

describe('rankValue', () => {
  it('orders 2 < … < 10 < J < Q < K < A', () => {
    expect(rankValue('2')).toBeLessThan(rankValue('10'));
    expect(rankValue('10')).toBeLessThan(rankValue('J'));
    expect(rankValue('J')).toBeLessThan(rankValue('Q'));
    expect(rankValue('Q')).toBeLessThan(rankValue('K'));
    expect(rankValue('K')).toBeLessThan(rankValue('A'));
  });
});

describe('isTrump (§4)', () => {
  it('jokers are always trump', () => {
    expect(isTrump(BJ, ctx)).toBe(true);
    expect(isTrump(LJ, ctx)).toBe(true);
  });
  it('any level-rank card is trump (主级 + 副级)', () => {
    expect(isTrump(c('S', '7'), ctx)).toBe(true); // 主级
    expect(isTrump(c('H', '7'), ctx)).toBe(true); // 副级
    expect(isTrump(c('D', '7'), ctx)).toBe(true);
  });
  it('trump-suit cards are trump', () => {
    expect(isTrump(c('S', '2'), ctx)).toBe(true);
    expect(isTrump(c('S', 'A'), ctx)).toBe(true);
  });
  it('off-suit non-level cards are NOT trump', () => {
    expect(isTrump(c('H', '2'), ctx)).toBe(false);
    expect(isTrump(c('D', 'A'), ctx)).toBe(false);
  });
});

describe('trumpStrength 大小序 (§4.1)', () => {
  it('大王 > 小王 > 主级 > 副级 > 主花色其余', () => {
    const bj = trumpStrength(BJ, ctx)!;
    const lj = trumpStrength(LJ, ctx)!;
    const zhuJi = trumpStrength(c('S', '7'), ctx)!; // 主级
    const fuJi = trumpStrength(c('H', '7'), ctx)!; // 副级
    const zhuA = trumpStrength(c('S', 'A'), ctx)!; // 主花色其余最大
    expect(bj).toBeGreaterThan(lj);
    expect(lj).toBeGreaterThan(zhuJi);
    expect(zhuJi).toBeGreaterThan(fuJi);
    expect(fuJi).toBeGreaterThan(zhuA);
  });

  it('副级牌三门等大', () => {
    expect(trumpStrength(c('H', '7'), ctx)).toBe(trumpStrength(c('C', '7'), ctx));
    expect(trumpStrength(c('C', '7'), ctx)).toBe(trumpStrength(c('D', '7'), ctx));
  });

  it('主花色其余内部按点数序（跳过级牌）', () => {
    expect(trumpStrength(c('S', 'A'), ctx)!).toBeGreaterThan(trumpStrength(c('S', 'K'), ctx)!);
    expect(trumpStrength(c('S', '8'), ctx)!).toBeGreaterThan(trumpStrength(c('S', '6'), ctx)!);
  });

  it('非主牌返回 undefined', () => {
    expect(trumpStrength(c('H', '2'), ctx)).toBeUndefined();
    expect(trumpStrength(c('D', 'A'), ctx)).toBeUndefined();
  });
});

describe('suitOrdinal 断点闭合 (§4.1)', () => {
  it('打 J：10 与 Q 相邻（中间 J 抽走）', () => {
    expect(suitOrdinal('Q', 'J') - suitOrdinal('10', 'J')).toBe(1);
  });
  it('打 7：6 与 8 相邻', () => {
    expect(suitOrdinal('8', '7') - suitOrdinal('6', '7')).toBe(1);
  });
  it('打 K：Q 与 A 相邻', () => {
    expect(suitOrdinal('A', 'K') - suitOrdinal('Q', 'K')).toBe(1);
  });
});
