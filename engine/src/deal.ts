import type { Card } from './domain';
import { makeRng } from './rng';

export interface Deal {
  /** 7 家手牌，各 45 张 */
  readonly hands: Card[][];
  /** 底牌 9 张 */
  readonly kitty: Card[];
}

const PLAYERS = 7;
const HAND_SIZE = 45;
const KITTY_SIZE = 9;
const TOTAL = PLAYERS * HAND_SIZE + KITTY_SIZE; // 324

/** 种子洗牌（确定性 Fisher-Yates，不改原数组）§12 */
export function shuffle(cards: Card[], seed: number): Card[] {
  const rng = makeRng(seed);
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/** 发牌：逐张轮流发到 7 家各 45 张，余 9 张作底（§6） */
export function deal(cards: Card[]): Deal {
  if (cards.length !== TOTAL) {
    throw new Error(`deal expects ${TOTAL} cards, got ${cards.length}`);
  }
  const hands: Card[][] = Array.from({ length: PLAYERS }, () => []);
  const dealtCount = PLAYERS * HAND_SIZE; // 315
  for (let i = 0; i < dealtCount; i++) {
    hands[i % PLAYERS]!.push(cards[i]!);
  }
  const kitty = cards.slice(dealtCount);
  return { hands, kitty };
}
