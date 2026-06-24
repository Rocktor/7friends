import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import type { TrumpCtx } from '../src/trump';
import { classifyLead, isLegalFollow } from '../src/legality';

const ctx: TrumpCtx = { level: '7', trump: 'S' };
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });
const follow = (leadCards: Card[], hand: Card[], play: Card[]) =>
  isLegalFollow(classifyLead(leadCards, ctx), hand, play, ctx);

describe('isLegalFollow — 数量 + 跟门 (§9)', () => {
  it('count must match lead size', () => {
    expect(follow([c('H', '2')], [c('H', '5'), c('D', '2')], [c('H', '5'), c('D', '2')])).toBe(false);
  });
  it('must follow led suit when able', () => {
    expect(follow([c('H', '2')], [c('H', '5'), c('D', '2')], [c('D', '2')])).toBe(false);
    expect(follow([c('H', '2')], [c('H', '5'), c('D', '2')], [c('H', '5')])).toBe(true);
  });
  it('void in led suit → free filler of right count', () => {
    expect(follow([c('H', '2')], [c('D', '2'), c('C', '9')], [c('D', '2')])).toBe(true);
  });
  it('short in led suit → must dump all led-suit cards', () => {
    // 领出 H 对(2张)，手里只 1 张 H → 必须打出那张 H + 1 填充
    const hand = [c('H', '5'), c('D', '2'), c('D', '3')];
    expect(follow([c('H', '2'), c('H', '2')], hand, [c('H', '5'), c('D', '2')])).toBe(true);
    expect(follow([c('H', '2'), c('H', '2')], hand, [c('D', '2'), c('D', '3')])).toBe(false); // 藏了 H5
  });
});

describe('isLegalFollow — 对子保留 有对必须出 (§9)', () => {
  it('led pair + hand has a pair → must play the pair, not split', () => {
    const hand = [c('H', '5'), c('H', '5'), c('H', '8')];
    expect(follow([c('H', '2'), c('H', '2')], hand, [c('H', '5'), c('H', '5')])).toBe(true);
    expect(follow([c('H', '2'), c('H', '2')], hand, [c('H', '5'), c('H', '8')])).toBe(false);
  });
  it('led pair + hand has no pair → two singles ok', () => {
    const hand = [c('H', '5'), c('H', '8'), c('D', '2')];
    expect(follow([c('H', '2'), c('H', '2')], hand, [c('H', '5'), c('H', '8')])).toBe(true);
  });
  it('led tractor(2 pairs) + hand has 2 pairs (+1 extra) → must play both pairs', () => {
    const lead = [c('H', '2'), c('H', '2'), c('H', '3'), c('H', '3')];
    const hand = [c('H', '5'), c('H', '5'), c('H', '9'), c('H', '9'), c('H', '10')]; // 5 张，有得选
    expect(follow(lead, hand, [c('H', '5'), c('H', '5'), c('H', '9'), c('H', '9')])).toBe(true);
    // 只出 1 对、拆掉另一对 → 不合法（有 2 对却只贡献 1 对）
    expect(follow(lead, hand, [c('H', '5'), c('H', '5'), c('H', '9'), c('H', '10')])).toBe(false);
  });
});
