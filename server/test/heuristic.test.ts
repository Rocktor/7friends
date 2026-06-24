import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit, TrumpCtx } from '@engine';
import { choosePlay, chooseDeclare, chooseBury, chooseCall, runHeuristicAI } from '../src/ai/heuristic';
import { Room } from '../src/room/room';

const ctx: TrumpCtx = { level: '7', trump: 'S' };
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });
const BJ: Card = { kind: 'joker', joker: 'BJ' };
const LJ: Card = { kind: 'joker', joker: 'LJ' };

describe('choosePlay 出牌启发式 (2.4.2)', () => {
  it('有分墩 → 用最小够赢的牌拿下', () => {
    const trick = [{ seat: 1, cards: [c('H', '10')] }]; // 领出 ♥10（10分）
    const hand = [c('H', '3'), c('H', 'J'), c('H', 'K'), c('H', 'A')];
    // 赢家候选 J/K/A，取最小 → J
    expect(choosePlay(hand, trick, ctx)).toEqual([c('H', 'J')]);
  });

  it('无分墩 → 不浪费大牌，垫最小', () => {
    const trick = [{ seat: 1, cards: [c('H', '3')] }]; // 0 分
    const hand = [c('H', '4'), c('H', 'J'), c('H', 'K')];
    expect(choosePlay(hand, trick, ctx)).toEqual([c('H', '4')]);
  });

  it('领牌无组合 → 出副牌最小单张探路（不轻易出主）', () => {
    const hand = [c('S', 'A'), c('H', '4'), c('D', '9'), BJ];
    const play = choosePlay(hand, [], ctx);
    expect(play).toHaveLength(1);
    expect(play[0]!.kind).toBe('suited'); // 不出王
    expect((play[0] as any).suit).not.toBe('S'); // 不出主
  });

  it('领牌有组合 → 打组合不傻傻出单张（Rocktor 指点）', () => {
    const hand = [c('H', '9'), c('H', '9'), c('D', '3'), c('S', 'A')]; // 红桃对
    const play = choosePlay(hand, [], ctx);
    expect(play.length).toBeGreaterThanOrEqual(2); // 领出对子
  });
});

describe('chooseDeclare 亮主启发式', () => {
  it('两王 + 某花色≥2 级牌 → 亮该花色', () => {
    const hand = [BJ, LJ, c('S', '7'), c('S', '7'), c('H', '3')];
    expect(chooseDeclare(hand, '7')).toEqual({ suit: 'S', count: 2 });
  });
  it('不足两王 → 不亮', () => {
    expect(chooseDeclare([BJ, c('S', '7'), c('S', '7')], '7')).toBeNull();
  });
});

describe('chooseBury 扣底启发式', () => {
  it('扣 9 张可扣牌、不含叫牌点A、尽量不扣分牌', () => {
    const hand = [
      c('S', 'A'), c('H', 'A'), // A 不可扣（叫牌点）
      c('H', '5'), c('S', 'K'), // 分牌
      c('D', '2'), c('D', '3'), c('D', '4'), c('C', '2'), c('C', '3'), c('C', '4'), c('H', '2'), c('H', '3'),
    ];
    const bury = chooseBury(hand, '7', ctx);
    expect(bury).toHaveLength(9);
    expect(bury.some((x) => x.kind === 'suited' && x.rank === 'A')).toBe(false); // 无 A
  });
});

describe('chooseCall 叫朋友启发式 (Rocktor 指点：nth=持有+1 + 不同花色)', () => {
  it('持 2 张黑桃A → 叫第3张黑桃（绝不叫自己）+ 两门不同花色', () => {
    const hand = [c('S', 'A'), c('S', 'A'), c('H', '3'), c('D', '5')];
    const calls = chooseCall(hand, '7');
    expect(calls).toHaveLength(2);
    expect(calls.find((x) => x.suit === 'S')?.nth).toBe(3); // 自己 2 张之后
    expect(calls[0]!.suit).not.toBe(calls[1]!.suit); // 不同花色
  });
  it('某花色一张不持 → 该门叫第1张（第一张打出即别人）', () => {
    const hand = [c('S', 'A'), c('S', 'A')];
    const calls = chooseCall(hand, '7');
    expect(calls.some((x) => x.suit !== 'S' && x.nth === 1)).toBe(true);
  });
  it('叫的 nth 永远 > 自己持有数（不会叫到自己）', () => {
    const hand = [c('S', 'A'), c('S', 'A'), c('S', 'A'), c('H', 'A')];
    const calls = chooseCall(hand, '7');
    const heldS = 3, heldH = 1;
    expect(calls.find((x) => x.suit === 'S')?.nth ?? 99).toBeGreaterThan(heldS);
    expect(calls.find((x) => x.suit === 'H')?.nth ?? 99).toBeGreaterThan(heldH);
  });
});

describe('全启发式 AI 跑完整局', () => {
  it('7 个强AI自动对完一局且分守恒', () => {
    const room = new Room();
    room.fillWithAI();
    room.startRound(7);
    runHeuristicAI(room);
    expect(room.lastResult()?.pointsConserved).toBe(true);
  });
});
