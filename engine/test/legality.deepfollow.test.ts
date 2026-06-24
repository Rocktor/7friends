import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import type { TrumpCtx } from '../src/trump';
import { classifyLead, isLegalFollow } from '../src/legality';

const ctx: TrumpCtx = { level: '7', trump: 'S' };
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });
const follow = (leadCards: Card[], hand: Card[], play: Card[]) =>
  isLegalFollow(classifyLead(leadCards, ctx), hand, play, ctx);

describe('S11 深度跟牌：降级链 + 不拆大聚合 (§9 rev-B)', () => {
  it('领三张 + 手有三张 → 必出三张（不能拆成对+单）', () => {
    const lead = [c('H', '2'), c('H', '2'), c('H', '2')];
    const hand = [c('H', '5'), c('H', '5'), c('H', '5'), c('H', '8'), c('H', '8')];
    expect(follow(lead, hand, [c('H', '5'), c('H', '5'), c('H', '5')])).toBe(true);
    expect(follow(lead, hand, [c('H', '5'), c('H', '5'), c('H', '8')])).toBe(false); // 拆了三张
  });

  it('领三张 + 手只有四张(无独立三张) → 可不拆（lead3/hold4）', () => {
    const lead = [c('H', '2'), c('H', '2'), c('H', '2')];
    const hand = [c('H', '5'), c('H', '5'), c('H', '5'), c('H', '5'), c('H', '8')]; // 四张5 + 单8
    // 不强制从四张里劈出三张：出 5-5-8 合法（保住四张不被强拆）
    expect(follow(lead, hand, [c('H', '5'), c('H', '5'), c('H', '8')])).toBe(true);
    // 出三个5也合法
    expect(follow(lead, hand, [c('H', '5'), c('H', '5'), c('H', '5')])).toBe(true);
  });

  it('领四张 + 手有三张(无四张) → 降级必出三张', () => {
    const lead = [c('H', '2'), c('H', '2'), c('H', '2'), c('H', '2')];
    const hand = [c('H', '5'), c('H', '5'), c('H', '5'), c('H', '8'), c('H', '9')];
    // need=4，必含三张组
    expect(follow(lead, hand, [c('H', '5'), c('H', '5'), c('H', '5'), c('H', '8')])).toBe(true);
    // 把三张拆了（只出一对）→ 非法
    expect(follow(lead, hand, [c('H', '5'), c('H', '5'), c('H', '8'), c('H', '9')])).toBe(false);
  });

  it('领对子 + 手只有三张(无独立对) → 不强制拆三张凑对', () => {
    const lead = [c('H', '2'), c('H', '2')];
    const hand = [c('H', '5'), c('H', '5'), c('H', '5'), c('H', '8')]; // 三张5 + 单8
    // 不拆三张：出 5-8 合法
    expect(follow(lead, hand, [c('H', '5'), c('H', '8')])).toBe(true);
  });
});
