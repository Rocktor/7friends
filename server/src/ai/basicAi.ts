import { isBuriable } from '@engine';
import type { Room } from '../room/room';

/**
 * 占位"陪跑 AI"：为当前行动座做一个合法动作（declare→pass / bury→扣最小可扣9 / call→默认 / play→最小合法单张）。
 * ⚠️ 这是 Phase 2.2b 的能跑通占位实现；**强 AI（记忆+启发式+ISMCTS）= 2.4 替换**。
 * 返回是否成功行动了一步。
 */
export function autoAct(room: Room): boolean {
  const s = room.session;
  if (!s || s.isOver()) return false;
  const seat = s.currentActor();
  if (seat === null) return false;
  const v = s.view(seat);
  switch (v.phase) {
    case 'declare':
      return room.pass(seat).ok;
    case 'bury': {
      const buriable = v.hand.filter((c) => isBuriable(c, s.level)).slice(0, 9);
      return room.bury(seat, buriable).ok;
    }
    case 'call':
      return room.call(seat, [{ suit: 'H', nth: 1 }, { suit: 'D', nth: 1 }]).ok;
    case 'play': {
      const card = s.lowestLegalSingle(seat);
      return card ? room.play(seat, [card]).ok : false;
    }
    default:
      return false;
  }
}

/** 连续替 AI 座行动，直到轮到人类 / 一局结束（ws 服务端用）。返回执行步数 */
export function runAITurns(room: Room, max = 1000): number {
  let n = 0;
  while (room.isAITurn() && n < max) {
    if (!autoAct(room)) break;
    n++;
  }
  return n;
}
