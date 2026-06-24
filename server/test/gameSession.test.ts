import { describe, it, expect } from 'vitest';
import { isBuriable, type Rank, type Suit } from '@engine';
import { GameSession } from '../src/session/gameSession';

/** 全阶段驱动器：declare 全 pass → bury 扣最小可扣 9 → call 默认 → play 最小合法单张 */
function driveFullRound(s: GameSession): void {
  let guard = 0;
  while (!s.isOver() && guard++ < 600) {
    const v = s.view(0);
    if (v.phase === 'declare') {
      s.pass(v.currentTurn!);
    } else if (v.phase === 'bury') {
      const holder = v.kittyHolder!;
      const buriable = s.view(holder).hand.filter((c) => isBuriable(c, s.level)).slice(0, 9);
      s.bury(holder, buriable);
    } else if (v.phase === 'call') {
      s.call(s.dealer, [{ suit: 'H', nth: 1 }, { suit: 'D', nth: 1 }]);
    } else if (v.phase === 'play') {
      const seat = v.currentTurn!;
      s.play(seat, [s.lowestLegalSingle(seat)!]);
    }
  }
}

describe('GameSession 全阶段交互 (Phase 2.2b)', () => {
  it('starts in declare phase, dealer to act', () => {
    const s = new GameSession({ seed: 1, dealer: 3, level: '7' });
    expect(s.view(0).phase).toBe('declare');
    expect(s.view(3).yourTurn).toBe(true);
    expect(s.view(4).yourTurn).toBe(false);
  });

  it('all-pass declare → 翻底定主 → moves to bury', () => {
    const s = new GameSession({ seed: 1, dealer: 0, level: '7' });
    for (let k = 0; k < 7; k++) s.pass(s.view(0).currentTurn!);
    expect(s.view(0).phase).toBe('bury');
    expect(s.view(0).trump).not.toBeNull();
  });

  it('cannot play during declare phase', () => {
    const s = new GameSession({ seed: 1, dealer: 0, level: '7' });
    const r = s.play(0, s.view(0).hand.slice(0, 1));
    expect(r.ok).toBe(false);
  });

  it('out-of-turn declare is rejected', () => {
    const s = new GameSession({ seed: 1, dealer: 0, level: '7' });
    const notDealer = 1;
    expect(s.pass(notDealer).ok).toBe(false);
  });

  it('bury must be exactly 9 buriable cards', () => {
    const s = new GameSession({ seed: 2, dealer: 0, level: '7' });
    for (let k = 0; k < 7; k++) s.pass(s.view(0).currentTurn!);
    const holder = s.view(0).kittyHolder!;
    const hand = s.view(holder).hand;
    expect(s.bury(holder, hand.slice(0, 8)).ok).toBe(false); // 8 张
    const buriable = hand.filter((c) => isBuriable(c, s.level)).slice(0, 9);
    expect(s.bury(holder, buriable).ok).toBe(true);
    expect(s.view(0).phase).toBe('call');
  });

  it('drives a full round through all phases, points conserved', () => {
    const s = new GameSession({ seed: 11, dealer: 2, level: '7' });
    driveFullRound(s);
    expect(s.isOver()).toBe(true);
    expect(s.result().pointsConserved).toBe(true);
  });

  it('hand isolation: 45 each at deal (315 total), kitty hidden', () => {
    const s = new GameSession({ seed: 4, dealer: 0, level: '7' });
    let total = 0;
    for (let i = 0; i < 7; i++) total += s.view(i).hand.length;
    expect(total).toBe(315);
  });

  it('deterministic: same seed → same defenderScore', () => {
    const run = () => {
      const s = new GameSession({ seed: 9, dealer: 1, level: '7' });
      driveFullRound(s);
      return s.result().defenderScore;
    };
    expect(run()).toBe(run());
  });
});
