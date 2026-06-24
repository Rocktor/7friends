import { type Card, type TrumpCtx, type SuitClass, comboGroup } from '@engine';

const DECKS = 6;

function key(c: Card): string {
  return c.kind === 'joker' ? `J${c.joker}` : `${c.suit}${c.rank}`;
}

/**
 * 强 AI 知识层（2.4.1）：观察公共出牌流，维护"记牌记忆"——
 * 已出牌计数 / 各点剩余 / 各座空门推断 / 各座吃分。供启发式策略 + ISMCTS determinization 用。
 */
export class AIMemory {
  private readonly played = new Map<string, number>();
  private readonly voids = new Set<string>(); // `${seat}:${group}`
  private readonly captured: number[];

  constructor(private readonly ctx: TrumpCtx, private readonly numPlayers = 7) {
    this.captured = Array.from({ length: numPlayers }, () => 0);
  }

  /** 观察一手出牌；ledGroup 非空时据"没跟该门"推断空门 */
  observePlay(seat: number, cards: Card[], ledGroup: SuitClass | null): void {
    for (const c of cards) this.played.set(key(c), (this.played.get(key(c)) ?? 0) + 1);
    if (ledGroup !== null && !cards.some((c) => comboGroup(c, this.ctx) === ledGroup)) {
      this.voids.add(`${seat}:${ledGroup}`);
    }
  }

  /** 记一墩赢家吃到的分 */
  observeTrickWin(seat: number, points: number): void {
    this.captured[seat]! += points;
  }

  /** 这张牌已见过几张 */
  seenCount(c: Card): number {
    return this.played.get(key(c)) ?? 0;
  }

  /** 这张牌还剩几张未出（6 副）*/
  remainingCount(c: Card): number {
    return DECKS - this.seenCount(c);
  }

  /** 某座是否已被推断在某花色组空门 */
  isVoid(seat: number, group: SuitClass): boolean {
    return this.voids.has(`${seat}:${group}`);
  }

  /** 某座累计吃分 */
  capturedBy(seat: number): number {
    return this.captured[seat]!;
  }
}
