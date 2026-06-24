import type { Card, Suit } from './domain';
import type { FriendCall } from './friends';
import type { RoundEvent } from './levelup';

/** 结构化对局事件流（§12，喂 Phase 4 复盘 + AI 分析）*/
export type GameEvent =
  | { readonly t: 'deal'; readonly dealer: number }
  | { readonly t: 'trump'; readonly suit: Suit; readonly via: 'declare' | 'flip' }
  | { readonly t: 'bury'; readonly count: number }
  | { readonly t: 'call'; readonly calls: FriendCall[] }
  | { readonly t: 'play'; readonly trick: number; readonly seat: number; readonly cards: Card[] }
  | { readonly t: 'reveal'; readonly callIndex: number; readonly seat: number }
  | { readonly t: 'trick'; readonly trick: number; readonly winner: number; readonly points: number }
  | { readonly t: 'settle'; readonly defenderScore: number; readonly event: RoundEvent };
