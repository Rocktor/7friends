import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit, TrumpCtx } from '@engine';
import { AIMemory } from '../src/ai/memory';

const ctx: TrumpCtx = { level: '7', trump: 'S' };
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });

describe('AIMemory 记牌记忆 (2.4.1)', () => {
  it('counts seen cards and remaining (6 decks)', () => {
    const m = new AIMemory(ctx);
    expect(m.remainingCount(c('H', '5'))).toBe(6);
    m.observePlay(0, [c('H', '5'), c('H', '5')], null);
    expect(m.seenCount(c('H', '5'))).toBe(2);
    expect(m.remainingCount(c('H', '5'))).toBe(4);
  });

  it('infers void: a seat that does not follow the led group', () => {
    const m = new AIMemory(ctx);
    // 领出 H（副），座 3 出 D（既非 H 也非主）→ 推断座 3 H 门空
    m.observePlay(3, [c('D', '2')], 'H');
    expect(m.isVoid(3, 'H')).toBe(true);
    expect(m.isVoid(3, 'C')).toBe(false);
  });

  it('ruffing also implies void in the led side suit', () => {
    const m = new AIMemory(ctx);
    // 领出 H，座 2 用主 S 吃 → 没跟 H → H 门空
    m.observePlay(2, [c('S', '2')], 'H');
    expect(m.isVoid(2, 'H')).toBe(true);
  });

  it('following the led group does NOT mark void', () => {
    const m = new AIMemory(ctx);
    m.observePlay(1, [c('H', '9')], 'H');
    expect(m.isVoid(1, 'H')).toBe(false);
  });

  it('accumulates captured points per seat', () => {
    const m = new AIMemory(ctx);
    m.observeTrickWin(4, 15);
    m.observeTrickWin(4, 10);
    expect(m.capturedBy(4)).toBe(25);
    expect(m.capturedBy(0)).toBe(0);
  });
});
