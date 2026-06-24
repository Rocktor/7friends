import { GameSession } from '../session/gameSession';
import { applyLevelUp, nextDealer, type Rank, type Suit, type Card, type Settlement, type FriendCall } from '@engine';

export interface Seat {
  occupied: boolean;
  userId: number | null;
  name: string;
  kind: 'human' | 'ai';
  connected: boolean;
}

const N = 7;
const emptySeat = (): Seat => ({ occupied: false, userId: null, name: '', kind: 'human', connected: false });

export interface RoomSnapshot {
  phase: 'lobby' | 'playing';
  dealer: number;
  seats: { occupied: boolean; name: string; kind: string; connected: boolean; level: Rank }[];
}

/** 单桌 7 座协调器（无 socket，可测）：座位/AI补位/开局/路由动作/每座状态/多局轮转 */
export class Room {
  readonly seats: Seat[] = Array.from({ length: N }, emptySeat);
  levels: Rank[] = Array.from({ length: N }, () => '7' as Rank);
  dealer = 0;
  session: GameSession | null = null;

  /** 人类入座（取第一个空座；一人一座）*/
  join(userId: number, name: string): { ok: true; seat: number } | { ok: false; error: string } {
    const dup = this.seats.findIndex((s) => s.occupied && s.userId === userId);
    if (dup >= 0) return { ok: false, error: 'already seated' };
    const i = this.seats.findIndex((s) => !s.occupied);
    if (i < 0) return { ok: false, error: 'table full' };
    this.seats[i] = { occupied: true, userId, name, kind: 'human', connected: true };
    return { ok: true, seat: i };
  }

  /** 掉线 → 该座交 AI 接管（保留 userId，供重连交还）*/
  markAI(seat: number): void {
    const s = this.seats[seat];
    if (s && s.occupied) {
      s.kind = 'ai';
      s.connected = false;
    }
  }

  /** 找某用户所在座位（-1 不在座）*/
  findSeatOf(userId: number): number {
    return this.seats.findIndex((s) => s.occupied && s.userId === userId);
  }

  /** 重连交还：该用户原座（此前掉线交了 AI）恢复为真人接管 §2.3 */
  reclaim(userId: number): { ok: true; seat: number } | { ok: false } {
    const i = this.findSeatOf(userId);
    if (i < 0) return { ok: false };
    this.seats[i] = { ...this.seats[i]!, kind: 'human', connected: true };
    return { ok: true, seat: i };
  }

  /** 空座补 AI（开局前）*/
  fillWithAI(): void {
    for (let i = 0; i < N; i++) {
      if (!this.seats[i]!.occupied) {
        this.seats[i] = { occupied: true, userId: null, name: `电脑${i + 1}`, kind: 'ai', connected: true };
      }
    }
  }

  /** 开一局（满座后）。seed 由调用方给（确定性 / 复盘）*/
  startRound(seed: number): { ok: true } | { ok: false; error: string } {
    if (this.seats.some((s) => !s.occupied)) return { ok: false, error: 'need 7 seated (call fillWithAI)' };
    this.session = new GameSession({ seed, dealer: this.dealer, level: this.levels[this.dealer]! });
    return { ok: true };
  }

  get phase(): 'lobby' | 'playing' {
    return this.session && !this.session.isOver() ? 'playing' : 'lobby';
  }

  /** 当前该哪个座位行动（跨阶段）*/
  currentTurn(): number | null {
    return this.session && !this.session.isOver() ? this.session.currentActor() : null;
  }

  isAITurn(): boolean {
    const t = this.currentTurn();
    return t !== null && this.seats[t]!.kind === 'ai';
  }

  // ── 动作路由（服务端校验在 GameSession 内）──
  declare(seat: number, suit: Suit, count: number) {
    return this.session?.declare(seat, suit, count) ?? { ok: false as const, error: 'no active round' };
  }
  pass(seat: number) {
    return this.session?.pass(seat) ?? { ok: false as const, error: 'no active round' };
  }
  bury(seat: number, cards: Card[]) {
    return this.session?.bury(seat, cards) ?? { ok: false as const, error: 'no active round' };
  }
  call(seat: number, calls: FriendCall[]) {
    return this.session?.call(seat, calls) ?? { ok: false as const, error: 'no active round' };
  }
  play(seat: number, cards: Card[]) {
    if (!this.session) return { ok: false as const, error: 'no active round' };
    const r = this.session.play(seat, cards);
    if (r.ok && this.session.isOver()) this.concludeRound();
    return r;
  }

  /** 结算：庄队/上台方按 settlement 升级（J/A 钳制），定下一局庄家（跳下台庄队）*/
  private concludeRound(): void {
    const res = this.session!.result();
    const s: Settlement = res.settlement;
    const declarers = new Set([this.dealer, ...res.friends.filter((f): f is number => f !== null)]);
    if (s.declarerDelta > 0) {
      for (const seat of declarers) this.levels[seat] = applyLevelUp(this.levels[seat]!, s.declarerDelta);
    }
    if (s.declarerDown && s.defenderDelta > 0) {
      for (let i = 0; i < N; i++) if (!declarers.has(i)) this.levels[i] = applyLevelUp(this.levels[i]!, s.defenderDelta);
    }
    const down = s.declarerDown ? [...declarers] : [];
    this.dealer = nextDealer(this.dealer, down, N);
  }

  lastResult() {
    return this.session?.isOver() ? this.session.result() : null;
  }

  snapshot(): RoomSnapshot {
    return {
      phase: this.phase,
      dealer: this.dealer,
      seats: this.seats.map((s, i) => ({
        occupied: s.occupied, name: s.name, kind: s.kind, connected: s.connected, level: this.levels[i]!,
      })),
    };
  }
}
