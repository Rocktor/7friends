import {
  buildDeck, shuffle, deal, type Card, type Rank, type Suit, type TrumpCtx,
  comboGroup, classifyLead, isLegalFollow, validateThrow,
  trickWinner, type PlayInTrick,
  callRank, resolveFriends, isBuriable, type FriendCall, type CallCardPlay,
  flipKittyForTrump, canDeclare, canCounter, countJokers, levelCardsOfSuit, type Declaration,
  sumPoints, kittyBonus, settleRound, type Settlement,
} from '@engine';

export interface RoundOpts {
  readonly seed: number;
  readonly dealer: number; // 0..6
  readonly level: Rank; // 庄家的级 = 本局级牌
  // 测试/回放种子：给定 hands + trump 时直接进 play 阶段（跳过 deal/declare/bury/call）
  readonly hands?: Card[][];
  readonly kitty?: Card[];
  readonly trump?: Suit;
  readonly calls?: FriendCall[];
  // 中盘续跑（ISMCTS rollout 用）：从某一时刻的 play 状态恢复
  readonly resume?: PlayState;
}

/** play 阶段完整状态快照（中盘 rollout 续跑） */
export interface PlayState {
  hands: Card[][];
  kitty: Card[];
  trump: Suit;
  calls: FriendCall[];
  leader: number;
  turnPtr: number;
  trick: PlayInTrick[];
  callPlays: CallCardPlay[];
  trickWins: { winner: number; cards: Card[] }[];
  lastTrickSize: number;
}

export type Phase = 'declare' | 'bury' | 'call' | 'play' | 'done';

export interface PlayerView {
  readonly phase: Phase;
  readonly seat: number;
  readonly hand: Card[];
  readonly level: Rank;
  readonly dealer: number;
  readonly trump: Suit | null;
  readonly currentTurn: number | null; // declare 轮 or play 轮的当前座；bury/call 由特定座
  readonly kittyHolder: number | null;
  readonly leader: number | null;
  readonly trickSoFar: { seat: number; cards: Card[] }[];
  readonly tricksDone: number;
  readonly currentTrump: { suit: Suit; count: number; by: number } | null; // 当前亮主声明
  readonly declareLog: { player: number; suit: Suit; count: number }[]; // 本局亮/反历史（每次一星）
  readonly friendsRevealed: number[]; // 已揭示的朋友座位（庄队底色用）
  readonly yourTurn: boolean;
}

export type ApplyResult = { ok: true } | { ok: false; error: string };

const N = 7;

/** 一局的完整交互式状态机（2.2b：亮主轮/扣底/叫朋友/出牌 全交互）。服务端用 engine 校验每步；手牌按座位隔离。 */
export class GameSession {
  private readonly hands: Card[][];
  private rawKitty: Card[];
  private kitty: Card[] = [];
  readonly level: Rank;
  readonly dealer: number;

  private phase: Phase = 'declare';
  private trump: Suit | null = null;
  private ctx: TrumpCtx | null = null;
  private kittyHolder: number | null = null;
  private calls: FriendCall[] = [];

  // declare 轮
  private declareTurn = 0; // 相对 dealer 的偏移 0..6
  private currentDecl: Declaration | null = null;
  private readonly declareLog: Declaration[] = []; // 本局亮/反历史（每次一颗星）

  // play
  private leader = 0;
  private turnPtr = 0;
  private trick: PlayInTrick[] = [];
  private lastTrickSize = 1; // 末墩出牌张数（抠底倍数 §10.2）
  private readonly callPlays: CallCardPlay[] = [];
  private readonly trickWins: { winner: number; cards: Card[] }[] = [];

  private _settlement: Settlement | null = null;
  private _defenderScore = 0;
  private _friends: (number | null)[] = [];

