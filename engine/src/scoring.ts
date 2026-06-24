import type { Card } from './domain';

export type Camp = 'declarer' | 'defender'; // 庄队 / 闲家

/** 单牌分值：5=5、10=10、K=10，其余 0（§10.1）*/
export function cardPoints(c: Card): number {
  if (c.kind === 'joker') return 0;
  if (c.rank === '5') return 5;
  if (c.rank === '10' || c.rank === 'K') return 10;
  return 0;
}

/** 一组牌总分 */
export function sumPoints(cards: Card[]): number {
  return cards.reduce((s, c) => s + cardPoints(c), 0);
}

/** 抠底倍数 = 2^末墩出牌张数（单×2/双×4/三×8）§10.2 */
export function kittyMultiplier(lastTrickSize: number): number {
  return 2 ** lastTrickSize;
}

/** 抠底加分：闲家赢末墩 → 倍数×底分；庄队赢(保底) → 0（§10.2）*/
export function kittyBonus(kitty: Card[], lastTrickSize: number, defendersWonLast: boolean): number {
  if (!defendersWonLast) return 0;
  return kittyMultiplier(lastTrickSize) * sumPoints(kitty);
}

/** 闲家牌面抓分（各墩按最终阵营归集，仅 defender）§10.1 */
export function defendersTrickPoints(tricks: { camp: Camp; cards: Card[] }[]): number {
  return tricks
    .filter((t) => t.camp === 'defender')
    .reduce((s, t) => s + sumPoints(t.cards), 0);
}
