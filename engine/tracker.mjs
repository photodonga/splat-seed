/**
 * Pull-by-pull tracker on top of the Shell-Out engine.
 *
 * The user pastes the state shown by the public seed tool (the state right BEFORE the next pull),
 * then records each real pull. A recorded pull is accepted only if it equals the engine's prediction;
 * otherwise the stream stops (state unchanged) until the user fixes ownership, undoes a mis-tap,
 * or pastes a fresh state. Accepted pulls advance the state, so the tool never drifts silently.
 *
 * Pure functions on plain objects (JSON-serializable). No DOM.
 */
import { makeContext, pullOnce, simulate, pullsUntilGold, normalizeObservation, jackpotItemsPerKind } from './shellout.mjs';
import { XorShift128, parseStateHex } from './xorshift128.mjs';

export const PULL_COST = Object.freeze({ firstOfDay: 5000, regular: 30000 });
const HISTORY_CAP = 2000;

/** Accepts "0x1a | 0x2b | 0x3c | 0x4d", spaces/commas/newlines, with or without 0x. Exactly 4 words. */
export function parseStateText(text) {
  const words = String(text ?? '').match(/(?:0x)?[0-9a-f]{1,8}/gi) ?? [];
  if (words.length !== 4) throw new RangeError(`상태는 16진수 4개여야 합니다 (현재 ${words.length}개)`);
  const state = parseStateHex(words);
  if (state.every(v => v === 0)) throw new RangeError('0만 있는 상태는 사용할 수 없습니다');
  return state;
}

export function formatState(state) {
  return state.map(v => '0x' + (v >>> 0).toString(16).padStart(8, '0')).join(' | ');
}

function ctxOf(s) {
  return makeContext({ season: s.season, missingBanners: s.missingBanners, missingTitles: s.missingTitles });
}

export function newStream({ state, season, missingBanners, missingTitles }) {
  const ctx = makeContext({ season, missingBanners, missingTitles }); // validates
  XorShift128.fromState(state); // validates
  return {
    v: 1, state: [...state], season: ctx.season, missingBanners: ctx.missingBanners, missingTitles: ctx.missingTitles,
    history: [], streak: 0, stopped: null,
  };
}

export function predictions(s, n) {
  return simulate(s.state, ctxOf(s), n).pulls;
}

/** 1-based number of pulls until the next capsule of `grade` (0 gold, 1 silver), or null within limit. */
export function untilGrade(s, grade, limit = 200000) {
  const rng = XorShift128.fromState(s.state);
  const ctx = ctxOf(s);
  for (let i = 1; i <= limit; i++) if (pullOnce(rng, ctx).grade === grade) return i;
  return null;
}

export function untilGold(s, limit = 200000) {
  return pullsUntilGold(s.state, ctxOf(s), limit);
}

function matchesObs(res, obs) {
  if (res.grade !== obs.grade) return false;
  if (obs.type !== undefined && (res.row.type !== obs.type || res.row.subType !== obs.subType)) return false;
  return true;
}

/** Record one real pull. Returns { stream, match, predicted }. Never mutates the input. */
export function record(s, observation) {
  if (s.stopped) throw new Error('stream is stopped; resolve the mismatch first');
  const obs = normalizeObservation(observation);
  const rng = XorShift128.fromState(s.state);
  const ctx = ctxOf(s);
  const predicted = pullOnce(rng, ctx);
  const pred = { grade: predicted.grade, type: predicted.row.type, subType: predicted.row.subType, substituted: !!predicted.substituted };
  if (!matchesObs(predicted, obs)) {
    return { match: false, predicted: pred, stream: { ...s, stopped: { obs, predicted: pred, index: s.history.length } } };
  }
  const entry = {
    grade: predicted.grade, type: predicted.row.type, subType: predicted.row.subType, itemGiven: obs.type !== undefined,
    stateBefore: [...s.state], missingBefore: [s.missingBanners, s.missingTitles], at: Date.now(),
  };
  const history = [...s.history, entry].slice(-HISTORY_CAP);
  return {
    match: true, predicted: pred,
    stream: { ...s, state: rng.state(), missingBanners: ctx.missingBanners, missingTitles: ctx.missingTitles, history, streak: s.streak + 1, stopped: null },
  };
}

/** Undo: clears a pending mismatch, otherwise reverts the last accepted pull. */
export function undo(s) {
  if (s.stopped) return { ...s, stopped: null };
  const last = s.history.at(-1);
  if (!last) return s;
  return {
    ...s, state: [...last.stateBefore], missingBanners: last.missingBefore[0], missingTitles: last.missingBefore[1],
    history: s.history.slice(0, -1), streak: Math.max(0, s.streak - 1), stopped: null,
  };
}

/** Change ownership for the state before the next pull; re-checks a pending mismatch with it. */
export function setOwnership(s, missingBanners, missingTitles) {
  const per = jackpotItemsPerKind(s.season);
  for (const v of [missingBanners, missingTitles]) if (!Number.isInteger(v) || v < 0 || v > per) throw new RangeError(`0..${per}`);
  const next = { ...s, missingBanners, missingTitles, stopped: null };
  if (!s.stopped) return { stream: next, resolved: null };
  const r = record(next, s.stopped.obs);
  return r.match ? { stream: r.stream, resolved: true } : { stream: { ...r.stream }, resolved: false };
}

/** Replace the state (fresh paste). Keeps history for display, resets the streak. */
export function replaceState(s, state) {
  XorShift128.fromState(state);
  return { ...s, state: [...state], stopped: null, streak: 0 };
}

/** New season: new reward table and new jackpot items (all missing). */
export function changeSeason(s, season) {
  const per = jackpotItemsPerKind(season);
  makeContext({ season, missingBanners: per, missingTitles: per });
  return { ...s, season, missingBanners: per, missingTitles: per, stopped: null };
}

/**
 * Cash plan for n pulls. firstOfDay pulls cost 5,000G (one per day, resets 00:00 UTC), others 30,000G.
 * discountUsedToday: whether today's discounted pull was already used.
 */
export function cashPlan(n, { discountUsedToday = false } = {}) {
  if (!Number.isInteger(n) || n < 1) return null;
  const allToday = discountUsedToday ? n * PULL_COST.regular : PULL_COST.firstOfDay + (n - 1) * PULL_COST.regular;
  // Daily plan: one discounted pull per day for n days; starts tomorrow if today's discount is used.
  return { daily: { days: n, startsTomorrow: !!discountUsedToday, gold: n * PULL_COST.firstOfDay }, allToday };
}

export function serialize(s) { return JSON.stringify(s); }

export function deserialize(text) {
  const o = typeof text === 'string' ? JSON.parse(text) : text;
  if (!o || o.v !== 1) throw new Error('unsupported tracker data');
  const s = newStream({ state: o.state, season: o.season, missingBanners: o.missingBanners, missingTitles: o.missingTitles });
  const history = Array.isArray(o.history) ? o.history.filter(h => h && Number.isInteger(h.grade) && Array.isArray(h.stateBefore) && h.stateBefore.length === 4) : [];
  return { ...s, history, streak: Number.isInteger(o.streak) ? o.streak : 0, stopped: o.stopped ?? null };
}

