// 域基础类型 — 找朋友升级（7人6副牌）
// 真理源：specs/rules-spec-v1.0.md §2 牌组构成

/** 花色，序值用于"同张数 tiebreak 黑>红>梅>方"（§7）：S=3 H=2 C=1 D=0 */
export type Suit = 'S' | 'H' | 'C' | 'D'; // 黑桃 红桃 梅花 方片
export const SUITS: readonly Suit[] = ['S', 'H', 'C', 'D'];

/** 点数（2..A）。'10' 用字符串避免与数字混淆 */
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'J' | 'Q' | 'K' | 'A';
export const RANKS: readonly Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A',
];

/** 王：大王 / 小王 */
export type JokerKind = 'BJ' | 'LJ'; // Big Joker 大王 / Little Joker 小王

/** 一张牌：普通花色牌 或 王。6 副牌 → 同一 Card 有 6 份（值对象，按多重集处理） */
export type Card =
  | { readonly kind: 'suited'; readonly suit: Suit; readonly rank: Rank }
  | { readonly kind: 'joker'; readonly joker: JokerKind };

/** 副数 */
export const DECKS = 6;