  constructor(opts: RoundOpts) {
    this.level = opts.level;
    this.dealer = opts.dealer;
    if (opts.resume) {
      const r = opts.resume;
      this.hands = r.hands.map((h) => h.slice());
      this.rawKitty = [];
      this.kitty = r.kitty.slice();
      this.trump = r.trump;
      this.ctx = { level: opts.level, trump: r.trump };
      this.calls = r.calls.slice();
      this.kittyHolder = opts.dealer;
      this.phase = 'play';
      this.leader = r.leader;
      this.turnPtr = r.turnPtr;
      this.trick = r.trick.map((p) => ({ player: p.player, cards: p.cards.slice() }));
      this.callPlays.push(...r.callPlays);
      for (const tw of r.trickWins) this.trickWins.push({ winner: tw.winner, cards: tw.cards.slice() });
      this.lastTrickSize = r.lastTrickSize;
    } else if (opts.hands && opts.trump) {
      // 直接进 play 阶段（测试/回放）
      this.hands = opts.hands.map((h) => h.slice());
      this.rawKitty = [];
      this.kitty = opts.kitty ?? [];
      this.trump = opts.trump;
      this.ctx = { level: opts.level, trump: opts.trump };
      this.calls = opts.calls ?? [{ suit: 'H', nth: 1 }, { suit: 'D', nth: 1 }];
      this.kittyHolder = opts.dealer;
      this.phase = 'play';
      this.leader = opts.dealer;
    } else {
      const { hands, kitty } = deal(shuffle(buildDeck(), opts.seed));
      this.hands = hands.map((h) => h.slice());
      this.rawKitty = kitty;
    }
  }

  // ── 视图 ──────────────────────────────────────────────
  get currentDeclSeat(): number {
    return (this.dealer + this.declareTurn) % N;
  }
  get currentPlaySeat(): number {
    return (this.leader + this.turnPtr) % N;
  }
  private turnSeat(): number | null {
    if (this.phase === 'declare') return this.currentDeclSeat;
    if (this.phase === 'play') return this.currentPlaySeat;
    if (this.phase === 'bury') return this.kittyHolder;
    if (this.phase === 'call') return this.dealer;
    return null;
  }

  /** 当前该哪个座位行动（跨阶段），done 时 null */
  currentActor(): number | null {
    return this.turnSeat();
  }

  /** 当前阶段名 */
  phaseName(): Phase {
    return this.phase;
  }

  /** 最近一墩的出牌张数（抠底倍数依据；测试可观测）*/
  get lastLeadSize(): number {
    return this.lastTrickSize;
  }

  /** 已公开打出的所有牌（记牌/determinization 用）*/
  playedCards(): Card[] {
    return [...this.trickWins.flatMap((t) => t.cards), ...this.trick.flatMap((p) => p.cards)];
  }

  /** play 阶段完整快照（中盘 rollout 续跑用）*/
  snapshot(): PlayState {
    return {
      hands: this.hands.map((h) => h.slice()),
      kitty: this.kitty.slice(),
      trump: this.trump!,
      calls: this.calls.slice(),
      leader: this.leader,
      turnPtr: this.turnPtr,
      trick: this.trick.map((p) => ({ player: p.player, cards: p.cards.slice() })),
      callPlays: this.callPlays.slice(),
      trickWins: this.trickWins.map((t) => ({ winner: t.winner, cards: t.cards.slice() })),
      lastTrickSize: this.lastTrickSize,
    };
  }

  view(seat: number): PlayerView {
    return {
      phase: this.phase,
      seat,
      hand: this.hands[seat]!.slice(),
      level: this.level,
      dealer: this.dealer,
      trump: this.trump,
      currentTurn: this.turnSeat(),
      kittyHolder: this.kittyHolder,
      leader: this.phase === 'play' ? this.leader : null,
      trickSoFar: this.trick.map((p) => ({ seat: p.player, cards: p.cards })),
      tricksDone: this.trickWins.length,
      currentTrump: this.currentDecl
        ? { suit: this.currentDecl.suit, count: this.currentDecl.count, by: this.currentDecl.player }
        : null,
      declareLog: this.declareLog.map((d) => ({ player: d.player, suit: d.suit, count: d.count })),
      friendsRevealed: this.calls.length
        ? resolveFriends(this.calls, this.callPlays).filter((f): f is number => f !== null)
        : [],
      yourTurn: this.turnSeat() === seat,
    };
  }

