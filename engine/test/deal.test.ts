import { describe, it, expect } from 'vitest';
import type { Card } from '../src/domain';
import { buildDeck } from '../src/deck';
import { shuffle, deal } from '../src/deal';

function cardKey(c: Card): string {
  return c.kind === 'joker' ? `J:${c.joker}` : `${c.suit}${c.rank}`;
}
function multiset(cards: Card[]): string[] {
  return cards.map(cardKey).sort();
}

describe('shuffle (种子洗牌，确定性)', () => {
  it('same seed → identical order (可复现)', () => {
    expect(shuffle(buildDeck(), 42)).toEqual(shuffle(buildDeck(), 42));
  });

  it('actually reorders (不是恒等)', () => {
    const orig = buildDeck();
    expect(shuffle(orig, 42)).not.toEqual(orig);
  });

  it('preserves the multiset (还是那 324 张)', () => {
    const orig = buildDeck();
    const sh = shuffle(orig, 7);
    expect(sh).toHaveLength(324);
    expect(multiset(sh)).toEqual(multiset(orig));
  });

  it('different seeds → different orders', () => {
    expect(shuffle(buildDeck(), 1)).not.toEqual(shuffle(buildDeck(), 2));
  });
});

describe('deal (§6 发牌: 45×7 + 9 底)', () => {
  it('deals 7 hands of 45 and a 9-card kitty', () => {
    const { hands, kitty } = deal(shuffle(buildDeck(), 99));
    expect(hands).toHaveLength(7);
    for (const h of hands) expect(h).toHaveLength(45);
    expect(kitty).toHaveLength(9);
  });

  it('loses no card (7×45 + 9 = 324, multiset preserved)', () => {
    const deck = shuffle(buildDeck(), 99);
    const { hands, kitty } = deal(deck);
    const all = [...hands.flat(), ...kitty];
    expect(all).toHaveLength(324);
    expect(multiset(all)).toEqual(multiset(deck));
  });

  it('throws if not 324 cards', () => {
    expect(() => deal([])).toThrow();
  });
});
