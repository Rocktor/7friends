import type { Card, Rank, Suit } from './domain';
import { RANKS } from './domain';

/** 本局主牌上下文：级牌点数 + 主花色（§4） */
export interface TrumpCtx {
  readonly level: Rank;
  readonly trump: Suit;
}

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14,
};

/** 点数基础值 2..14（A 最大） */
export function rankValue(r: Rank): number {
  return RANK_VALUE[r];
}

/** 是否主牌（王 / 级牌任意花色 / 主花色牌）§4 */
export function isTrump(c: Card, ctx: TrumpCtx): boolean {
  if (c.kind === 'joker') return true;
  return c.rank === ctx.level || c.suit === ctx.trump;
}

/**
 * 主牌强度（§4.1 大→小）：大王 > 小王 > 主级 > 副级 > 主花色其余(A..2 跳过级)。
 * 非主牌返回 undefined。分层常数保证层间不重叠。
 */
export function trumpStrength(c: Card, ctx: TrumpCtx): number | undefined {
  if (c.kind === 'joker') return c.joker === 'BJ' ? 6000 : 5000;
  if (c.rank === ctx.level) return c.suit === ctx.trump ? 4000 : 3000; // 主级 / 副级
  if (c.suit === ctx.trump) return 2000 + rankValue(c.rank); // 主花色其余（最高 主A=2014 < 副级3000）
  return undefined; // 非主
}

/** 某点数在"2..A 抽掉级牌"序列里的序位（断点闭合，副花色拖拉机连法用）§4.1 */
export function suitOrdinal(rank: Rank, level: Rank): number {
  return RANKS.filter((r) => r !== level).indexOf(rank);
}
