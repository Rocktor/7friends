import { describe, it, expect } from 'vitest';
import { buildDeck, shuffle, deal, makeRng, type Card } from '@engine';
import { GameSession } from '../src/session/gameSession';
import { determinize, searchChoosePlay, runStrongAI } from '../src/ai/search';
import { legalPlays } from '../src/ai/moves';
import { Room } from '../src/room/room';

function key(c: Card): string {
  return c.kind === 'joker' ? `J${c.joker}` : `${c.suit}${c.rank}`;
}
function sameMulti(a: Card[], b: Card[]): boolean {
  if (a.length !== b.length) return false;
  const m = new Map<string, number>();
  for (const c of a) m.set(key(c), (m.get(key(c)) ?? 0) + 1);
  for (const c of b) {
    const n = (m.get(key(c)) ?? 0) - 1;
    if (n < 0) return false;
    m.set(key(c), n);
  }
  return true;
}

describe('determinize 决定化 (2.4.3)', () => {
  it('保留我的真手牌 + 各座张数 + 底牌张数 + 牌库合法(每种≤6)', () => {
    const { hands, kitty } = deal(shuffle(buildDeck(), 5));
    const state = new GameSession({ seed: 0, dealer: 0, level: '7', trump: 'S', hands, kitty }).snapshot();
    const det = determinize(state, 0, makeRng(1));
    expect(sameMulti(det.hands[0]!, state.hands[0]!)).toBe(true); // 我的手牌不变
    for (let i = 0; i < 7; i++) expect(det.hands[i]!.length).toBe(state.hands[i]!.length);
    expect(det.kitty.length).toBe(9);
    const all = [...det.hands.flat(), ...det.kitty];
    expect(all.length).toBe(324);
    const cnt = new Map<string, number>();
    for (const c of all) cnt.set(key(c), (cnt.get(key(c)) ?? 0) + 1);
    expect([...cnt.values()].every((v) => v <= 6)).toBe(true);
  });
});

describe('searchChoosePlay 平面蒙特卡洛 (2.4.3)', () => {
  it('返回合法着法（小残局，rollout 短）', () => {
    const { hands, kitty } = deal(shuffle(buildDeck(), 3));
    const small = hands.map((h) => h.slice(0, 2)); // 每家 2 张残局
    const state = new GameSession({ seed: 0, dealer: 0, level: '7', trump: 'S', hands: small, kitty }).snapshot();
    const play = searchChoosePlay(state, 0, '7', 0, { K: 3, seedBase: 1 });
    const legal = legalPlays(small[0]!, null, { level: '7', trump: 'S' });
    expect(legal.some((o) => sameMulti(o, play))).toBe(true);
  });

  it('确定性：同输入同 seed → 同决策', () => {
    const { hands, kitty } = deal(shuffle(buildDeck(), 8));
    const small = hands.map((h) => h.slice(0, 2));
    const state = new GameSession({ seed: 0, dealer: 0, level: '7', trump: 'S', hands: small, kitty }).snapshot();
    const a = searchChoosePlay(state, 0, '7', 0, { K: 3, seedBase: 42 });
    const b = searchChoosePlay(state, 0, '7', 0, { K: 3, seedBase: 42 });
    expect(sameMulti(a, b)).toBe(true);
  });

  it('强 AI（启发式+残局搜索）跑完整局且分守恒', () => {
    const room = new Room();
    room.fillWithAI();
    room.startRound(7);
    runStrongAI(room);
    expect(room.lastResult()?.pointsConserved).toBe(true);
  });

  it('多 seed 鲁棒：全部 terminate + 分守恒（B1 死锁回归）', () => {
    // 含 Evaluator 扫出的死锁 seed 12/16/41/107 + 一段范围
    const seeds = [12, 16, 41, 107, ...Array.from({ length: 36 }, (_, i) => i + 1)];
    for (const seed of seeds) {
      const room = new Room();
      room.fillWithAI();
      room.startRound(seed);
      runStrongAI(room);
      const r = room.lastResult();
      expect(r, `seed ${seed} 未结束(死锁)`).not.toBeNull();
      expect(r?.pointsConserved, `seed ${seed}`).toBe(true);
    }
  });
});
