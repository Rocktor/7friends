import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import type { TrumpCtx } from '../src/trump';
import { classifyLead, isLegalFollow } from '../src/legality';

const ctx: TrumpCtx = { level: '7', trump: 'S' };
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });
const follow = (leadCards: Card[], hand: Card[], play: Card[]) =>
  isLegalFollow(classifyLead(leadCards, ctx), hand, play, ctx);

describe('S13 拖拉机形状跟牌严格化 (§9 / I2)', () => {
  const leadTractor2 = [c('H', '2'), c('H', '2'), c('H', '3'), c('H', '3')]; // 连对 len2

  it('手握真连拖 → 必须打连拖，不许拆成非连号散对', () => {
    // 手里 H5H5-H6H6 是连号真拖 + H9H9 散对
    const hand = [c('H', '5'), c('H', '5'), c('H', '6'), c('H', '6'), c('H', '9'), c('H', '9')];
    // 打连号 5566 → 合法
    expect(follow(leadTractor2, hand, [c('H', '5'), c('H', '5'), c('H', '6'), c('H', '6')])).toBe(true);
    // 拆成非连号 5599 → 非法（有真拖却不打）
    expect(follow(leadTractor2, hand, [c('H', '5'), c('H', '5'), c('H', '9'), c('H', '9')])).toBe(false);
  });

  it('手里两散对(无连号) → 不强制连拖，打两散对合法', () => {
    // H5H5 + H9H9，ord 不相邻 → 凑不出连拖
    const hand = [c('H', '5'), c('H', '5'), c('H', '9'), c('H', '9'), c('H', '10')];
    expect(follow(leadTractor2, hand, [c('H', '5'), c('H', '5'), c('H', '9'), c('H', '9')])).toBe(true);
  });

  it('断点闭合的连号也算真拖（打7：H6H6-H8H8 是连拖）', () => {
    const hand = [c('H', '6'), c('H', '6'), c('H', '8'), c('H', '8'), c('H', 'K'), c('H', 'K')];
    // 6688 跨级牌7 仍连号 → 必须打它，拆成 66KK 非法
    expect(follow(leadTractor2, hand, [c('H', '6'), c('H', '6'), c('H', '8'), c('H', '8')])).toBe(true);
    expect(follow(leadTractor2, hand, [c('H', '6'), c('H', '6'), c('H', 'K'), c('H', 'K')])).toBe(false);
  });

  it('领长连拖 len3、手里只有 len2 连拖 → 须打出 len2 连拖 + 补', () => {
    const lead3 = [c('H', '2'), c('H', '2'), c('H', '3'), c('H', '3'), c('H', '4'), c('H', '4')]; // len3
    const hand = [c('H', '5'), c('H', '5'), c('H', '6'), c('H', '6'), c('H', '9'), c('H', '9'), c('H', '10')];
    // 5566(连拖2) + 99 → 合法（实现了最长可凑 len2）
    expect(follow(lead3, hand, [c('H', '5'), c('H', '5'), c('H', '6'), c('H', '6'), c('H', '9'), c('H', '9')])).toBe(true);
    // 拆掉连号：5599 + 6,10 → 没实现 len2 连拖 → 非法
    expect(follow(lead3, hand, [c('H', '5'), c('H', '5'), c('H', '9'), c('H', '9'), c('H', '6'), c('H', '10')])).toBe(false);
  });
});
