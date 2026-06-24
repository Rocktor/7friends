import { describe, it, expect } from 'vitest';
import type { Card, Rank, Suit } from '../src/domain';
import {
  suitRank, countJokers, levelCardsOfSuit, canDeclare,
  declarationBeats, resolveTrump, flipKittyForTrump,
} from '../src/declare';

const LV: Rank = '7';
const BJ: Card = { kind: 'joker', joker: 'BJ' };
const LJ: Card = { kind: 'joker', joker: 'LJ' };
const c = (suit: Suit, rank: Rank): Card => ({ kind: 'suited', suit, rank });

describe('suitRank 黑>红>梅>方 (§7)', () => {
  it('S > H > C > D', () => {
    expect(suitRank('S')).toBeGreaterThan(suitRank('H'));
    expect(suitRank('H')).toBeGreaterThan(suitRank('C'));
    expect(suitRank('C')).toBeGreaterThan(suitRank('D'));
  });
});

describe('countJokers / levelCardsOfSuit', () => {
  it('counts jokers (大+小)', () => {
    expect(countJokers([BJ, LJ, c('S', '7')])).toBe(2);
    expect(countJokers([BJ, BJ, LJ])).toBe(3);
  });
  it('counts level cards of a suit', () => {
    expect(levelCardsOfSuit([c('S', '7'), c('S', '7'), c('H', '7'), c('S', '8')], LV, 'S')).toBe(2);
  });
});

describe('canDeclare 门槛 (§7：两王 + ≥1 该花色级牌)', () => {
  it('two jokers + a level card of suit → can declare that suit', () => {
    expect(canDeclare([BJ, LJ, c('S', '7')], LV, 'S')).toBe(true);
  });
  it('only one joker → cannot', () => {
    expect(canDeclare([BJ, c('S', '7')], LV, 'S')).toBe(false);
  });
  it('two jokers but no level card of that suit → cannot', () => {
    expect(canDeclare([BJ, LJ, c('H', '7')], LV, 'S')).toBe(false);
  });
});

describe('declarationBeats 张数定强弱 + 同张数花色 (§7)', () => {
  it('more count beats fewer (2 反 1)', () => {
    expect(declarationBeats({ player: 1, suit: 'D', count: 2 }, { player: 0, suit: 'S', count: 1 })).toBe(true);
  });
  it('same count → higher suit wins', () => {
    expect(declarationBeats({ player: 1, suit: 'S', count: 1 }, { player: 0, suit: 'H', count: 1 })).toBe(true);
    expect(declarationBeats({ player: 1, suit: 'D', count: 1 }, { player: 0, suit: 'S', count: 1 })).toBe(false);
  });
});

describe('resolveTrump 最终胜者', () => {
  it('picks the strongest declaration', () => {
    const win = resolveTrump([
      { player: 0, suit: 'S', count: 1 },
      { player: 1, suit: 'H', count: 2 },
      { player: 2, suit: 'D', count: 1 },
    ]);
    expect(win).toEqual({ player: 1, suit: 'H', count: 2 });
  });
  it('tie count broken by suit', () => {
    const win = resolveTrump([
      { player: 0, suit: 'D', count: 1 },
      { player: 1, suit: 'S', count: 1 },
    ]);
    expect(win?.suit).toBe('S');
  });
  it('no declarations → null', () => {
    expect(resolveTrump([])).toBeNull();
  });
});

describe('flipKittyForTrump 翻底定主 (§7)', () => {
  it('a level card present → its suit becomes trump', () => {
    expect(flipKittyForTrump([c('H', '7'), c('D', '2'), c('C', '9')], LV)).toBe('H');
  });
  it('no level card → suit of the highest card', () => {
    expect(flipKittyForTrump([c('S', 'A'), c('H', 'K'), c('D', '2')], LV)).toBe('S');
  });
  it('no level, tie on top rank → higher suit', () => {
    expect(flipKittyForTrump([c('H', 'K'), c('S', 'K'), c('D', '2')], LV)).toBe('S');
  });
});
