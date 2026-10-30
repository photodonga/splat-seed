/**
 * Real-game fixture evaluation. Designed to FAIL LOUDLY when the engine is wrong.
 *
 * Three different states — never interchangeable:
 *  - initialState               : derived from the NPLN user ID. Only a SEARCH ORIGIN; the current
 *                                  position must be found by OffsetSearch.
 *  - startStateBeforeFirstPull   : the exact state immediately before the first recorded pull.
 *                                  Results are reproduced directly — NO search.
 *  - currentStateAfterLastPull   : optional; the state right after the last recorded pull, compared
 *                                  against the engine's state after reproducing all pulls.
 */
import {
  GRADES, initialState, makeContext, cloneContext, OffsetSearch, reproduce, pullOnce, selectRow, SUBSTITUTE_ROW,
} from '../engine/shellout.mjs';
import { XorShift128, parseStateHex } from '../engine/xorshift128.mjs';

export const MIN_HELD_OUT = 10; // predictions that were never used to locate the position
export const MIN_EVENT_TAIL = 10; // matched pulls required after a jackpot event to verify its draw rule
const DEFAULT_USE_FOR_SEARCH = 20;
const DEFAULT_MAX_OFFSET = 1 << 22;

function fail(msg) { const e = new Error(msg); e.fixtureSchema = true; throw e; }

function parseGrade(g, i) {
  if (typeof g === 'string') { const k = GRADES.indexOf(g); if (k < 0) fail(`pulls[${i}]: unknown color "${g}"`); return { grade: k }; }
  if (Number.isInteger(g) && g >= 0 && g <= 5) return { grade: g };
  if (g && typeof g === 'object') {
    const k = typeof g.grade === 'string' ? GRADES.indexOf(g.grade) : g.grade;
    if (!Number.isInteger(k) || k < 0 || k > 5) fail(`pulls[${i}]: invalid grade`);
    const o = { grade: k };
    if (g.type != null) { o.type = String(g.type); o.subType = String(g.subType ?? 'None'); }
    return o;
  }
  fail(`pulls[${i}]: invalid entry`);
}

/** Strict schema check. Returns a normalized fixture or throws. */
export function parseFixture(raw) {
  if (!raw || typeof raw !== 'object') fail('fixture must be an object');
  if (raw.source !== 'real-game') fail('source must be "real-game" (synthetic data cannot pass the game gate)');
  if (raw.mode !== 'normal' && raw.mode !== 'fest') fail('mode must be "normal" or "fest"');
  if (!Number.isInteger(raw.season) || raw.season < 1) fail('season must be an integer >= 1');
  const own = raw.ownershipBeforeFirstPull;
  if (!own || !Number.isInteger(own.missingBanners) || !Number.isInteger(own.missingTitles)) fail('ownershipBeforeFirstPull.{missingBanners,missingTitles} required');
  const context = makeContext({ season: raw.season, missingBanners: own.missingBanners, missingTitles: own.missingTitles });

  const anchors = ['startStateBeforeFirstPull', 'nplnUserId', 'initialState'].filter(k => raw[k] !== undefined);
  if (anchors.length !== 1) fail(`exactly one of startStateBeforeFirstPull | nplnUserId | initialState is required (got ${anchors.join(', ') || 'none'})`);
  const anchor = anchors[0];

  if (!Array.isArray(raw.pulls) || raw.pulls.length === 0) fail('pulls must be a non-empty array');
  const pulls = raw.pulls.map(parseGrade);

  const fx = { raw, mode: raw.mode, season: raw.season, context, pulls, anchor };
  if (anchor === 'startStateBeforeFirstPull') {
    if (raw.useForSearch !== undefined || raw.maxOffset !== undefined) fail('useForSearch/maxOffset are not allowed with startStateBeforeFirstPull (no search is performed)');
    fx.startStateBeforeFirstPull = parseStateHex(raw.startStateBeforeFirstPull);
  } else {
    fx.searchOrigin = anchor === 'nplnUserId' ? initialState(raw.nplnUserId, raw.mode) : parseStateHex(raw.initialState);
    fx.useForSearch = raw.useForSearch ?? DEFAULT_USE_FOR_SEARCH;
    if (!Number.isInteger(fx.useForSearch) || fx.useForSearch < 1) fail('useForSearch must be >= 1');
    fx.maxOffset = raw.maxOffset ?? DEFAULT_MAX_OFFSET;
  }
  if (raw.currentStateAfterLastPull !== undefined) fx.currentStateAfterLastPull = parseStateHex(raw.currentStateAfterLastPull);
  if (raw.jackpotPullIndices !== undefined) {
    if (!Array.isArray(raw.jackpotPullIndices) || raw.jackpotPullIndices.some(i => !Number.isInteger(i) || i < 0 || i >= pulls.length)) fail('jackpotPullIndices must be valid 0-based pull indices');
    fx.jackpotPullIndices = [...raw.jackpotPullIndices].sort((a, b) => a - b);
  }
  return fx;
}

