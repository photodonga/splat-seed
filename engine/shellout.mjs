/**
 * SPLAT SEED — independent Shell-Out Machine (lobby capsule) engine.
 *
 * Model (see README "근거" for evidence and verification status):
 *  - Stream RNG: xorshift128, one independent stream per machine
 *    ("Lot" = regular, "LotFest" = Splatfest).
 *  - Initial state word i = MurmurHash3_x86_32(`${nplnUserId}_${streamKey}_${i}`), i = 0..3.
 *  - Each pull draws one percent value r in [0,100) and picks the first table row whose
 *    running cumulative percentage exceeds r.
 *  - Extra u32 draws per pull depend on the reward row (see EXTRA_DRAWS / pullOnce()).
 *  - Seasonal jackpot rows ("Limited", gold/silver): if every current-season jackpot item of
 *    that kind is already owned, the pull is replaced by row 2 (bronze, 10 ability chips) and
 *    makes no extra draws; otherwise one discarded draw plus one pick draw, and the picked
 *    item becomes owned.
 *
 * This file contains no third-party code.
 */
import { murmur3x86_32 } from './murmur3.mjs';
import { XorShift128 } from './xorshift128.mjs';

export const GRADES = Object.freeze(['gold', 'silver', 'bronze', 'red', 'purple', 'blue']);
export const STREAM_KEYS = Object.freeze({ normal: 'Lot', fest: 'LotFest' });

// Reward rows in in-game table order. [grade, percent, type, subType]
// Source: lottery parameter table as shipped in public seed tools and matching the
// published odds on Inkipedia. Order matters (cumulative selection).
const TABLE_V110 = [
  [0, 0.1, 'NamePlateBg', 'Limited'],
  [1, 0.3, 'Byname', 'Limited'],
  [2, 0.6, 'AllGearSkillChip', 'None'],
  [3, 4, 'MiniGameCardPack', 'None'],
  [3, 3, 'FoodTicket', 'FoodParty'],
  [3, 6, 'NamePlateBg', 'None'],
  [4, 10, 'GearSkillChip', 'None'],
  [4, 7, 'FoodTicket', 'Food100'],
  [4, 22, 'Byname', 'None'],
  [5, 10, 'LockerSticker', 'None'],
  [5, 10, 'LockerFigure', 'None'],
  [5, 13, 'FoodTicket', 'Food50'],
  [5, 14, 'DrinkTicket', 'None'],
];
const TABLE_V300 = [
  [0, 0.1, 'NamePlateBg', 'Limited'],
  [1, 0.3, 'Byname', 'Limited'],
  [2, 0.6, 'AllGearSkillChip', 'None'],
  [3, 4, 'MiniGameCardPack', 'None'],
  [3, 3, 'FoodTicket', 'FoodParty'],
  [3, 2, 'Emote', 'None'],
  [3, 6, 'NamePlateBg', 'None'],
  [4, 10, 'GearSkillChip', 'None'],
  [4, 7, 'FoodTicket', 'Food100'],
  [4, 22, 'Byname', 'None'],
  [5, 9, 'LockerSticker', 'None'],
  [5, 9, 'LockerFigure', 'None'],
  [5, 13, 'FoodTicket', 'Food50'],
  [5, 14, 'DrinkTicket', 'None'],
];
export const SUBSTITUTE_ROW = 2;

function buildTable(rows) {
  let cum = 0;
  return Object.freeze(rows.map(([grade, percent, type, subType], index) => {
    cum += percent; // double accumulation, in table order
    return Object.freeze({ index, grade, percent, type, subType, cumulative: cum });
  }));
}
export const TABLES = Object.freeze({ v110: buildTable(TABLE_V110), v300: buildTable(TABLE_V300) });

/**
 * Season numbering: 1 = first season (2022-09-01 UTC). Seasons start every 3 months (Mar/Jun/Sep/Dec 1st, 00:00 UTC).
 * A season includes its own start instant (start <= t). The public tool counts start < t, so the two differ only at
 * the exact start millisecond. The in-game reward-table switch time itself is unverified.
 */
export function seasonAt(date = new Date()) {
  const t = (date instanceof Date ? date : new Date(date)).getTime();
  if (!Number.isFinite(t)) throw new RangeError('Invalid date');
  // Number of season starts at or before t, counting from 2022-09-01.
  let count = 0;
  let year = 2022, month = 8; // Sep 2022 (0-based month)
  while (Date.UTC(year, month, 1) <= t && count < 1000) {
    count++;
    month += 3;
    if (month > 11) { month -= 12; year++; }
  }
  return count;
}

