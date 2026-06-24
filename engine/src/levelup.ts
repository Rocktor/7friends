import type { Rank } from './domain';
import { RANKS } from './domain';

export type RoundEvent = 'big-light' | 'small-light' | 'pass' | 'stage'; // 大光/小光/过关/上台

export interface RoundResult {
  readonly event: RoundEvent;
  readonly declarerDelta: number; // 庄队每人 +N
  readonly defenderDelta: number; // 闲家(上台方) +N
  readonly declarerDown: boolean;
}

/** 按闲家抓分(含抠底)结算升降级（§10.3）*/
export function settleRound(defenderScore: number): RoundResult {
  if (defenderScore === 0) return { event: 'big-light', declarerDelta: 3, defenderDelta: 0, declarerDown: false };
  if (defenderScore < 120) return { event: 'small-light', declarerDelta: 2, defenderDelta: 0, declarerDown: false };
  if (defenderScore < 240) return { event: 'pass', declarerDelta: 1, defenderDelta: 0, declarerDown: false };
  return {
    event: 'stage',
    declarerDelta: 0,
    defenderDelta: Math.floor((defenderScore - 240) / 120),
    declarerDown: true,
  };
}

const J_IDX = RANKS.indexOf('J');
const A_IDX = RANKS.indexOf('A');

/** 升级 +delta，受 J/A 必打钳制（从 J 之下不可越过 J；从 A 之下不可越过 A）§4/§10.3 */
export function applyLevelUp(current: Rank, delta: number): Rank {
  const cur = RANKS.indexOf(current);
  let target = cur + delta;
  for (const stop of [J_IDX, A_IDX]) {
    if (cur < stop && target > stop) {
      target = stop;
      break;
    }
  }
  return RANKS[Math.min(target, A_IDX)]!;
}

/** 下一坐庄座位：座位轮转、跳过下台庄队成员（§10.3）*/
export function nextDealer(current: number, downSeats: number[], numPlayers: number): number {
  const down = new Set(downSeats);
  let seat = (current + 1) % numPlayers;
  while (down.has(seat)) seat = (seat + 1) % numPlayers;
  return seat;
}
