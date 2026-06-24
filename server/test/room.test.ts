import { describe, it, expect } from 'vitest';
import { isBuriable } from '@engine';
import { Room } from '../src/room/room';

function driveRoundViaRoom(room: Room): void {
  let guard = 0;
  while (room.phase === 'playing' && guard++ < 600) {
    const s = room.session!;
    const v = s.view(0);
    let r;
    if (v.phase === 'declare') r = room.pass(v.currentTurn!);
    else if (v.phase === 'bury') {
      const holder = v.kittyHolder!;
      const buriable = s.view(holder).hand.filter((c) => isBuriable(c, s.level)).slice(0, 9);
      r = room.bury(holder, buriable);
    } else if (v.phase === 'call') r = room.call(room.snapshot().dealer, [{ suit: 'H', nth: 1 }, { suit: 'D', nth: 1 }]);
    else r = room.play(v.currentTurn!, [s.lowestLegalSingle(v.currentTurn!)!]);
    if (!r.ok) throw new Error(`reject @${v.phase}: ${r.error}`);
  }
}

describe('Room 协调器 (Phase 2.2)', () => {
  it('seats humans, fills the rest with AI, starts a round', () => {
    const room = new Room();
    expect(room.join(1, 'alice').ok).toBe(true);
    expect(room.join(2, 'bob').ok).toBe(true);
    room.fillWithAI();
    expect(room.snapshot().seats.filter((s) => s.kind === 'ai')).toHaveLength(5);
    expect(room.startRound(1).ok).toBe(true);
    expect(room.phase).toBe('playing');
  });

  it('rejects joining a full table', () => {
    const room = new Room();
    for (let i = 0; i < 7; i++) room.join(i + 1, `p${i}`);
    expect(room.join(99, 'late').ok).toBe(false);
  });

  it('one user, one seat (rejects duplicate userId)', () => {
    const room = new Room();
    expect(room.join(1, 'alice').ok).toBe(true);
    expect(room.join(1, 'alice-again').ok).toBe(false);
  });

  it('reclaim: 掉线交 AI 后同用户重连交还原座 (§2.3)', () => {
    const room = new Room();
    room.join(1, 'alice'); // seat 0
    room.markAI(0); // 掉线 → AI 接管
    expect(room.snapshot().seats[0]!.kind).toBe('ai');
    const r = room.reclaim(1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.seat).toBe(0);
    expect(room.snapshot().seats[0]!.kind).toBe('human'); // 交还真人
  });

  it('reclaim 不在座的用户 → 失败', () => {
    expect(new Room().reclaim(99).ok).toBe(false);
  });

  it('drives a full round through the room and rotates dealer', () => {
    const room = new Room();
    room.fillWithAI(); // all-AI table
    room.startRound(7);
    const firstDealer = room.snapshot().dealer;
    driveRoundViaRoom(room);
    expect(room.lastResult()?.pointsConserved).toBe(true);
    // 局终后 dealer 已轮转（无连庄）
    expect(room.snapshot().dealer).not.toBe(firstDealer);
  });

  it('isAITurn reflects the seat kind at the current turn', () => {
    const room = new Room();
    room.join(1, 'alice'); // seat 0 human
    room.fillWithAI();
    room.startRound(1); // dealer 0 leads → human turn
    expect(room.currentTurn()).toBe(0);
    expect(room.isAITurn()).toBe(false);
  });
});
