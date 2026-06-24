import { type Card, type Rank, buildDeck, makeRng } from '@engine';
import { GameSession, type PlayState } from '../session/gameSession';
import { legalPlays } from './moves';
import { choosePlay, heuristicAct } from './heuristic';
import type { Room } from '../room/room';

const N = 7;
function key(c: Card): string {
  return c.kind === 'joker' ? `J${c.joker}` : `${c.suit}${c.rank}`;
}
function shuffleInPlace(a: Card[], rng: () => number): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!; a[i] = a[j]!; a[j] = t;
  }
}

/**
 * 决定化（determinization）：固定 mySeat 的真手牌，把"未见牌"（全牌库 − 已打出 − 我的手牌）
 * 随机重分给其他座的手牌(各自张数不变) + 底牌。模拟"我不知道别人手里是什么"的可能世界。
 */
export function determinize(state: PlayState, mySeat: number, rng: () => number): PlayState {
  const seen = new Map<string, number>();
  const inc = (c: Card) => seen.set(key(c), (seen.get(key(c)) ?? 0) + 1);
  state.trickWins.forEach((t) => t.cards.forEach(inc));
  state.trick.forEach((p) => p.cards.forEach(inc));
  state.hands[mySeat]!.forEach(inc);

  const pool: Card[] = [];
  const rem = new Map(seen);
  for (const c of buildDeck()) {
    const k = key(c);
    const n = rem.get(k) ?? 0;
    if (n > 0) rem.set(k, n - 1);
    else pool.push(c);
  }
  shuffleInPlace(pool, rng);

  const newHands = state.hands.map((h) => h.slice());
  let idx = 0;
  for (let s = 0; s < N; s++) {
    if (s === mySeat) continue;
    const n = state.hands[s]!.length;
    newHands[s] = pool.slice(idx, idx + n);
    idx += n;
  }
  const newKitty = pool.slice(idx, idx + state.kitty.length);
  return { ...state, hands: newHands, kitty: newKitty };
}

function rolloutToEnd(sim: GameSession, level: Rank): void {
  let guard = 0;
  while (!sim.isOver() && guard++ < 2000) {
    const seat = sim.currentActor();
    if (seat === null) break;
    const v = sim.view(seat);
    if (!sim.play(seat, choosePlay(v.hand, v.trickSoFar, { level, trump: v.trump! })).ok) break;
  }
}

export interface SearchOpts {
  readonly K: number; // 每个候选的决定化采样次数
  readonly seedBase: number;
}

/**
 * 平面蒙特卡洛 ISMCTS（不完全信息）：对每个合法着法，跑 K 次"决定化 + 启发式 rollout 到局终"，
 * 取我方期望最优（我属庄队则底分越低越好，属闲家则越高越好）。
 */
export function searchChoosePlay(
  state: PlayState,
  mySeat: number,
  level: Rank,
  dealer: number,
  opts: SearchOpts,
): Card[] {
  const ctx = { level, trump: state.trump };
  const myHand = state.hands[mySeat]!;
  const leadCards = state.trick.length ? state.trick[0]!.cards : null;
  const options = legalPlays(myHand, leadCards, ctx);
  if (options.length <= 1) return options[0] ?? [myHand[0]!];

  let best = options[0]!;
  let bestScore = -Infinity;
  for (let oi = 0; oi < options.length; oi++) {
    const opt = options[oi]!;
    let total = 0;
    for (let k = 0; k < opts.K; k++) {
      const rng = makeRng(opts.seedBase + oi * 7919 + k);
      const det = determinize(state, mySeat, rng);
      const sim = new GameSession({ seed: 0, dealer, level, resume: det });
      if (!sim.play(mySeat, opt).ok) { total -= 999; continue; }
      rolloutToEnd(sim, level);
      if (!sim.isOver()) { total -= 999; continue; }
      const res = sim.result();
      const declarers = new Set([dealer, ...res.friends.filter((f): f is number => f !== null)]);
      total += declarers.has(mySeat) ? -res.defenderScore : res.defenderScore;
    }
    const avg = total / opts.K;
    if (avg > bestScore) { bestScore = avg; best = opt; }
  }
  return best;
}

const ENDGAME_HAND = 5; // 手牌 ≤5 张进入搜索（rollout 短、算控制权最值；前中盘用启发式保实时）

/** 强 AI 行动：残局用 ISMCTS 搜索算控制权，其余阶段/前中盘用启发式。 */
export function strongAct(room: Room): boolean {
  const s = room.session;
  if (!s || s.isOver()) return false;
  const seat = s.currentActor();
  if (seat === null) return false;
  const v = s.view(seat);
  if (v.phase === 'play' && v.trump && v.hand.length <= ENDGAME_HAND) {
    const play = searchChoosePlay(s.snapshot(), seat, v.level, s.dealer, { K: 4, seedBase: v.hand.length * 31 + seat });
    return room.play(seat, play).ok;
  }
  return heuristicAct(room);
}

/** 连续替 AI 座行动（强 AI = 启发式 + 残局搜索）直到轮到人类/结束 */
export function runStrongAI(room: Room, max = 2000): number {
  let n = 0;
  while (room.isAITurn() && n < max) {
    if (!strongAct(room)) break;
    n++;
  }
  return n;
}