export function tableForSeason(season) {
  if (!Number.isInteger(season) || season < 0) throw new RangeError('Invalid season');
  return season >= 3 ? TABLES.v300 : TABLES.v110;
}

/** Number of distinct jackpot items of one kind per season (1 for seasons 1-8, 2 from season 9). */
export function jackpotItemsPerKind(season) {
  return season < 9 ? 1 : 2;
}

export function initialState(nplnUserId, mode = 'normal') {
  const key = STREAM_KEYS[mode];
  if (!key) throw new RangeError('mode must be "normal" or "fest"');
  if (typeof nplnUserId !== 'string' || !/^[0-9a-z]{6,64}$/i.test(nplnUserId)) {
    throw new RangeError('NPLN user ID must be 6-64 ASCII letters/digits');
  }
  return [0, 1, 2, 3].map(i => murmur3x86_32(`${nplnUserId}_${key}_${i}`));
}

/**
 * Pull context. `ownershipAware`:
 *   true  — model the jackpot ownership substitution (needs missing counts).
 *   false — "simple" mode: jackpot rows always draw 2 extra u32 and never substitute
 *           (equivalent to the public tool's non-accuracy mode).
 */
export function makeContext({ season, ownershipAware = true, missingBanners = null, missingTitles = null } = {}) {
  if (!Number.isInteger(season) || season < 1) throw new RangeError('season required (>=1)');
  const per = jackpotItemsPerKind(season);
  const mb = missingBanners ?? per;
  const mt = missingTitles ?? per;
  for (const v of [mb, mt]) if (!Number.isInteger(v) || v < 0 || v > per) throw new RangeError(`missing count must be 0..${per}`);
  return { season, table: tableForSeason(season), ownershipAware: !!ownershipAware, missingBanners: mb, missingTitles: mt };
}

export function cloneContext(c) {
  return { season: c.season, table: c.table, ownershipAware: c.ownershipAware, missingBanners: c.missingBanners, missingTitles: c.missingTitles };
}

export function selectRow(table, r) {
  for (let i = 0; i < table.length; i++) if (r < table[i].cumulative) return table[i];
  // r is < 100 by construction and table sums to >= 100; unreachable unless table is malformed.
  throw new Error('Reward table does not cover draw');
}

/**
 * Performs one pull, mutating rng and ctx.
 * Returns { grade, row, substituted, extraDraws, ability?, pick? }.
 */
export function pullOnce(rng, ctx) {
  const row = selectRow(ctx.table, rng.nextPercent());
  if (row.subType === 'Limited') {
    if (!ctx.ownershipAware) {
      rng.nextU32();
      rng.nextU32();
      return { grade: row.grade, row, substituted: false, extraDraws: 2 };
    }
    const isBanner = row.type === 'NamePlateBg';
    const missing = isBanner ? ctx.missingBanners : ctx.missingTitles;
    if (missing === 0) {
      const sub = ctx.table[SUBSTITUTE_ROW];
      return { grade: sub.grade, row: sub, original: row, substituted: true, extraDraws: 0 };
    }
    rng.nextU32();
    const pick = rng.nextU32() % missing;
    if (isBanner) ctx.missingBanners--; else ctx.missingTitles--;
    return { grade: row.grade, row, substituted: false, extraDraws: 2, pick };
  }
  if (row.type === 'FoodTicket') {
    rng.nextU32();
    return { grade: row.grade, row, substituted: false, extraDraws: 1 };
  }
  if (row.type === 'GearSkillChip' || row.type === 'DrinkTicket') {
    const ability = rng.nextU32() % 14;
    return { grade: row.grade, row, substituted: false, extraDraws: 1, ability };
  }
  return { grade: row.grade, row, substituted: false, extraDraws: 0 };
}

/** Simulate n pulls from a state. Does not mutate inputs. */
export function simulate(state, ctx, n) {
  const rng = XorShift128.fromState(state);
  const c = cloneContext(ctx);
  const out = [];
  for (let i = 0; i < n; i++) out.push(pullOnce(rng, c));
  return { pulls: out, state: rng.state(), ctx: c };
}

/**
 * Direct reproduction from a KNOWN state immediately before the first observed pull.
 * No position search is performed: pull i is predicted from that exact state.
 * Returns per-pull predictions, the first mismatch index (or -1) and the state after the last pull.
 */
export function reproduce(startStateBeforeFirstPull, ctx, observations) {
  const obs = observations.map(normalizeObservation);
  const rng = XorShift128.fromState(startStateBeforeFirstPull);
  const c = cloneContext(ctx);
  const pulls = [];
  let firstMismatch = -1;
  for (let i = 0; i < obs.length; i++) {
    const r = pullOnce(rng, c);
    pulls.push(r);
    if (firstMismatch < 0 && !matches(r, obs[i])) firstMismatch = i;
  }
  return { pulls, firstMismatch, stateAfterLastPull: rng.state(), contextAfter: c };
}

