import type { Card, Suit } from './domain';
import type { TrumpCtx } from './trump';
import { isTrump, suitOrdinal, trumpStrength, rankValue } from './trump';

/** 花色归类：主牌统一归 'TRUMP'，否则各副花色（§9 一墩只比同组）*/
export type SuitClass = 'TRUMP' | Suit;

interface ComboBase {
  readonly group: SuitClass;
  readonly size: number;
}
export type Combo =
  | (ComboBase & { type: 'single' })
  | (ComboBase & { type: 'nkind'; n: number })
  | (ComboBase & { type: 'tractor'; m: number; len: number })
  | (ComboBase & { type: 'throw' })
  | { type: 'illegal' };

/** 牌的花色组（主 → 'TRUMP'）§9 */
export function comboGroup(c: Card, ctx: TrumpCtx): SuitClass {
  if (isTrump(c, ctx)) return 'TRUMP';
  // 非主必为 suited
  return (c as Extract<Card, { kind: 'suited' }>).suit;
}

/**
 * 牌在其花色组内的序位（§4.1）：
 * - 副花色：2..A 抽掉级牌后的序位（断点闭合）0..11；
 * - 主牌顶部贯穿：主花色其余 0..11 → 副级 12 → 主级 13 → 小王 14 → 大王 15。
 */
export function ordinalInGroup(c: Card, ctx: TrumpCtx): number {
  if (!isTrump(c, ctx)) {
    const s = c as Extract<Card, { kind: 'suited' }>;
    return suitOrdinal(s.rank, ctx.level);
  }
  if (c.kind === 'joker') return c.joker === 'BJ' ? 15 : 14;
  if (c.rank === ctx.level) return c.suit === ctx.trump ? 13 : 12; // 主级 / 副级
  return suitOrdinal(c.rank, ctx.level); // 主花色其余 0..11
}

function identity(c: Card): string {
  return c.kind === 'joker' ? `J${c.joker}` : `${c.suit}${c.rank}`;
}

function tally(cards: Card[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cards) m.set(identity(c), (m.get(identity(c)) ?? 0) + 1);
  return m;
}

/** play 是否为 hand 的子多重集 */
function isSubmultiset(play: Card[], hand: Card[]): boolean {
  const h = tally(hand);
  for (const [k, n] of tally(play)) if ((h.get(k) ?? 0) < n) return false;
  return true;
}

function sameMultiset(a: Card[], b: Card[]): boolean {
  if (a.length !== b.length) return false;
  const tb = tally(b);
  for (const [k, n] of tally(a)) if ((tb.get(k) ?? 0) !== n) return false;
  return true;
}

/** 可成对数（同身份每 2 张算 1 对）*/
function pairCount(cards: Card[]): number {
  let p = 0;
  for (const n of tally(cards).values()) p += Math.floor(n / 2);
  return p;
}

/** handG 中 size∈[2..n] 的最大整组（>n 的组不算，体现"不强拆大于 n 的整组"）§9 rev-B */
function largestIntactGroup(cards: Card[], n: number): number {
  let best = 0;
  for (const cnt of tally(cards).values()) if (cnt >= 2 && cnt <= n && cnt > best) best = cnt;
  return best;
}

/** 一手牌里最大同点组的张数 */
function maxGroupSize(cards: Card[]): number {
  let best = 0;
  for (const cnt of tally(cards).values()) if (cnt > best) best = cnt;
  return best;
}

/** 一手牌里"乘数 m 的拖拉机"最长连号 run（断点闭合按 ordinalInGroup）§9 I2 */
function maxTractorRun(cards: Card[], m: number, ctx: TrumpCtx): number {
  const ords = new Set<number>();
  for (const [id, cnt] of tally(cards)) {
    if (cnt >= m) ords.add(ordinalInGroup(cards.find((c) => identity(c) === id)!, ctx));
  }
  const sorted = [...ords].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = NaN;
  for (const o of sorted) {
    run = o === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = o;
  }
  return best;
}

/**
 * 是否合法跟牌（§9 跟牌强制度）。本版强制：
 *  ① 张数等于领出；② play ⊆ hand；
 *  ③ 跟门：必出 min(|手中该组|, N) 张该组牌；该组不足 N 时须全出；
 *  ④ 对子保留：领出含对/连对(m=2)时，须贡献 min(领出对数, 手中可成对数) 个对子。
 * 注：三张/四张及更高 m 的精确成型跟牌、拖拉机形状匹配 = §11 I2/I4 后续细化。
 */
