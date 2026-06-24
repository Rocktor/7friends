import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import type { TrumpCtx } from '../src/trump';
import { validateThrow } from '../src/legality';

const ctx: TrumpCtx = { level: '7', trump: 'S' };
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });

describe('validateThrow 甩牌整桌裁决 (§9 G3 rev-B)', () => {
  it('某家能压其中一张 → 甩牌失败，回退最小一手', () => {
    const thrown = [c('H', '5'), c('H', '8')]; // 甩两单
    const others = [[c('H', '10')], [c('D', '2')]]; // 有人有 H10 > H8
    const r = validateThrow(thrown, others, ctx);
    expect(r.ok).toBe(false);
    expect(r.forced).toEqual([c('H', '5')]); // 最小一手 = H5
  });

  it('没人压得动 → 甩牌成功（整把都出）', () => {
    const thrown = [c('H', 'A'), c('H', 'K')];
    const others = [[c('H', '2')], [c('H', '3')]]; // 都有 H 但都更小、且不空门
    const r = validateThrow(thrown, others, ctx);
    expect(r.ok).toBe(true);
    expect(r.forced).toEqual(thrown);
  });

  it('对子被更大对子压 → 失败，回退最小一手（弱的那手）', () => {
    const thrown = [c('H', '5'), c('H', '5'), c('H', '8')]; // 对5 + 单8
    const others = [[c('H', '9'), c('H', '9')]]; // 对9 压对5
    const r = validateThrow(thrown, others, ctx);
    expect(r.ok).toBe(false);
    expect(r.forced).toEqual([c('H', '5'), c('H', '5')]); // 最弱一手 = 对5
  });

  it('空门玩家用主吃 → 甩牌失败', () => {
    const thrown = [c('H', '5')];
    const others = [[c('S', '2')]]; // 空 H、有主 S2 可吃
    const r = validateThrow(thrown, others, ctx);
    expect(r.ok).toBe(false);
  });

  it('空门但无主 → 压不动', () => {
    const thrown = [c('H', '9')];
    const others = [[c('D', '2')]]; // 空 H、也无主
    const r = validateThrow(thrown, others, ctx);
    expect(r.ok).toBe(true);
  });
});
