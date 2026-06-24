import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import type { TrumpCtx } from '../src/trump';
import { comboGroup, ordinalInGroup, classifyLead } from '../src/legality';

const ctx: TrumpCtx = { level: '7', trump: 'S' }; // 打7 主黑桃
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });
const BJ: Card = { kind: 'joker', joker: 'BJ' };

describe('comboGroup', () => {
  it('trump cards → TRUMP（王/级牌/主花色）', () => {
    expect(comboGroup(BJ, ctx)).toBe('TRUMP');
    expect(comboGroup(c('S', '2'), ctx)).toBe('TRUMP'); // 主花色
    expect(comboGroup(c('H', '7'), ctx)).toBe('TRUMP'); // 副级
  });
  it('side cards → their suit', () => {
    expect(comboGroup(c('H', '2'), ctx)).toBe('H');
    expect(comboGroup(c('D', 'A'), ctx)).toBe('D');
  });
});

describe('ordinalInGroup 断点闭合 + 主牌顶部', () => {
  it('side suit skips level (打7: 6↔8 相邻)', () => {
    expect(ordinalInGroup(c('H', '8'), ctx) - ordinalInGroup(c('H', '6'), ctx)).toBe(1);
  });
  it('主花色A 与 副级 相邻（主A→副级→主级→小王→大王）', () => {
    expect(ordinalInGroup(c('H', '7'), ctx) - ordinalInGroup(c('S', 'A'), ctx)).toBe(1); // 副级 = 主A+1
    expect(ordinalInGroup(c('S', '7'), ctx) - ordinalInGroup(c('H', '7'), ctx)).toBe(1); // 主级 = 副级+1
  });
});

describe('classifyLead 牌型识别 (§9)', () => {
  it('single', () => {
    expect(classifyLead([c('H', '2')], ctx)).toMatchObject({ type: 'single', group: 'H', size: 1 });
  });
  it('对/三/四/五/六张 = nkind', () => {
    expect(classifyLead([c('H', '2'), c('H', '2')], ctx)).toMatchObject({ type: 'nkind', n: 2 });
    expect(classifyLead([c('H', '2'), c('H', '2'), c('H', '2')], ctx)).toMatchObject({ type: 'nkind', n: 3 });
    const four = [c('H', '2'), c('H', '2'), c('H', '2'), c('H', '2')];
    expect(classifyLead(four, ctx)).toMatchObject({ type: 'nkind', n: 4 });
    const six = Array.from({ length: 6 }, () => c('H', '9'));
    expect(classifyLead(six, ctx)).toMatchObject({ type: 'nkind', n: 6 });
  });
  it('连对 / 连三对 = tractor m2', () => {
    expect(classifyLead([c('H', '2'), c('H', '2'), c('H', '3'), c('H', '3')], ctx))
      .toMatchObject({ type: 'tractor', m: 2, len: 2 });
    const t3 = [c('H', '2'), c('H', '2'), c('H', '3'), c('H', '3'), c('H', '4'), c('H', '4')];
    expect(classifyLead(t3, ctx)).toMatchObject({ type: 'tractor', m: 2, len: 3 });
  });
  it('连三张 = tractor m3', () => {
    const cards = [c('H', '2'), c('H', '2'), c('H', '2'), c('H', '3'), c('H', '3'), c('H', '3')];
    expect(classifyLead(cards, ctx)).toMatchObject({ type: 'tractor', m: 3, len: 2 });
  });
  it('断点闭合：打7 时 H6H6-H8H8 是拖拉机', () => {
    expect(classifyLead([c('H', '6'), c('H', '6'), c('H', '8'), c('H', '8')], ctx))
      .toMatchObject({ type: 'tractor', m: 2, len: 2 });
  });
  it('主A对 + 副级对 是主拖拉机', () => {
    expect(classifyLead([c('S', 'A'), c('S', 'A'), c('H', '7'), c('H', '7')], ctx))
      .toMatchObject({ type: 'tractor', m: 2, len: 2, group: 'TRUMP' });
  });
  it('副级跨花色不成对 → throw（红7+梅7）', () => {
    expect(classifyLead([c('H', '7'), c('C', '7')], ctx)).toMatchObject({ type: 'throw' });
  });
  it('非连续对子 → throw（H2H2-H5H5）', () => {
    expect(classifyLead([c('H', '2'), c('H', '2'), c('H', '5'), c('H', '5')], ctx))
      .toMatchObject({ type: 'throw' });
  });
  it('混花色领出 → illegal', () => {
    expect(classifyLead([c('H', '2'), c('D', '2')], ctx)).toMatchObject({ type: 'illegal' });
  });
  it('空 → illegal', () => {
    expect(classifyLead([], ctx)).toMatchObject({ type: 'illegal' });
  });
});
