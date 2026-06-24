import type { Card, Rank, Suit } from './domain';
import { rankValue } from './trump';

const SUIT_RANK: Record<Suit, number> = { S: 3, H: 2, C: 1, D: 0 }; // 黑>红>梅>方

/** 花色序值（tiebreak 用）§7 */
export function suitRank(s: Suit): number {
  return SUIT_RANK[s];
}

/** 一次亮主声明：玩家、所亮花色、出示的该花色级牌张数（≥1，前提持两王）§7 */
export interface Declaration {
  readonly player: number;
  readonly suit: Suit;
  readonly count: number;
}

/** 手里王的张数 */
export function countJokers(hand: Card[]): number {
  return hand.filter((c) => c.kind === 'joker').length;
}

/** 手里某花色级牌张数 */
export function levelCardsOfSuit(hand: Card[], level: Rank, suit: Suit): number {
  return hand.filter((c) => c.kind === 'suited' && c.rank === level && c.suit === suit).length;
}

/** 能否亮某花色为主（两王 + ≥1 张该花色级牌）§7 */
export function canDeclare(hand: Card[], level: Rank, suit: Suit): boolean {
  return countJokers(hand) >= 2 && levelCardsOfSuit(hand, level, suit) >= 1;
}

/** a 是否压过 b（张数多者胜；同张数花色序）§7 */
export function declarationBeats(a: Declaration, b: Declaration): boolean {
  if (a.count !== b.count) return a.count > b.count;
  return suitRank(a.suit) > suitRank(b.suit);
}

/** 反主是否成立：必须换门（不同花色）且压过当前主（§7 rev-B：不允许同花色反）*/
export function canCounter(current: Declaration, attempt: Declaration): boolean {
  return attempt.suit !== current.suit && declarationBeats(attempt, current);
}

/** 按时序结算亮主/反底：首亮定主、后续仅"换门且压过当前主"的反生效，无则 null（§7 rev-B）*/
export function resolveTrump(decls: Declaration[]): Declaration | null {
  let current: Declaration | null = null;
  for (const d of decls) {
    if (current === null) current = d; // 首亮无约束
    else if (canCounter(current, d)) current = d; // 合法反：换门 + 压过
  }
  return current;
}

/** 亮主轮一次动作：亮（声明花色+张数）或 pass（弃权）§7 rev-B */
export type DeclareAction =
  | { readonly player: number; readonly type: 'declare'; readonly suit: Suit; readonly count: number }
  | { readonly player: number; readonly type: 'pass' };

/**
 * 跑亮主轮（§7 rev-B）：动作按座位时序（从庄家起）给入。
 * pass → 本局失去反主权；已弃权者之后的 declare 一律无效。返回最终主 + 弃权名单。
 */
export function runDeclarePhase(actions: DeclareAction[]): { trump: Suit | null; forfeited: number[] } {
  const forfeited = new Set<number>();
  let current: Declaration | null = null;
  for (const a of actions) {
    if (a.type === 'pass') {
      forfeited.add(a.player);
      continue;
    }
    if (forfeited.has(a.player)) continue; // 已弃权，亮/反无效
    const d: Declaration = { player: a.player, suit: a.suit, count: a.count };
    if (current === null) current = d;
    else if (canCounter(current, d)) current = d;
  }
  return { trump: current ? current.suit : null, forfeited: [...forfeited] };
}

/**
 * 无人亮主 → 翻底定主（§7）：
 * 1. 底里有级牌（rank=level）→ 取其中花色最高者的花色为主；
 * 2. 否则取底里点数最大的牌（同点取花色高）的花色为主；
 * 3. 王无花色、不参与定主。
 */
export function flipKittyForTrump(kitty: Card[], level: Rank): Suit | null {
  const suited = kitty.filter((c): c is Extract<Card, { kind: 'suited' }> => c.kind === 'suited');
  const levels = suited.filter((c) => c.rank === level);
  const pool = levels.length > 0 ? levels : suited;
  if (pool.length === 0) return null;
  let best = pool[0]!;
  for (const c of pool) {
    if (
      rankValue(c.rank) > rankValue(best.rank) ||
      (rankValue(c.rank) === rankValue(best.rank) && suitRank(c.suit) > suitRank(best.suit))
    ) {
      best = c;
    }
  }
  return best.suit;
}
