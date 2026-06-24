import type { Card, Rank, Suit } from './domain';

/** 当局叫牌点：打 A → 叫 K，其余 → 叫 A（§8） */
export function callRank(level: Rank): Rank {
  return level === 'A' ? 'K' : 'A';
}

/** 一次叫朋友：花色 + 第 N 张（点数隐含 = callRank）§8 */
export interface FriendCall {
  readonly suit: Suit;
  readonly nth: number;
}

/** 一次"叫牌点牌"的打出（按时间顺序，仅含 rank===callRank 的牌）§8 */
export interface CallCardPlay {
  readonly player: number;
  readonly suit: Suit;
}

/** 按打出先后揭示每个 call 的朋友玩家；未到第 N 张 → null（朋友位空缺）§8 */
export function resolveFriends(calls: FriendCall[], plays: CallCardPlay[]): (number | null)[] {
  return calls.map((call) => {
    const matches = plays.filter((p) => p.suit === call.suit);
    const hit = matches[call.nth - 1];
    return hit ? hit.player : null;
  });
}

/** 该牌能否扣进底（当局叫牌点不可扣）§8 */
export function isBuriable(card: Card, level: Rank): boolean {
  if (card.kind === 'joker') return true;
  return card.rank !== callRank(level);
}
