/**
 * Candidate tracking on top of the Shell-Out engine (no new search algorithm).
 *
 * A session holds the user's real pulls for one stream (normal or fest) plus the search
 * conditions. Searching is done by OffsetSearch (engine/shellout.mjs); narrowing after a new
 * pull uses refineCandidates() when — and only when — the previous search was exhaustive and
 * not capped, because only then is the candidate set complete. Otherwise a full re-search with
 * all pulls is required. Forecasts use simulate() per candidate.
 *
 * Wording rule: "1 candidate" means one position inside the searched range under the stated
 * conditions. It is not a proof of the real game state, and the engine itself is not yet
 * verified against the real game.
 *
 * Pure functions on plain objects. No DOM, no storage.
 */
import {
  OffsetSearch, refineCandidates, simulate, makeContext, normalizeObservation, initialState,
  tableForSeason, GRADES,
} from './shellout.mjs';

export const RANGE_PRESETS = Object.freeze([1 << 14, 1 << 16, 1 << 17, 1 << 18, 1 << 20, 1 << 22]);
export const DEFAULT_RANGE = 1 << 17;

/**
 * Realistic search range by date, same heuristic as the public seed tool:
 * (days since 2022-09-01, local time) * 33 + 20 random numbers. A rule of thumb, not a game rule.
 */
export function rangeForDate(date = new Date()) {
  const days = Math.floor((new Date(date) - new Date(2022, 8, 1)) / (24 * 3600 * 1000));
  return Math.max(1, days) * 33 + 20;
}

/** Average random numbers used per pull under a season's table (1 for the row + item draws). */
export function drawsPerPull(season, { missingBanners = 2, missingTitles = 2 } = {}) {
  let extra = 0;
  for (const row of tableForSeason(season)) {
    const p = row.percent / 100;
    if (row.subType === 'Limited') extra += p * ((row.type === 'NamePlateBg' ? missingBanners : missingTitles) > 0 ? 2 : 0);
    else if (row.type === 'FoodTicket' || row.type === 'GearSkillChip' || row.type === 'DrinkTicket') extra += p;
  }
  return 1 + extra;
}

/** Rough number of pulls already made before a candidate position (offset in random numbers). */
export function estimatePulls(offset, season, own) {
  return Math.round(offset / drawsPerPull(season, own));
}
export const DEFAULT_MAX_CANDIDATES = 2000;
export const FORECAST_LEN = 10;

/** Observation key used for grouping: grade plus item when the item is known. */
export function outcomeKey(o) {
  return o.type == null ? String(o.grade) : `${o.grade}|${o.type}|${o.subType ?? 'None'}`;
}

/** Distinct items a grade can produce under the season's table (for the result picker). */
export function itemsForGrade(season, grade) {
  const seen = new Map();
  for (const row of tableForSeason(season)) {
    if (row.grade !== grade) continue;
    const k = `${row.type}|${row.subType}`;
    if (!seen.has(k)) seen.set(k, { grade, type: row.type, subType: row.subType });
  }
  // Owned jackpot items are re-rolled as the bronze 10-chip pack, which therefore also appears as bronze.
  return [...seen.values()];
}

export function newSession({ mode = 'normal', season, missingBanners = null, missingTitles = null, maxOffset = DEFAULT_RANGE, maxCandidates = DEFAULT_MAX_CANDIDATES } = {}) {
  const ctx = makeContext({ season, missingBanners, missingTitles }); // validates
  if (mode !== 'normal' && mode !== 'fest') throw new RangeError('mode must be normal or fest');
  validateRange(maxOffset, maxCandidates);
  return {
    v: 1, mode, season: ctx.season, missingBanners: ctx.missingBanners, missingTitles: ctx.missingTitles,
    maxOffset, maxCandidates, observations: [], timeline: [], epoch: 0,
  };
}

