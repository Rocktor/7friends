import { describe, it, expect } from 'vitest';
import { settleRound, applyLevelUp, nextDealer } from '../src/levelup';

describe('settleRound 升降级档线 (§10.3)', () => {
  it('恰好 0 = 大光 → 庄队 +3', () => {
    expect(settleRound(0)).toMatchObject({ event: 'big-light', declarerDelta: 3, declarerDown: false });
  });
  it('有分且 <120 = 小光 → 庄队 +2', () => {
    expect(settleRound(5)).toMatchObject({ event: 'small-light', declarerDelta: 2 });
    expect(settleRound(115)).toMatchObject({ event: 'small-light', declarerDelta: 2 });
  });
  it('120–239 = 过关 → 庄队 +1', () => {
    expect(settleRound(120)).toMatchObject({ event: 'pass', declarerDelta: 1, declarerDown: false });
    expect(settleRound(235)).toMatchObject({ event: 'pass', declarerDelta: 1 });
  });
  it('≥240 = 上台：庄队 +0 下台，闲家 +⌊(分-240)/120⌋', () => {
    expect(settleRound(240)).toMatchObject({ event: 'stage', declarerDelta: 0, defenderDelta: 0, declarerDown: true });
    expect(settleRound(360)).toMatchObject({ event: 'stage', defenderDelta: 1, declarerDown: true });
    expect(settleRound(480)).toMatchObject({ event: 'stage', defenderDelta: 2 });
    expect(settleRound(600)).toMatchObject({ event: 'stage', defenderDelta: 3 });
  });
});

describe('applyLevelUp J/A 必打钳制 (§4)', () => {
  it('普通推进', () => {
    expect(applyLevelUp('2', 1)).toBe('3');
    expect(applyLevelUp('9', 1)).toBe('10');
  });
  it('够到 J 可停在 J', () => {
    expect(applyLevelUp('10', 1)).toBe('J');
  });
  it('越过 J 被钳制在 J（10 +2 → J）', () => {
    expect(applyLevelUp('10', 2)).toBe('J');
    expect(applyLevelUp('9', 3)).toBe('J');
  });
  it('在 J 上(已过 J)可继续（J +2 → K）', () => {
    expect(applyLevelUp('J', 2)).toBe('K');
  });
  it('越过 A 钳制在 A（K +3 → A）', () => {
    expect(applyLevelUp('K', 3)).toBe('A');
  });
  it('A 封顶', () => {
    expect(applyLevelUp('A', 1)).toBe('A');
  });
});

describe('nextDealer 座位轮转 + 跳过下台庄队 (§10.3)', () => {
  it('无下台 → 直接下家', () => {
    expect(nextDealer(0, [], 7)).toBe(1);
    expect(nextDealer(6, [], 7)).toBe(0);
  });
  it('跳过下台庄队座位', () => {
    // 当前庄 1 下台、庄队含 1,2 → 下一庄 = 3
    expect(nextDealer(1, [1, 2], 7)).toBe(3);
  });
  it('连续跳过多个下台座位', () => {
    expect(nextDealer(6, [0, 1], 7)).toBe(2); // 6→0(skip)→1(skip)→2
  });
});