const sameObs = (r, o) => r.grade === o.grade && (o.type === undefined || (r.row.type === o.type && r.row.subType === o.subType));

/** Simulate pulls [0,n) from a state, applying `alt` instead of the normal rule at index i. */
function simulateAlt(state, ctx, n, i, alt) {
  const rng = XorShift128.fromState(state);
  const c = cloneContext(ctx);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (k !== i) { out.push(pullOnce(rng, c)); continue; }
    const row = selectRow(c.table, rng.nextPercent());
    out.push(alt(rng, c, row));
  }
  return out;
}

function draw(rng, n) { for (let k = 0; k < n; k++) rng.nextU32(); }
function awardAlt(extra) {
  return (rng, c, row) => { draw(rng, extra); if (row.type === 'NamePlateBg') c.missingBanners = Math.max(0, c.missingBanners - 1); else c.missingTitles = Math.max(0, c.missingTitles - 1); return { grade: row.grade, row }; };
}
function substituteAlt(extra) {
  return (rng, c) => { draw(rng, extra); const sub = c.table[SUBSTITUTE_ROW]; return { grade: sub.grade, row: sub }; };
}

/** Does an alternative rule at index i disagree with the observations somewhere in [i, n)? */
function discriminates(state, ctx, obs, i, alt) {
  const seq = simulateAlt(state, ctx, obs.length, i, alt);
  for (let k = i; k < obs.length; k++) if (!sameObs(seq[k], obs[k])) return true;
  return false;
}

/**
 * Evaluate one fixture. Never throws for engine disagreement — returns ok:false with reasons.
 */
