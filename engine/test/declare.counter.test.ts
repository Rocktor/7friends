import { describe, it, expect } from 'vitest';
import type { Suit } from '../src/domain';
import { canCounter, resolveTrump, runDeclarePhase, type Declaration, type DeclareAction } from '../src/declare';

const D = (player: number, suit: Suit, count: number): Declaration => ({ player, suit, count });

describe('canCounter 反主换门 (§7 rev-B)', () => {
  it('same count higher suit, different suit → can counter', () => {
    expect(canCounter(D(0, 'D', 2), D(1, 'S', 2))).toBe(true); // 黑反方
  });
  it('same suit → cannot counter (不允许同花色反)', () => {
    expect(canCounter(D(0, 'D', 2), D(1, 'D', 3))).toBe(false); // 方加张数也不行
  });
  it('two 黑桃(最高花色) → same-count other suit cannot, need ≥3', () => {
    expect(canCounter(D(0, 'S', 2), D(1, 'H', 2))).toBe(false); // 红2 压不过 黑2
    expect(canCounter(D(0, 'S', 2), D(1, 'H', 3))).toBe(true); // 红3 可反
  });
});

describe('resolveTrump 顺序处理 + 换门约束 (§7 rev-B)', () => {
  it('换门反成功（方→黑）', () => {
    expect(resolveTrump([D(0, 'D', 2), D(1, 'S', 2)])?.suit).toBe('S');
  });
  it('同花色加张数无效（方2 后 方3 被忽略）', () => {
    expect(resolveTrump([D(0, 'D', 2), D(1, 'D', 3)])?.suit).toBe('D'); // 方3 非法反 → 仍方2
  });
  it('两黑桃后必须三张换门才反得动', () => {
    expect(resolveTrump([D(0, 'S', 2), D(1, 'H', 2)])?.suit).toBe('S'); // 红2 反不动
    expect(resolveTrump([D(0, 'S', 2), D(1, 'H', 3)])?.suit).toBe('H'); // 红3 反成功
  });
  it('first declaration sets trump with no constraint', () => {
    expect(resolveTrump([D(0, 'D', 1)])?.suit).toBe('D');
  });
});

describe('runDeclarePhase 亮主轮：弃权失反权 (§7 rev-B)', () => {
  const A = (player: number, suit: Suit, count: number): DeclareAction => ({ player, type: 'declare', suit, count });
  const pass = (player: number): DeclareAction => ({ player, type: 'pass' });

  it('正常换门反 → 最终主', () => {
    const r = runDeclarePhase([A(0, 'D', 2), A(1, 'S', 2)]);
    expect(r.trump).toBe('S');
    expect(r.forfeited).toEqual([]);
  });

  it('pass 即失去本局反主权：钓鱼者后续亮/反无效', () => {
    // p0 先 pass（想等反），p1 亮方片，p0 再想用黑桃3反 → 无效（已弃权）
    const r = runDeclarePhase([pass(0), A(1, 'D', 2), A(0, 'S', 3)]);
    expect(r.trump).toBe('D'); // p0 的 S3 被忽略
    expect(r.forfeited).toContain(0);
  });

  it('全员 pass → 无主（交回翻底定主）', () => {
    const r = runDeclarePhase([pass(0), pass(1), pass(2)]);
    expect(r.trump).toBeNull();
    expect(r.forfeited).toEqual([0, 1, 2]);
  });

  it('未弃权者可正常反', () => {
    const r = runDeclarePhase([A(0, 'D', 2), pass(2), A(1, 'H', 2)]);
    expect(r.trump).toBe('H'); // p1 没 pass，红反方成立
  });
});