function validateRange(maxOffset, maxCandidates) {
  if (!Number.isSafeInteger(maxOffset) || maxOffset < 1 || maxOffset > 2 ** 32) throw new RangeError('Invalid search range');
  if (!Number.isSafeInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 100000) throw new RangeError('Invalid candidate cap');
}

export function contextOf(session) {
  return makeContext({ season: session.season, missingBanners: session.missingBanners, missingTitles: session.missingTitles });
}

/** Parameters for engine/search-worker.mjs or OffsetSearch. */
export function searchParams(session, nplnUserId) {
  if (!session.observations.length) throw new RangeError('Need at least one pull to search');
  return {
    nplnUserId, mode: session.mode, observations: session.observations,
    context: { season: session.season, missingBanners: session.missingBanners, missingTitles: session.missingTitles },
    maxOffset: session.maxOffset, maxCandidates: session.maxCandidates,
  };
}

/** Synchronous search (tests, small ranges). The page runs the same OffsetSearch in slices or in the worker. */
export function runSearch(session, nplnUserId) {
  const p = searchParams(session, nplnUserId);
  return new OffsetSearch({
    startState: initialState(nplnUserId, p.mode), observations: p.observations, context: contextOf(session),
    maxOffset: p.maxOffset, maxCandidates: p.maxCandidates,
  }).runToEnd();
}

/** True when the result is a complete list of every matching position in the range. */
export function isComplete(result) {
  return !!result && result.exhaustive && !result.truncated;
}

/**
 * Status for display. `searching` = a search is running for the current pulls.
 * kind: idle | searching | none | unique | several | capped | cancelled
 */
export function status(session, result, { searching = false, progress = 0, cancelled = false } = {}) {
  const base = { pulls: session.observations.length, range: session.maxOffset };
  if (!session.observations.length) return { ...base, kind: 'idle' };
  if (searching) return { ...base, kind: 'searching', progress, found: result?.candidates?.length ?? 0 };
  if (cancelled || !result) return { ...base, kind: 'cancelled', found: result?.candidates?.length ?? 0, searched: result?.searched ?? 0 };
  const n = result.candidates.length;
  if (result.truncated) return { ...base, kind: 'capped', count: n, atLeast: true, searched: result.searched };
  if (!result.exhaustive) return { ...base, kind: 'cancelled', found: n, searched: result.searched };
  if (n === 0) return { ...base, kind: 'none', count: 0, searched: result.searched };
  if (n === 1) return { ...base, kind: 'unique', count: 1, searched: result.searched };
  return { ...base, kind: 'several', count: n, searched: result.searched };
}

function timelineEntry(session, result, kind) {
  return {
    kind, pulls: session.observations.length, epoch: session.epoch,
    count: result.candidates.length, complete: isComplete(result), truncated: result.truncated,
    searched: result.searched, maxOffset: session.maxOffset,
  };
}

/** Record a finished search in the session timeline. kind: 'search' (first/after pull) | 'research' (conditions changed). */
export function withSearchResult(session, result, kind = 'search') {
  const entry = timelineEntry(session, result, kind);
  const last = session.timeline.at(-1);
  // Re-running the same search (reload, retry) replaces the entry instead of adding a duplicate step.
  if (last && last.pulls === entry.pulls && last.epoch === entry.epoch) {
    return { ...session, timeline: [...session.timeline.slice(0, -1), { ...entry, kind: last.kind === 'research' ? 'research' : entry.kind, ...(last.before != null ? { before: last.before } : {}) }] };
  }
  return { ...session, timeline: [...session.timeline, entry] };
}

/**
 * Add one real pull. Returns { session, result, needsSearch }.
 * - previous result complete -> refineCandidates (exact), result updated, timeline 'refine'.
 * - otherwise -> needsSearch: the caller must run a full search with all pulls.
 */
