import type { Card } from './domain';
import type { TrumpCtx } from './trump';
import { isTrump, trumpStrength, rankValue } from './trump';
import { classifyLead, type Combo } from './legality';

export interface PlayInTrick {
  readonly player: number;
  readonly cards: Card[];
}

/** 同型同张数（拖拉机还需同 m、同 len）才可比 §9 */
function sameShape(a: Combo, b: Combo): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'single') return true;
  if (a.type === 'nkind' && b.type === 'nkind') return a.n === b.n;
  if (a.type === 'tractor' && b.type === 'tractor') return a.m === b.m && a.len === b.len;
  return false; // throw / illegal 不参与
}

/** 一手牌的"最高牌"强度（主牌用 trumpStrength，副牌用点数）*/
function topStrength(cards: Card[], ctx: TrumpCtx): number {
  let best = -1;
  for (const c of cards) {
    const s = isTrump(c, ctx) ? trumpStrength(c, ctx)! : rankValue((c as Extract<Card, { kind: 'suited' }>).rank);
    if (s > best) best = s;
  }
  return best;
}

interface Contender {
  readonly trump: boolean;
  readonly strength: number;
}

/** 该手相对领出是否够格争墩，及其强度（主压副、同组比点；异副花色/不同型 → null）*/
function contender(combo: Combo, cards: Card[], ctx: TrumpCtx, lead: Combo): Contender | null {
  if (lead.type === 'illegal' || combo.type === 'illegal') return null;
  if (!sameShape(combo, lead)) return null;
  const leadGroup = 'group' in lead ? lead.group : undefined;
  const myGroup = 'group' in combo ? combo.group : undefined;
  if (myGroup === leadGroup) {
    return { trump: leadGroup === 'TRUMP', strength: topStrength(cards, ctx) };
  }
  if (myGroup === 'TRUMP' && leadGroup !== 'TRUMP') {
    return { trump: true, strength: topStrength(cards, ctx) }; // 用主吃
  }
  return null; // 异副花色，垫牌不争墩
}

function beats(a: Contender, b: Contender): boolean {
  if (a.trump !== b.trump) return a.trump; // 主压副
  return a.strength > b.strength;
}

/** 一墩定赢家：plays[0] 为领出。返回赢家 player §9 */
export function trickWinner(plays: PlayInTrick[], ctx: TrumpCtx): number {
  const lead = classifyLead(plays[0]!.cards, ctx);
  let winIdx = 0;
  let bestKey = contender(lead, plays[0]!.cards, ctx, lead)!; // 领出自身必为 contender

  for (let i = 1; i < plays.length; i++) {
    const combo = classifyLead(plays[i]!.cards, ctx);
    const key = contender(combo, plays[i]!.cards, ctx, lead);
    if (key && beats(key, bestKey)) {
      bestKey = key;
      winIdx = i;
    }
  }
  return plays[winIdx]!.player;
}
