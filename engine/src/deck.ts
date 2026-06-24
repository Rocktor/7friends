import type { Card } from './domain';
import { SUITS, RANKS, DECKS } from './domain';

/** 造一副完整 6 副牌（324 张）：每 (花色,点数) 6 张 + 大王6 + 小王6（§2） */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ kind: 'suited', suit, rank });
      }
    }
    deck.push({ kind: 'joker', joker: 'BJ' });
    deck.push({ kind: 'joker', joker: 'LJ' });
  }
  return deck;
}
