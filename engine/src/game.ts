import type { Card, Rank, Suit } from './domain';
import type { GameEvent } from './events';
import type { RoundResult as Settlement } from './levelup';
import { buildDeck } from './deck';
import { shuffle, deal } from './deal';
import { makeRng } from './rng';
import { type TrumpCtx } from './trump';
import { comboGroup } from './legality';
import { trickWinner, type PlayInTrick } from './trick';
import { callRank, isBuriable, resolveFriends, type FriendCall, type CallCardPlay } from './friends';
import { flipKittyForTrump } from './declare';
import { sumPoints, kittyBonus } from './scoring';
import { settleRound } from './levelup';

export interface RoundOptions {
  readonly seed: number;
  readonly level: Rank; // 庄家的级 → 本局级牌
  readonly dealer: number; // 0..6
}

export interface RoundResult {
  readonly trump: Suit;
  readonly friends: (number | null)[];
  readonly declarerSeats: number[];
  readonly defenderScore: number;
  readonly settlement: Settlement;
  readonly tricksPlayed: number;
  readonly events: GameEvent[];
  readonly pointsConserved: boolean;
}

const N = 7;

/** 从 hand 里按 rng 选一张可出的牌（陪跑 AI：单张随机合法）。leadGroup 为 null 时是领牌 */
function pickCard(hand: Card[], leadGroup: ReturnType<typeof comboGroup> | null, ctx: TrumpCtx, rng: () => number): number {
  let pool: number[] = [];
  if (leadGroup !== null) {
    pool = hand.map((c, i) => (comboGroup(c, ctx) === leadGroup ? i : -1)).filter((i) => i >= 0);
  }
  if (pool.length === 0) pool = hand.map((_, i) => i); // 领牌 或 垫牌（无该门）
  return pool[Math.floor(rng() * pool.length)]!;
}

function rotate(start: number): number[] {
  return Array.from({ length: N }, (_, i) => (start + i) % N);
}

/**
 * 跑完整一局（随机合法"陪跑 AI"，确定性）。Phase 1 验证规则引擎闭环，非最终 AI（§12）。
 * 简化：陪跑 AI 仅出单张（牌型/拖拉机出牌交 Phase 2 智能 AI）；其余流程（发牌/定主/扣底/叫朋友/
 * 揭友/比墩/抓分/抠底/结算）均走真实规则函数。
 */
export function playRound(opts: RoundOptions): RoundResult {
  const { seed, level, dealer } = opts;
  const rng = makeRng(seed);
  const events: GameEvent[] = [];

  // 发牌
  const { hands: dealt, kitty: rawKitty } = deal(shuffle(buildDeck(), seed));
  const hands = dealt.map((h) => h.slice());
  events.push({ t: 'deal', dealer });

  // 定主：简化用翻底定主（无人亮的兜底规则），保证总有主
  const trump: Suit = flipKittyForTrump(rawKitty, level) ?? 'S';
  const ctx: TrumpCtx = { level, trump };
  events.push({ t: 'trump', suit: trump, via: 'flip' });

  // 庄家收底、扣回 9 张可扣牌（叫牌点不可扣）→ 最终底牌
  const pile = [...hands[dealer]!, ...rawKitty];
  const buriable = pile.map((c, i) => (isBuriable(c, level) ? i : -1)).filter((i) => i >= 0);
  const buryIdx = new Set(buriable.slice(0, 9));
  const finalKitty = [...buryIdx].map((i) => pile[i]!);
  hands[dealer] = pile.filter((_, i) => !buryIdx.has(i));
  events.push({ t: 'bury', count: finalKitty.length });

  // 叫朋友：陪跑庄家叫两张叫牌点（异花色，第 1 张）
  const cr = callRank(level);
  const calls: FriendCall[] = [
    { suit: 'H', nth: 1 },
    { suit: 'D', nth: 1 },
  ];
  events.push({ t: 'call', calls });

  // 出牌 45 墩
  const callPlays: CallCardPlay[] = [];
  const trickWins: { winner: number; cards: Card[] }[] = [];
  let leader = dealer;

  for (let trick = 0; trick < 45; trick++) {
    const order = rotate(leader);
    const plays: PlayInTrick[] = [];
    let leadGroup: ReturnType<typeof comboGroup> | null = null;

    for (const seat of order) {
      const idx = pickCard(hands[seat]!, leadGroup, ctx, rng);
      const card = hands[seat]![idx]!;
      hands[seat]!.splice(idx, 1);
      plays.push({ player: seat, cards: [card] });
      if (leadGroup === null) leadGroup = comboGroup(card, ctx);
      if (card.kind === 'suited' && card.rank === cr) {
        callPlays.push({ player: seat, suit: card.suit });
      }
      events.push({ t: 'play', trick, seat, cards: [card] });
    }

    const winner = trickWinner(plays, ctx);
    const cards = plays.flatMap((p) => p.cards);
    const points = sumPoints(cards);
    trickWins.push({ winner, cards });
    events.push({ t: 'trick', trick, winner, points });
    leader = winner;
  }

  // 揭友 → 阵营
  const friends = resolveFriends(calls, callPlays);
  const declarerSeats = [...new Set([dealer, ...friends.filter((f): f is number => f !== null)])];
  const isDeclarer = (seat: number) => declarerSeats.includes(seat);

  // 抓分（按最终阵营）+ 抠底
  let defenderTrickPoints = 0;
  for (const tw of trickWins) {
    if (!isDeclarer(tw.winner)) defenderTrickPoints += sumPoints(tw.cards);
  }
  const lastWonByDefender = !isDeclarer(trickWins[44]!.winner);
  const bonus = kittyBonus(finalKitty, 1, lastWonByDefender); // 陪跑单张 → 末墩张数 1
  const defenderScore = defenderTrickPoints + bonus;

  const settlement = settleRound(defenderScore);
  events.push({ t: 'settle', defenderScore, event: settlement.event });

  // 守恒：各墩分 + 底分 = 600
  const allTrickPoints = trickWins.reduce((s, tw) => s + sumPoints(tw.cards), 0);
  const pointsConserved = allTrickPoints + sumPoints(finalKitty) === 600;

  return {
    trump,
    friends,
    declarerSeats,
    defenderScore,
    settlement,
    tricksPlayed: trickWins.length,
    events,
    pointsConserved,
  };
}