/**
 * Observation: { grade: 0..5 } (capsule color only) or additionally
 * { type, subType } for the exact reward row (as shown after substitution).
 */
export function normalizeObservation(o) {
  if (typeof o === 'string') o = { grade: GRADES.indexOf(o) };
  if (!o || !Number.isInteger(o.grade) || o.grade < 0 || o.grade > 5) throw new RangeError('Invalid observation grade');
  const r = { grade: o.grade };
  if (o.type != null) { r.type = String(o.type); r.subType = String(o.subType ?? 'None'); }
  return r;
}

function matches(res, obs) {
  if (res.grade !== obs.grade) return false;
  if (obs.type !== undefined && (res.row.type !== obs.type || res.row.subType !== obs.subType)) return false;
  return true;
}

/**
 * Incremental exhaustive search over u32 offsets [0, maxOffset) of a stream.
 * Each offset is tested by simulating all observations from that position.
 * Call step(budget) repeatedly (e.g. from a Worker) until done.
 */
export class OffsetSearch {
  constructor({ startState, observations, context, maxOffset = 1 << 20, maxCandidates = 64 }) {
    if (!Array.isArray(observations) || observations.length < 1) throw new RangeError('Need at least one observation');
    if (!Number.isSafeInteger(maxOffset) || maxOffset < 1 || maxOffset > 2 ** 32) throw new RangeError('Invalid maxOffset');
    this.obs = observations.map(normalizeObservation);
    this.ctx = cloneContext(context);
    this.base = XorShift128.fromState(startState);
    this.scratch = this.base.clone();
    this.offset = 0;
    this.maxOffset = maxOffset;
    this.maxCandidates = maxCandidates;
    this.candidates = [];
    this.truncated = false;
    this._c = cloneContext(context);
  }

  get done() {
    return this.offset >= this.maxOffset || this.truncated;
  }

  get progress() {
    return Math.min(1, this.offset / this.maxOffset);
  }

  step(budget = 50000) {
    const obs = this.obs, n = obs.length, c = this._c, ctx = this.ctx, s = this.scratch;
    const end = Math.min(this.maxOffset, this.offset + budget);
    for (; this.offset < end; this.offset++) {
      s.copyFrom(this.base);
      c.missingBanners = ctx.missingBanners;
      c.missingTitles = ctx.missingTitles;
      let ok = true;
      for (let i = 0; i < n; i++) {
        if (!matches(pullOnce(s, c), obs[i])) { ok = false; break; }
      }
      if (ok) {
        this.candidates.push({
          offset: this.offset,
          stateBefore: this.base.state(),
          stateAfter: s.state(),
          contextAfter: cloneContext(c),
        });
        if (this.candidates.length >= this.maxCandidates) { this.truncated = true; this.offset++; break; }
      }
      this.base.nextU32();
    }
    return this.done;
  }

  runToEnd() {
    while (!this.step(1 << 20));
    return this.result();
  }

  result() {
    return {
      candidates: this.candidates,
      searched: this.offset,
      maxOffset: this.maxOffset,
      exhaustive: this.offset >= this.maxOffset && !this.truncated,
      truncated: this.truncated,
      unique: this.offset >= this.maxOffset && !this.truncated && this.candidates.length === 1,
    };
  }
}

/** Filter existing candidates with additional observations (pulled after the previous ones). */
export function refineCandidates(candidates, newObservations) {
  const obs = newObservations.map(normalizeObservation);
  const out = [];
  for (const cand of candidates) {
    const rng = XorShift128.fromState(cand.stateAfter);
    const c = cloneContext(cand.contextAfter);
    let ok = true;
    for (const o of obs) if (!matches(pullOnce(rng, c), o)) { ok = false; break; }
    if (ok) out.push({ ...cand, stateAfter: rng.state(), contextAfter: cloneContext(c) });
  }
  return out;
}

/** 1-based number of pulls until the next gold capsule (after substitution), or null if > limit. */
export function pullsUntilGold(state, ctx, limit = 200000) {
  const rng = XorShift128.fromState(state);
  const c = cloneContext(ctx);
  for (let i = 1; i <= limit; i++) if (pullOnce(rng, c).grade === 0) return i;
  return null;
}

/** Expected false-match probability per offset for a sequence of colors (informational). */
export function gradeProbabilities(table) {
  const p = [0, 0, 0, 0, 0, 0];
  for (const r of table) p[r.grade] += r.percent / 100;
  return p;
}