export function evaluateFixture(rawOrParsed) {
  const report = { ok: false, errors: [], events: [], offsetsSearched: 0 };
  let fx;
  try { fx = rawOrParsed.pulls && rawOrParsed.context ? rawOrParsed : parseFixture(rawOrParsed); }
  catch (e) { report.errors.push(`schema: ${e.message}`); return report; }
  report.mode = fx.mode;
  report.anchor = fx.anchor;
  const n = fx.pulls.length;

  // 1) Establish the state immediately before the first recorded pull.
  let before;
  if (fx.anchor === 'startStateBeforeFirstPull') {
    before = fx.startStateBeforeFirstPull;
    report.heldOutStart = 0; // nothing was used to fit: every pull is a prediction
  } else {
    if (n - fx.useForSearch < MIN_HELD_OUT) { report.errors.push(`need >= ${MIN_HELD_OUT} pulls after the ${fx.useForSearch} used for search (have ${n - fx.useForSearch})`); return report; }
    const s = new OffsetSearch({ startState: fx.searchOrigin, observations: fx.pulls.slice(0, fx.useForSearch), context: fx.context, maxOffset: fx.maxOffset, maxCandidates: 2 });
    const res = s.runToEnd();
    report.offsetsSearched = res.searched;
    if (res.candidates.length === 0) { report.errors.push(`no position within ${fx.maxOffset} offsets matches the first ${fx.useForSearch} pulls`); return report; }
    if (!res.unique) { report.errors.push(`position not unique (${res.candidates.length}${res.truncated ? '+' : ''} candidates) — add pulls or raise useForSearch`); return report; }
    before = res.candidates[0].stateBefore;
    report.foundOffset = res.candidates[0].offset;
    report.heldOutStart = fx.useForSearch;
  }
  report.heldOutCount = n - report.heldOutStart;
  if (report.heldOutCount < MIN_HELD_OUT) report.errors.push(`need >= ${MIN_HELD_OUT} held-out pulls (have ${report.heldOutCount})`);
  report.stateBeforeFirstPull = before;

  // 2) Predict every pull from that state and compare the held-out part.
  const rep = reproduce(before, fx.context, fx.pulls);
  report.firstMismatch = rep.firstMismatch;
  for (let k = report.heldOutStart; k < n; k++) {
    if (!sameObs(rep.pulls[k], fx.pulls[k])) {
      report.errors.push(`pull ${k}: predicted ${GRADES[rep.pulls[k].grade]} (${rep.pulls[k].row.type}), observed ${GRADES[fx.pulls[k].grade]}`);
      break;
    }
  }
  if (fx.anchor === 'startStateBeforeFirstPull' && rep.firstMismatch >= 0 && !report.errors.length) report.errors.push(`pull ${rep.firstMismatch}: mismatch`);

  // 3) Optional cross-checks.
  if (fx.currentStateAfterLastPull && rep.stateAfterLastPull.join() !== fx.currentStateAfterLastPull.join()) {
    report.errors.push('currentStateAfterLastPull does not equal the engine state after the last pull');
  }
  const awarded = rep.pulls.map((p, k) => (p.row.subType === 'Limited' && !p.substituted ? k : -1)).filter(k => k >= 0);
  if (fx.jackpotPullIndices && fx.jackpotPullIndices.join() !== awarded.join()) {
    report.errors.push(`jackpotPullIndices [${fx.jackpotPullIndices}] != engine jackpot awards [${awarded}]`);
  }

  report.ok = report.errors.length === 0;

  // 4) Jackpot events. Verified only if: fixture passed, event is in the held-out part,
  //    >= MIN_EVENT_TAIL matched pulls follow it, and every competing draw rule contradicts the record.
  rep.pulls.forEach((p, i) => {
    let kind = null, alts = [];
    if (p.row.subType === 'Limited' && !p.substituted) { kind = 'awarded'; alts = [['draws=0', awardAlt(0)], ['draws=1', awardAlt(1)], ['draws=3', awardAlt(3)], ['substituted', substituteAlt(0)]]; }
    else if (p.substituted) { kind = 'substituted'; alts = [['awarded(draws=2)', awardAlt(2)], ['subst draws=1', substituteAlt(1)], ['subst draws=2', substituteAlt(2)]]; }
    if (!kind) return;
    const ev = { kind, index: i, tail: n - 1 - i, inHeldOut: i >= report.heldOutStart, undiscriminated: [] };
    for (const [name, alt] of alts) if (!discriminates(before, fx.context, fx.pulls, i, alt)) ev.undiscriminated.push(name);
    ev.verified = report.ok && ev.inHeldOut && ev.tail >= MIN_EVENT_TAIL && ev.undiscriminated.length === 0;
    report.events.push(ev);
  });
  return report;
}

/** Gate over many fixtures: all must pass AND coverage must be complete. */
export function evaluateGate(fixtures) {
  const results = fixtures.map(({ name, data }) => ({ name, report: evaluateFixture(data) }));
  const passed = results.filter(r => r.report.ok);
  const coverage = {
    normalStreamHeldOut: passed.some(r => r.report.mode === 'normal'),
    festStreamHeldOut: passed.some(r => r.report.mode === 'fest'),
    jackpotAwardedVerified: passed.some(r => r.report.events.some(e => e.kind === 'awarded' && e.verified)),
    jackpotSubstitutionVerified: passed.some(r => r.report.events.some(e => e.kind === 'substituted' && e.verified)),
  };
  const problems = [];
  if (fixtures.length === 0) problems.push('no real-game fixtures');
  for (const r of results) if (!r.report.ok) problems.push(`${r.name}: ${r.report.errors.join('; ')}`);
  for (const [k, v] of Object.entries(coverage)) if (!v) problems.push(`coverage missing: ${k}`);
  return { ok: problems.length === 0, problems, coverage, results };
}