  // ── 亮主轮（一轮从庄家起，各座 declare 或 pass 一次；顺序允许反；pass=弃权）§7 ──
  declare(seat: number, suit: Suit, count: number): ApplyResult {
    if (this.phase !== 'declare') return { ok: false, error: 'not declare phase' };
    if (seat !== this.currentDeclSeat) return { ok: false, error: 'not your turn' };
    const hand = this.hands[seat]!;
    if (countJokers(hand) < 2) return { ok: false, error: 'need two jokers' };
    if (count < 1 || levelCardsOfSuit(hand, this.level, suit) < count) return { ok: false, error: 'not enough level cards' };
    if (!canDeclare(hand, this.level, suit)) return { ok: false, error: 'cannot declare' };
    const decl: Declaration = { player: seat, suit, count };
    if (this.currentDecl === null) this.currentDecl = decl;
    else if (canCounter(this.currentDecl, decl)) this.currentDecl = decl;
    else return { ok: false, error: 'must change suit and beat current' };
    this.declareLog.push(decl); // 记录亮/反（每次一颗星，本局有效）
    this.advanceDeclare();
    return { ok: true };
  }

  pass(seat: number): ApplyResult {
    if (this.phase !== 'declare') return { ok: false, error: 'not declare phase' };
    if (seat !== this.currentDeclSeat) return { ok: false, error: 'not your turn' };
    this.advanceDeclare();
    return { ok: true };
  }

  private advanceDeclare(): void {
    this.declareTurn++;
    if (this.declareTurn === N) this.resolveDeclare();
  }

  private resolveDeclare(): void {
    if (this.currentDecl) {
      this.trump = this.currentDecl.suit;
      this.kittyHolder = this.currentDecl.player;
    } else {
      this.trump = flipKittyForTrump(this.rawKitty, this.level) ?? 'S';
      this.kittyHolder = this.dealer;
    }
    this.ctx = { level: this.level, trump: this.trump };
    this.hands[this.kittyHolder]!.push(...this.rawKitty); // 持底者收底 → 54 张
    this.rawKitty = [];
    this.phase = 'bury';
  }

  // ── 扣底（持底者扣 9 张，叫牌点不可扣）§7/§8 ──
  bury(seat: number, cards: Card[]): ApplyResult {
    if (this.phase !== 'bury') return { ok: false, error: 'not bury phase' };
    if (seat !== this.kittyHolder) return { ok: false, error: 'not the kitty holder' };
    if (cards.length !== 9) return { ok: false, error: 'must bury exactly 9' };
    if (!this.handHasAll(seat, cards)) return { ok: false, error: 'cards not in hand' };
    if (!cards.every((c) => isBuriable(c, this.level))) return { ok: false, error: 'cannot bury the call rank' };
    this.removeFromHand(seat, cards);
    this.kitty = cards;
    this.phase = 'call';
    return { ok: true };
  }

  // ── 叫朋友（庄家叫 2 张第 N 张某花色叫牌点）§8 ──
  call(seat: number, calls: FriendCall[]): ApplyResult {
    if (this.phase !== 'call') return { ok: false, error: 'not call phase' };
    if (seat !== this.dealer) return { ok: false, error: 'only dealer calls' };
    if (calls.length !== 2 || calls.some((c) => c.nth < 1 || c.nth > 6)) return { ok: false, error: 'need 2 valid calls' };
    this.calls = calls;
    this.phase = 'play';
    this.leader = this.dealer;
    this.turnPtr = 0;
    return { ok: true };
  }

  // ── 出牌 ──
  lowestLegalSingle(seat: number): Card | null {
    const hand = this.hands[seat]!;
    if (hand.length === 0 || !this.ctx) return hand[0] ?? null;
    if (this.turnPtr === 0) return hand[0]!;
    const leadGroup = comboGroup(this.trick[0]!.cards[0]!, this.ctx);
    const sameGroup = hand.filter((c) => comboGroup(c, this.ctx!) === leadGroup);
    return (sameGroup[0] ?? hand[0])!;
  }

