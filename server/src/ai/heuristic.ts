import {
  type Card, type Rank, type Suit, type TrumpCtx,
  isTrump, cardPoints, trickWinner, callRank, isBuriable, countJokers, levelCardsOfSuit, type FriendCall,
} from '@engine';
import { legalPlays, strength } from './moves';
import type { Room } from '../room/room';

const SUITS: Suit[] = ['S', 'H', 'C', 'D'];

function totalStrength(p: Card[], ctx: TrumpCtx): number {
  return p.reduce((s, c) => s + strength(c, ctx), 0);
}
function minByStrength(opts: Card[][], ctx: TrumpCtx): Card[] {
  return opts.reduce((best, p) => (totalStrength(p, ctx) < totalStrength(best, ctx) ? p : best));
}
function trickPoints(trick: { seat: number; cards: Card[] }[]): number {
  return trick.reduce((s, t) => s + t.cards.reduce((a, c) => a + cardPoints(c), 0), 0);
}
/** 在已出牌基础上，play 是否当前压住全场（不含尚未行动的家）*/
function currentlyWins(trick: { seat: number; cards: Card[] }[], play: Card[], ctx: TrumpCtx): boolean {
  const plays = trick.map((t) => ({ player: t.seat, cards: t.cards }));
  plays.push({ player: 999, cards: play });
  return trickWinner(plays, ctx) === 999;
}

/** 出牌决策（核心）：领牌探小、跟牌见分则用最小够赢的抢、否则垫最小 */
export function choosePlay(hand: Card[], trickSoFar: { seat: number; cards: Card[] }[], ctx: TrumpCtx): Card[] {
  const leadCards = trickSoFar.length ? trickSoFar[0]!.cards : null;
  const options = legalPlays(hand, leadCards, ctx);
  if (!options.length) return [hand[0]!];
  if (leadCards === null) {
    // 领牌：有对子优先出对（建立控制、逼对），不傻傻出单张（Rocktor 2026-06-24）。
    // 先出较小的非主对子探路，保留大对/主牌（更深的"算控制权"= 2.4.3 ISMCTS）。
    const pairs = options.filter((o) => o.length === 2);
    if (pairs.length) {
      const nonTrump = pairs.filter((o) => !isTrump(o[0]!, ctx));
      return minByStrength(nonTrump.length ? nonTrump : pairs, ctx);
    }
    const singles = options.filter((o) => o.length === 1);
    const nonTrump = singles.filter((o) => !isTrump(o[0]!, ctx));
    return minByStrength(nonTrump.length ? nonTrump : singles.length ? singles : options, ctx);
  }
  const pts = trickPoints(trickSoFar);
  const winners = options.filter((p) => currentlyWins(trickSoFar, p, ctx));
  if (winners.length && pts > 0) return minByStrength(winners, ctx); // 有分墩 → 用最小够赢的拿下
  return minByStrength(options, ctx); // 无分或赢不了 → 垫最小
}

/** 亮主决策：两王 + 某花色≥2 级牌 → 亮该花色（取级牌最多者）；否则不亮 */
export function chooseDeclare(hand: Card[], level: Rank): { suit: Suit; count: number } | null {
  if (countJokers(hand) < 2) return null;
  let best: { suit: Suit; count: number } | null = null;
  for (const s of SUITS) {
    const n = levelCardsOfSuit(hand, level, s);
    if (n >= 2 && (!best || n > best.count)) best = { suit: s, count: n };
  }
  return best;
}

/** 扣底决策：扣 9 张最弱的可扣牌，尽量不扣分牌 */
export function chooseBury(hand: Card[], level: Rank, ctx: TrumpCtx): Card[] {
  const buriable = hand.filter((c) => isBuriable(c, level));
  return [...buriable]
    .sort((a, b) => {
      const pa = cardPoints(a) > 0 ? 1 : 0, pb = cardPoints(b) > 0 ? 1 : 0;
      if (pa !== pb) return pa - pb; // 分牌排后
      return strength(a, ctx) - strength(b, ctx); // 弱的在前
    })
    .slice(0, 9);
}

/**
 * 叫朋友（Rocktor 2026-06-24 指点；启发式、非绝对保证）：
 * ① 每门叫 **nth = 自己持有该A数 + 1** → 降低叫到自己的概率（倾向自己先出占位）。
 *    注意：揭示按**全局打出先后**计数，最终第 nth 张是不是自己取决于实际出牌顺序，故非绝对——
 *    真要"必不叫到自己"需配合出牌期主动先打掉自己的该 A（属 2.4 后续策略，未强约束）。
 * ② 两叫拆到**不同花色** → 减少两友落到同一人。偏好自己有控制力的花色。
 */
export function chooseCall(hand: Card[], level: Rank): FriendCall[] {
  const cr = callRank(level);
  const held = (s: Suit) => hand.filter((c) => c.kind === 'suited' && c.suit === s && c.rank === cr).length;
  const ranked = SUITS.map((s) => ({ s, n: held(s) + 1 }))
    .filter((x) => x.n <= 6)
    .sort((a, b) => b.n - a.n); // 持有多者在前（先出占位、控制揭示时机）
  const pick = ranked.slice(0, 2);
  while (pick.length < 2) {
    const used = new Set(pick.map((p) => p.s));
    const extra = SUITS.find((s) => !used.has(s));
    if (!extra) break;
    pick.push({ s: extra, n: 1 });
  }
  return pick.map((x) => ({ suit: x.s, nth: x.n }));
}

/** 替当前 AI 行动座做一个"强 AI"决策并应用到 room。返回是否行动 */
export function heuristicAct(room: Room): boolean {
  const s = room.session;
  if (!s || s.isOver()) return false;
  const seat = s.currentActor();
  if (seat === null) return false;
  const v = s.view(seat);
  const ctx: TrumpCtx | null = v.trump ? { level: v.level, trump: v.trump } : null;
  switch (v.phase) {
    case 'declare': {
      // 亮主：若选不出或当前主反不动（换门/张数不够）→ 改 pass，避免卡死
      const d = chooseDeclare(v.hand, v.level);
      if (d && room.declare(seat, d.suit, d.count).ok) return true;
      return room.pass(seat).ok;
    }
    case 'bury':
      return room.bury(seat, chooseBury(v.hand, v.level, ctx!)).ok;
    case 'call':
      return room.call(seat, chooseCall(v.hand, v.level)).ok;
    case 'play':
      return room.play(seat, choosePlay(v.hand, v.trickSoFar, ctx!)).ok;
    default:
      return false;
  }
}

/** 连续替 AI 座行动直到轮到人类/结束 */
export function runHeuristicAI(room: Room, max = 1000): number {
  let n = 0;
  while (room.isAITurn() && n < max) {
    if (!heuristicAct(room)) break;
    n++;
  }
  return n;
}
