import {
  type Card, type TrumpCtx, type Combo,
  comboGroup, classifyLead, isLegalFollow, isTrump, trumpStrength, rankValue,
} from '@engine';

/** 牌强度（主用 trumpStrength，副用点数），用于排序 */
export function strength(c: Card, ctx: TrumpCtx): number {
  return isTrump(c, ctx) ? trumpStrength(c, ctx)! + 100 : rankValue((c as Extract<Card, { kind: 'suited' }>).rank);
}

function identity(c: Card): string {
  return c.kind === 'joker' ? `J${c.joker}` : `${c.suit}${c.rank}`;
}

function tally(cards: Card[]): Map<string, Card[]> {
  const m = new Map<string, Card[]>();
  for (const c of cards) (m.get(identity(c)) ?? m.set(identity(c), []).get(identity(c))!).push(c);
  return m;
}

function* combinations(pool: Card[], n: number): Generator<Card[]> {
  if (n === 0) return yield [];
  if (n > pool.length) return;
  const [head, ...rest] = pool;
  for (const c of combinations(rest, n - 1)) yield [head!, ...c];
  yield* combinations(rest, n);
}

/** 生成候选领出牌型：单张 + 各 n 张同点（n≥2）。供启发式择优。 */
export function genLeads(hand: Card[], _ctx: TrumpCtx): Card[][] {
  const out: Card[][] = [];
  const groups = tally(hand);
  for (const cards of groups.values()) {
    out.push([cards[0]!]); // 单张
    for (let n = 2; n <= cards.length; n++) out.push(cards.slice(0, n)); // 对/三/四…
  }
  return out;
}

/** 生成候选合法跟牌（有界枚举 + engine 校验）。lead 为领出牌型。 */
export function genFollows(lead: Combo, hand: Card[], ctx: TrumpCtx): Card[][] {
  if (lead.type === 'illegal') return [];
  const N = lead.size;
  const g = lead.group;
  const handG = hand.filter((c) => comboGroup(c, ctx) === g);
  let pool: Card[];
  if (handG.length >= N) {
    pool = handG;
  } else {
    const others = hand.filter((c) => comboGroup(c, ctx) !== g).sort((a, b) => strength(a, ctx) - strength(b, ctx));
    pool = [...handG, ...others.slice(0, N - handG.length + 3)];
  }
  // 不裁剪 handG（裁剪会漏掉真实存在的合法跟牌 → 死锁）；规模靠 N 小(AI 领出≤2)+输出上限控
  const out: Card[][] = [];
  for (const combo of combinations(pool, N)) {
    if (isLegalFollow(lead, hand, combo, ctx)) out.push(combo);
    if (out.length >= 80) break;
  }
  // 兜底：万一枚举为空（极端大手牌+大 N），构造一手保证合法的跟牌，杜绝死锁
  if (out.length === 0) out.push(forcedLegalFollow(lead, hand, ctx));
  return out;
}

/** 构造一手保证合法的跟牌（dump 优先；手中该门多于 N 则贪心保最大整组）— 死锁兜底 */
export function forcedLegalFollow(lead: Combo, hand: Card[], ctx: TrumpCtx): Card[] {
  if (lead.type === 'illegal') return hand.slice(0, 1);
  const N = lead.size;
  const g = lead.group;
  const handG = hand.filter((c) => comboGroup(c, ctx) === g).sort((a, b) => strength(a, ctx) - strength(b, ctx));
  const others = hand.filter((c) => comboGroup(c, ctx) !== g).sort((a, b) => strength(a, ctx) - strength(b, ctx));
  if (handG.length <= N) return [...handG, ...others.slice(0, N - handG.length)];
  // handG > N：按整组（对/三…）大小降序取，凑够 N（尽量保自然组）
  const groups = [...tally(handG).values()].sort((a, b) => b.length - a.length || strength(a[0]!, ctx) - strength(b[0]!, ctx));
  const picked: Card[] = [];
  for (const grp of groups) {
    for (const c of grp) if (picked.length < N) picked.push(c);
    if (picked.length >= N) break;
  }
  return picked.slice(0, N);
}

/** 当前可选的合法出牌集合（领牌或跟牌）。leadCards 为本墩领出（领牌方传 null）。 */
export function legalPlays(hand: Card[], leadCards: Card[] | null, ctx: TrumpCtx): Card[][] {
  if (leadCards === null) return genLeads(hand, ctx).filter((p) => classifyLead(p, ctx).type !== 'illegal');
  return genFollows(classifyLead(leadCards, ctx), hand, ctx);
}
