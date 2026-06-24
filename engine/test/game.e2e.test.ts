import { describe, it, expect } from 'vitest';
import { playRound } from '../src/game';

describe('playRound E2E — 引擎能自动跑完整局 (§12)', () => {
  it('completes a full round: 45 tricks, points conserved', () => {
    const r = playRound({ seed: 1, level: '7', dealer: 0 });
    expect(r.tricksPlayed).toBe(45);
    expect(r.pointsConserved).toBe(true);
  });

  it('deterministic: same seed → identical result', () => {
    expect(playRound({ seed: 42, level: '7', dealer: 3 }))
      .toEqual(playRound({ seed: 42, level: '7', dealer: 3 }));
  });

  it('100 seeds all complete without crash + conserve 600 points', () => {
    for (let s = 1; s <= 100; s++) {
      const r = playRound({ seed: s, level: '7', dealer: s % 7 });
      expect(r.tricksPlayed).toBe(45);
      expect(r.pointsConserved).toBe(true);
      expect(r.defenderScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('produces a structured event log incl. deal/trump/settle', () => {
    const r = playRound({ seed: 5, level: '7', dealer: 2 });
    expect(r.events.length).toBeGreaterThan(45);
    expect(r.events.some((e) => e.t === 'deal')).toBe(true);
    expect(r.events.some((e) => e.t === 'trump')).toBe(true);
    expect(r.events.some((e) => e.t === 'settle')).toBe(true);
  });

  it('settlement bracket consistent with defenderScore', () => {
    const r = playRound({ seed: 7, level: '7', dealer: 1 });
    const ev = r.settlement.event;
    if (r.defenderScore === 0) expect(ev).toBe('big-light');
    else if (r.defenderScore < 120) expect(ev).toBe('small-light');
    else if (r.defenderScore < 240) expect(ev).toBe('pass');
    else expect(ev).toBe('stage');
  });
});
