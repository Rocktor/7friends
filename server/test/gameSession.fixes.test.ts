import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '@engine';
import { GameSession } from '../src/session/gameSession';

const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });

describe('GameSession 修复：甩牌整桌裁决 (Evaluator Major-1)', () => {
  it('失败的甩牌领出 → 强制只出最小一手，其余留手', () => {
    // 主黑桃；庄(0)甩 H3+H8(同门非连=throw)，闲(1)有 H10 能压 H8 → 甩牌失败 → 只出 H3
    const hands: Card[][] = [
      [c('H', '3'), c('H', '8')], // dealer
      [c('H', '10'), c('C', '9')], // 有 H10 压得动
      [c('D', '2')], [c('D', '3')], [c('D', '4')], [c('D', '5')], [c('D', '6')],
    ];
    const s = new GameSession({ seed: 0, dealer: 0, level: '7', trump: 'S', hands });
    const r = s.play(0, [c('H', '3'), c('H', '8')]);
    expect(r.ok).toBe(true);
    // 只出了 H3：庄手里还留着 H8，本墩只 1 张，轮到下家
    expect(s.view(0).hand).toContainEqual(c('H', '8'));
    expect(s.view(0).hand).not.toContainEqual(c('H', '3'));
    expect(s.view(0).trickSoFar).toEqual([{ seat: 0, cards: [c('H', '3')] }]);
    expect(s.currentPlaySeat).toBe(1);
  });

  it('成功的甩牌（没人压得动）→ 整把出', () => {
    const hands: Card[][] = [
      [c('H', 'A'), c('H', 'K')], // 庄甩高张
      [c('H', '2'), c('C', '9')], // 都比它小、不空门
      [c('H', '3')], [c('H', '4')], [c('H', '5')], [c('H', '6')], [c('H', '8')],
    ];
    const s = new GameSession({ seed: 0, dealer: 0, level: '7', trump: 'S', hands });
    expect(s.play(0, [c('H', 'A'), c('H', 'K')]).ok).toBe(true);
    expect(s.view(0).trickSoFar[0]!.cards).toHaveLength(2); // 整把
  });
});

describe('GameSession 修复：抠底倍数 = 末墩出牌张数 (Evaluator Major-2)', () => {
  it('一墩对子 → lastLeadSize 记为 2（不再硬编 1）', () => {
    // 每家一对（同门 H、互不同点），跟对必出 → 末墩张数 = 2
    const hands: Card[][] = [
      [c('H', '5'), c('H', '5')],
      [c('H', '6'), c('H', '6')],
      [c('H', '8'), c('H', '8')],
      [c('H', '9'), c('H', '9')],
      [c('H', '10'), c('H', '10')],
      [c('H', 'J'), c('H', 'J')],
      [c('H', 'Q'), c('H', 'Q')],
    ];
    const s = new GameSession({ seed: 0, dealer: 0, level: '7', trump: 'S', hands });
    const pairs = [['5', '5'], ['6', '6'], ['8', '8'], ['9', '9'], ['10', '10'], ['J', 'J'], ['Q', 'Q']] as const;
    for (let seat = 0; seat < 7; seat++) {
      const r = s.play(seat, [c('H', pairs[seat]![0]), c('H', pairs[seat]![1])]);
      expect(r.ok).toBe(true);
    }
    expect(s.lastLeadSize).toBe(2); // 倍数应为 2^2=4，而非硬编 2^1
  });
});
