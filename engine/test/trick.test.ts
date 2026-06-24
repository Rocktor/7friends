import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import type { TrumpCtx } from '../src/trump';
import { trickWinner } from '../src/trick';

const ctx: TrumpCtx = { level: '7', trump: 'S' }; // 打7 主黑桃
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });
const P = (player: number, ...cards: Card[]) => ({ player, cards });

describe('trickWinner 单张 (§9)', () => {
  it('highest of led suit wins', () => {
    expect(trickWinner([P(0, c('H', '5')), P(1, c('H', '9')), P(2, c('H', '2'))], ctx)).toBe(1);
  });
  it('off-suit non-trump discard cannot win', () => {
    expect(trickWinner([P(0, c('H', '5')), P(1, c('D', 'A'))], ctx)).toBe(0);
  });
  it('trump ruff beats non-trump (void in led suit)', () => {
    expect(trickWinner([P(0, c('H', '5')), P(1, c('S', '2'))], ctx)).toBe(1);
  });
  it('higher trump beats lower trump', () => {
    expect(trickWinner([P(0, c('H', '5')), P(1, c('S', '2')), P(2, c('S', '9'))], ctx)).toBe(2);
  });
  it('副级 beats 主花色 A as trump top', () => {
    // p1 主A(主花色其余)，p2 副级红7 → p2 更大
    expect(trickWinner([P(0, c('H', '5')), P(1, c('S', 'A')), P(2, c('H', '7'))], ctx)).toBe(2);
  });
  it('big joker is the strongest trump', () => {
    const BJ: Card = { kind: 'joker', joker: 'BJ' };
    expect(trickWinner([P(0, c('H', '5')), P(1, c('S', '7')), P(2, BJ)], ctx)).toBe(2);
  });
});

describe('trickWinner 对子 / 拖拉机 — 同型才比 (§9)', () => {
  it('higher pair of led suit wins', () => {
    expect(trickWinner([P(0, c('H', '5'), c('H', '5')), P(1, c('H', '9'), c('H', '9'))], ctx)).toBe(1);
  });
  it('non-pair follow cannot win a pair lead (跨型不压)', () => {
    // p1 出 2 张非对 → 不是同型，压不过
    expect(trickWinner([P(0, c('H', '5'), c('H', '5')), P(1, c('H', '9'), c('H', '2'))], ctx)).toBe(0);
  });
  it('trump pair ruffs a non-trump pair', () => {
    expect(trickWinner([P(0, c('H', '5'), c('H', '5')), P(1, c('S', '2'), c('S', '2'))], ctx)).toBe(1);
  });
  it('higher tractor of led suit wins; junk cannot', () => {
    const lead = P(0, c('H', '2'), c('H', '2'), c('H', '3'), c('H', '3'));
    const hi = P(1, c('H', '9'), c('H', '9'), c('H', '10'), c('H', '10'));
    const junk = P(2, c('H', '5'), c('H', '5'), c('H', '8'), c('H', 'K')); // 非拖
    expect(trickWinner([lead, hi, junk], ctx)).toBe(1);
  });
});

describe('副级牌出牌期等大、先出为大 (§9 rev-B)', () => {
  it('两门副级牌相遇 → 先出者赢（花色序不进出牌）', () => {
    // 打7主黑桃：红7、梅7、方片7 都是副级牌、等大。领出红7，后面梅7/方7 压不过（先出为大）
    expect(trickWinner([P(0, c('H', '7')), P(1, c('C', '7')), P(2, c('D', '7'))], ctx)).toBe(0);
    // 即便后出的是"更高花色"黑红梅方里的红，也不影响——先出的方片7 仍赢
    expect(trickWinner([P(0, c('D', '7')), P(1, c('H', '7'))], ctx)).toBe(0);
  });
});