  play(seat: number, cards: Card[]): ApplyResult {
    if (this.phase !== 'play' || !this.ctx) return { ok: false, error: 'not play phase' };
    if (seat !== this.currentPlaySeat) return { ok: false, error: 'not your turn' };
    if (!this.handHasAll(seat, cards)) return { ok: false, error: 'cards not in hand' };
    let toPlay = cards;
    if (this.turnPtr === 0) {
      const combo = classifyLead(cards, this.ctx);
      if (combo.type === 'illegal') return { ok: false, error: 'illegal lead' };
      if (combo.type === 'throw') {
        // 甩牌：整桌裁决；若某家能压任一单元 → 失败、强制只出最小一手（§9 G3）
        const others = this.hands.filter((_, i) => i !== seat);
        const tr = validateThrow(cards, others, this.ctx);
        if (!tr.ok) toPlay = tr.forced;
      }
    } else {
      const lead = classifyLead(this.trick[0]!.cards, this.ctx);
      if (!isLegalFollow(lead, this.hands[seat]!, cards, this.ctx)) return { ok: false, error: 'illegal follow' };
    }
    this.removeFromHand(seat, toPlay);
    this.trick.push({ player: seat, cards: toPlay });
    const cr = callRank(this.level);
    for (const c of toPlay) if (c.kind === 'suited' && c.rank === cr) this.callPlays.push({ player: seat, suit: c.suit });
    this.turnPtr++;
    if (this.turnPtr === N) this.resolveTrick();
    return { ok: true };
  }

  private resolveTrick(): void {
    this.lastTrickSize = this.trick[0]!.cards.length; // 末墩抠底倍数用（§10.2）
    const winner = trickWinner(this.trick, this.ctx!);
    this.trickWins.push({ winner, cards: this.trick.flatMap((p) => p.cards) });
    this.leader = winner;
    this.turnPtr = 0;
    this.trick = [];
    // 一局结束 = 所有人手牌出完（每墩各家出 leadSize 张，张数同步递减；非固定 45 墩）
    if (this.hands.every((h) => h.length === 0)) this.finish();
  }

  private finish(): void {
    this._friends = resolveFriends(this.calls, this.callPlays);
    const declarers = new Set([this.dealer, ...this._friends.filter((f): f is number => f !== null)]);
    let defScore = 0;
    for (const tw of this.trickWins) if (!declarers.has(tw.winner)) defScore += sumPoints(tw.cards);
    const lastWin = this.trickWins[this.trickWins.length - 1]!;
    defScore += kittyBonus(this.kitty, this.lastTrickSize, !declarers.has(lastWin.winner));
    this._defenderScore = defScore;
    this._settlement = settleRound(defScore);
    this.phase = 'done';
  }

  isOver(): boolean {
    return this.phase === 'done';
  }

  result(): { defenderScore: number; settlement: Settlement; friends: (number | null)[]; pointsConserved: boolean } {
    if (!this._settlement) throw new Error('round not finished');
    const trickPts = this.trickWins.reduce((s, tw) => s + sumPoints(tw.cards), 0);
    return {
      defenderScore: this._defenderScore,
      settlement: this._settlement,
      friends: this._friends,
      pointsConserved: trickPts + sumPoints(this.kitty) === 600,
    };
  }

  // ── 工具 ──
  private handHasAll(seat: number, cards: Card[]): boolean {
    const pool = this.hands[seat]!.slice();
    for (const c of cards) {
      const i = pool.findIndex((h) => sameCard(h, c));
      if (i < 0) return false;
      pool.splice(i, 1);
    }
    return true;
  }
  private removeFromHand(seat: number, cards: Card[]): void {
    const hand = this.hands[seat]!;
    for (const c of cards) {
      const i = hand.findIndex((h) => sameCard(h, c));
      if (i >= 0) hand.splice(i, 1);
    }
  }
}

function sameCard(a: Card, b: Card): boolean {
  if (a.kind === 'joker' && b.kind === 'joker') return a.joker === b.joker;
  if (a.kind === 'suited' && b.kind === 'suited') return a.suit === b.suit && a.rank === b.rank;
  return false;
}