export function addPull(session, result, observation) {
  const obs = normalizeObservation(observation);
  const next = { ...session, observations: [...session.observations, obs] };
  if (isComplete(result)) {
    const before = result.candidates.length;
    const candidates = refineCandidates(result.candidates, [obs]);
    const r = { ...result, candidates, unique: candidates.length === 1 };
    const s = { ...next, timeline: [...next.timeline, { ...timelineEntry(next, r, 'refine'), before }] };
    return { session: s, result: r, needsSearch: false };
  }
  return { session: next, result: null, needsSearch: true };
}

/** Remove the last pull. The caller restores the previous result from its undo stack or re-searches. */
export function removeLastPull(session) {
  if (!session.observations.length) return session;
  const observations = session.observations.slice(0, -1);
  const timeline = session.timeline.filter(e => e.pulls <= observations.length);
  return { ...session, observations, timeline };
}

/** Change conditions (range, cap, season, ownership). Starts a new epoch: old counts are not comparable. */
export function changeConditions(session, patch) {
  const merged = { ...session, ...patch };
  const ctx = makeContext({ season: merged.season, missingBanners: merged.missingBanners, missingTitles: merged.missingTitles });
  validateRange(merged.maxOffset, merged.maxCandidates);
  return { ...merged, season: ctx.season, missingBanners: ctx.missingBanners, missingTitles: ctx.missingTitles, epoch: session.epoch + 1 };
}

/**
 * Forecast of the next n pulls over the current candidates (capped to `limit` candidates).
 * For each step: groups of identical outcomes with candidate counts, and whether all agree.
 * Shares are "k of the searched candidates", not game probabilities.
 */
export function forecast(result, n = FORECAST_LEN, { limit = 2000 } = {}) {
  if (!result || !result.candidates.length) return { steps: [], used: 0, total: result?.candidates?.length ?? 0 };
  const cands = result.candidates.slice(0, limit);
  const sims = cands.map(c => simulate(c.stateAfter, c.contextAfter, n).pulls);
  const steps = [];
  for (let i = 0; i < n; i++) {
    const groups = new Map();
    const colors = new Map();
    for (const pulls of sims) {
      const p = pulls[i];
      const o = { grade: p.grade, type: p.row.type, subType: p.row.subType, substituted: p.substituted };
      const k = outcomeKey(o);
      const g = groups.get(k) ?? { ...o, count: 0 };
      g.count++;
      groups.set(k, g);
      colors.set(p.grade, (colors.get(p.grade) ?? 0) + 1);
    }
    const list = [...groups.values()].sort((a, b) => b.count - a.count || a.grade - b.grade);
    const colorList = [...colors.entries()].map(([grade, count]) => ({ grade, count })).sort((a, b) => b.count - a.count || a.grade - b.grade);
    steps.push({ index: i, groups: list, colors: colorList, consensus: list.length === 1, colorConsensus: colorList.length === 1 });
  }
  return { steps, used: cands.length, total: result.candidates.length };
}

/** The observation implied by clicking the first forecast card, or null when candidates disagree. */
export function consensusFirst(fc) {
  const s = fc.steps[0];
  if (!s || !s.consensus) return null;
  const g = s.groups[0];
  return { grade: g.grade, type: g.type, subType: g.subType };
}

/** Persisted shape (no ID unless the caller adds it with consent; no states, no tokens). */
export function serializeSession(session) {
  return {
    v: 1, mode: session.mode, season: session.season, missingBanners: session.missingBanners, missingTitles: session.missingTitles,
    maxOffset: session.maxOffset, maxCandidates: session.maxCandidates, observations: session.observations,
    timeline: session.timeline, epoch: session.epoch,
  };
}

export function deserializeSession(obj) {
  if (!obj || obj.v !== 1) throw new RangeError('Unknown session format');
  const s = newSession(obj);
  return {
    ...s,
    observations: (obj.observations ?? []).map(normalizeObservation),
    timeline: Array.isArray(obj.timeline) ? obj.timeline : [],
    epoch: Number.isInteger(obj.epoch) ? obj.epoch : 0,
  };
}

export { GRADES };
