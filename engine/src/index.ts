// 引擎公共 API barrel（供 server / client / AI 复用）
export * from './domain';
export * from './rng';
export * from './deck';
export * from './deal';
export * from './trump';
export * from './declare';
export * from './friends';
export * from './legality';
export * from './trick';
export * from './scoring';
export { settleRound, applyLevelUp, nextDealer } from './levelup';
export type { RoundResult as Settlement, RoundEvent } from './levelup';
export * from './events';
export * from './game';