export function isLegalFollow(lead: Combo, hand: Card[], play: Card[], ctx: TrumpCtx): boolean {
  if (lead.type === 'illegal') return false;
  const N = lead.size;
  if (play.length !== N) return false;
  if (!isSubmultiset(play, hand)) return false;

  const g = lead.group;
  const handG = hand.filter((c) => comboGroup(c, ctx) === g);
  const playG = play.filter((c) => comboGroup(c, ctx) === g);

  const need = Math.min(handG.length, N);
  if (playG.length !== need) return false;
  if (handG.length < N && !sameMultiset(playG, handG)) return false; // 该组不足须全出

  // n 张牌型：须含一个 size ≥ u 的同点组（u = handG 中 size∈[2..n] 的最大整组；不强拆 >n 的组）
  if (lead.type === 'nkind') {
    const u = largestIntactGroup(handG, lead.n);
    if (u >= 2 && maxGroupSize(playG) < u) return false;
  }
  if (lead.type === 'tractor') {
    // 连对(m=2)：须贡献 min(领出对数, 手中可成对数) 个对子
    if (lead.m === 2) {
      const mustPairs = Math.min(lead.len, pairCount(handG));
      if (pairCount(playG) < mustPairs) return false;
    }
    // 形状严格化（I2）：手里能凑出多长的连拖就必须打多长（≤ 领出长度），不许拆成非连号
    const requiredRun = Math.min(lead.len, maxTractorRun(handG, lead.m, ctx));
    if (requiredRun >= 2 && maxTractorRun(playG, lead.m, ctx) < requiredRun) return false;
  }
  return true;
}

/** 把一手"领出"牌识别为牌型（§9：单/对…六张/拖拉机/甩牌）。混组或空 → illegal */
export function classifyLead(cards: Card[], ctx: TrumpCtx): Combo {
  if (cards.length === 0) return { type: 'illegal' };

  const groups = new Set(cards.map((c) => comboGroup(c, ctx)));
  if (groups.size > 1) return { type: 'illegal' };
  const group = [...groups][0]!;
  const size = cards.length;

  if (size === 1) return { type: 'single', group, size };

  // 按牌面身份分组（同花同点才算一份 → 自动满足"副级对须同花"）
  const byId = new Map<string, Card[]>();
  for (const c of cards) {
    const k = identity(c);
    (byId.get(k) ?? byId.set(k, []).get(k)!).push(c);
  }

  if (byId.size === 1) return { type: 'nkind', group, size, n: size };

  // 拖拉机：所有 identity 组同大小 m≥2，且各组序位连续递增
  const parts = [...byId.values()];
  const m = parts[0]!.length;
  const uniformM = m >= 2 && parts.every((p) => p.length === m);
  if (uniformM) {
    const ordinals = parts.map((p) => ordinalInGroup(p[0]!, ctx)).sort((a, b) => a - b);
    const distinct = new Set(ordinals).size === ordinals.length;
    const consecutive = ordinals.every((o, i) => i === 0 || o === ordinals[i - 1]! + 1);
    if (distinct && consecutive) {
      return { type: 'tractor', group, size, m, len: parts.length };
    }
  }

  return { type: 'throw', group, size };
}

/** 一张牌的强度（主用 trumpStrength，副用点数）— 甩牌裁决用 */
function cardStrength(c: Card, ctx: TrumpCtx): number {
  return isTrump(c, ctx)
    ? trumpStrength(c, ctx)!
    : rankValue((c as Extract<Card, { kind: 'suited' }>).rank);
}

export interface ThrowResult {
  readonly ok: boolean;
  readonly forced: Card[]; // ok=true → 整把；ok=false → 被迫的最小一手
}

/** 某手能否压住一个 piece（同组更大同张数组 或 空门用主吃）*/
function canBeatPiece(piece: Card[], hand: Card[], ctx: TrumpCtx, group: SuitClass): boolean {
  const k = piece.length;
  const s = cardStrength(piece[0]!, ctx);
  const handG = hand.filter((c) => comboGroup(c, ctx) === group);
  for (const [id, cnt] of tally(handG)) {
    if (cnt >= k) {
      const card = handG.find((c) => identity(c) === id)!;
      if (cardStrength(card, ctx) > s) return true; // 同组更大 k 张组
    }
  }
  if (group !== 'TRUMP' && handG.length === 0) {
    for (const cnt of tally(hand.filter((c) => comboGroup(c, ctx) === 'TRUMP')).values()) {
      if (cnt >= k) return true; // 空门 → 主 k 张组可吃
    }
  }
  return false;
}

/**
 * 甩牌整桌裁决（§9 G3 rev-B）：把甩牌拆成自然单元，若任一单元能被任一其他家压住 →
 * 甩牌失败、回退"最小一手"（强度最低的单元）；否则成功、整把出。
 */
export function validateThrow(thrown: Card[], otherHands: Card[][], ctx: TrumpCtx): ThrowResult {
  const group = comboGroup(thrown[0]!, ctx);
  const byId = new Map<string, Card[]>();
  for (const c of thrown) {
    const k = identity(c);
    const arr = byId.get(k) ?? [];
    arr.push(c);
    byId.set(k, arr);
  }
  const pieces = [...byId.values()];
  const beatable = pieces.some((p) => otherHands.some((h) => canBeatPiece(p, h, ctx, group)));
  if (!beatable) return { ok: true, forced: thrown };

  let weakest = pieces[0]!;
  for (const p of pieces) {
    if (cardStrength(p[0]!, ctx) < cardStrength(weakest[0]!, ctx)) weakest = p;
  }
  return { ok: false, forced: weakest };
}
