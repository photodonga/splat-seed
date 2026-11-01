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
 *
 * Two different claims — never interchangeable:
 *  - prediction check : engine colors equal the recorded colors.
 *  - reward-rule check: a jackpot award / duplicate substitution really happened in the game AND the
 *                       draw rule around it is confirmed by the following pulls.
 *    * Award        : directly observable (the seasonal banner/title is received). The record MUST list
 *                     every award it saw in `observedEvents`; it must equal the engine's awards exactly.
 *    * Substitution : NOT observable on screen (a substituted capsule gives the same bronze reward as a
 *                     normal bronze). It counts only via a PREREGISTERED prediction — a file committed
 *                     before the record, naming the pull indices predicted to be substitutions.
 */
import {
  GRADES, initialState, makeContext, cloneContext, OffsetSearch, reproduce, pullOnce, selectRow, SUBSTITUTE_ROW,
} from '../engine/shellout.mjs';
import { XorShift128, parseStateHex } from '../engine/xorshift128.mjs';

export const MIN_HELD_OUT = 10; // predictions that were never used to locate the position
export const MIN_EVENT_TAIL = 10; // matched pulls required after a jackpot event to verify its draw rule
const DEFAULT_USE_FOR_SEARCH = 20;
const DEFAULT_MAX_OFFSET = 1 << 22;
const PROVENANCE_METHODS = ['video', 'screenshots', 'manual'];
const JACKPOT_TYPES = ['NamePlateBg', 'Byname'];

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

function parseOwnership(own, where) {
  if (!own || !Number.isInteger(own.missingBanners) || !Number.isInteger(own.missingTitles)) fail(`${where}.{missingBanners,missingTitles} required`);
  return own;
}

/** Strict schema check. Returns a normalized fixture or throws. */
export function parseFixture(raw) {
  if (!raw || typeof raw !== 'object') fail('fixture must be an object');
  if (raw.source !== 'real-game') fail('source must be "real-game" (synthetic data cannot pass the game gate)');
  const pv = raw.provenance;
  if (!pv || !PROVENANCE_METHODS.includes(pv.method) || typeof pv.evidence !== 'string' || !pv.evidence.trim() || typeof pv.recordedBy !== 'string' || !pv.recordedBy.trim()) {
    fail(`provenance.{method (${PROVENANCE_METHODS.join('|')}), evidence, recordedBy} required`);
  }
  if (raw.mode !== 'normal' && raw.mode !== 'fest') fail('mode must be "normal" or "fest"');
  if (!Number.isInteger(raw.season) || raw.season < 1) fail('season must be an integer >= 1');
  const own = parseOwnership(raw.ownershipBeforeFirstPull, 'ownershipBeforeFirstPull');
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

  if (raw.jackpotPullIndices !== undefined) fail('jackpotPullIndices was replaced by observedEvents');
  if (!Array.isArray(raw.observedEvents)) fail('observedEvents is required: list every seasonal jackpot item actually received ([] if none)');
  const seen = new Set();
  fx.observedEvents = raw.observedEvents.map((e, k) => {
    if (!e || typeof e !== 'object') fail(`observedEvents[${k}] must be an object`);
    if (e.kind === 'substituted') fail(`observedEvents[${k}]: substitutions cannot be observed on screen; use a preregistration`);
    if (e.kind !== 'awarded') fail(`observedEvents[${k}].kind must be "awarded"`);
    if (!Number.isInteger(e.index) || e.index < 0 || e.index >= pulls.length) fail(`observedEvents[${k}].index out of range`);
    if (!JACKPOT_TYPES.includes(e.rewardType)) fail(`observedEvents[${k}].rewardType must be ${JACKPOT_TYPES.join(' | ')}`);
    if (seen.has(e.index)) fail(`observedEvents: duplicate index ${e.index}`);
    seen.add(e.index);
    return { index: e.index, rewardType: e.rewardType };
  }).sort((a, b) => a.index - b.index);

  if (raw.preregistration !== undefined) {
    if (anchor !== 'startStateBeforeFirstPull') fail('preregistration requires startStateBeforeFirstPull (the prediction must be fixed before any pull)');
    if (typeof raw.preregistration !== 'string' || !/^[\w.-]+\.json$/.test(raw.preregistration)) fail('preregistration must be a file name like "name.json"');
    fx.preregistrationName = raw.preregistration;
  }
  return fx;
}

/** Preregistration: a prediction fixed BEFORE pulling. */
export function parsePreregistration(raw) {
  if (!raw || raw.kind !== 'shellout-preregistration') fail('preregistration.kind must be "shellout-preregistration"');
  if (raw.mode !== 'normal' && raw.mode !== 'fest') fail('preregistration.mode invalid');
  if (!Number.isInteger(raw.season) || raw.season < 1) fail('preregistration.season invalid');
  const own = parseOwnership(raw.ownershipBeforeFirstPull, 'preregistration.ownershipBeforeFirstPull');
  const state = parseStateHex(raw.startStateBeforeFirstPull);
  if (!Array.isArray(raw.predictedSubstitutions) || raw.predictedSubstitutions.length === 0 || raw.predictedSubstitutions.some(i => !Number.isInteger(i) || i < 0)) {
    fail('preregistration.predictedSubstitutions must be a non-empty list of 0-based pull indices');
  }
  if (typeof raw.predictedAt !== 'string' || Number.isNaN(Date.parse(raw.predictedAt))) fail('preregistration.predictedAt must be an ISO date');
  return { mode: raw.mode, season: raw.season, own, state, predictedSubstitutions: [...new Set(raw.predictedSubstitutions)].sort((a, b) => a - b) };
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
 * options.preregistration: { data, committedBefore: boolean, unmodified: boolean, reason?: string }
 *   committedBefore — the preregistration file was committed in a strictly earlier commit than the record
 *   unmodified      — the preregistration file was never changed after that commit
 */
export function evaluateFixture(rawOrParsed, options = {}) {
  const report = { ok: false, errors: [], notes: [], events: [], offsetsSearched: 0 };
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

  // 2) Prediction check: every held-out pull from that state.
  const rep = reproduce(before, fx.context, fx.pulls);
  report.firstMismatch = rep.firstMismatch;
  for (let k = report.heldOutStart; k < n; k++) {
    if (!sameObs(rep.pulls[k], fx.pulls[k])) {
      report.errors.push(`pull ${k}: predicted ${GRADES[rep.pulls[k].grade]} (${rep.pulls[k].row.type}), observed ${GRADES[fx.pulls[k].grade]}`);
      break;
    }
  }
  if (fx.anchor === 'startStateBeforeFirstPull' && rep.firstMismatch >= 0 && !report.errors.length) report.errors.push(`pull ${rep.firstMismatch}: mismatch`);
  if (fx.currentStateAfterLastPull && rep.stateAfterLastPull.join() !== fx.currentStateAfterLastPull.join()) {
    report.errors.push('currentStateAfterLastPull does not equal the engine state after the last pull');
  }

  // 3) Observed awards must equal engine awards exactly (index and reward type).
  const engineAwards = rep.pulls.map((p, k) => (p.row.subType === 'Limited' && !p.substituted ? { index: k, rewardType: p.row.type } : null)).filter(Boolean);
  const fmt = l => l.map(e => `${e.index}:${e.rewardType}`).join(', ') || 'none';
  if (fmt(engineAwards) !== fmt(fx.observedEvents)) {
    report.errors.push(`observed jackpot awards [${fmt(fx.observedEvents)}] != engine awards [${fmt(engineAwards)}]`);
  }

  // 4) Preregistration (substitution evidence).
  let prereg = null;
  if (fx.preregistrationName) {
    const opt = options.preregistration;
    if (!opt || !opt.data) report.errors.push(`preregistration ${fx.preregistrationName} not found`);
    else {
      try {
        prereg = parsePreregistration(opt.data);
        const same = prereg.mode === fx.mode && prereg.season === fx.season &&
          prereg.own.missingBanners === fx.context.missingBanners && prereg.own.missingTitles === fx.context.missingTitles &&
          prereg.state.join() === fx.startStateBeforeFirstPull.join();
        if (!same) { report.errors.push('preregistration does not describe the same stream/state/ownership as the record'); prereg = null; }
      } catch (e) { report.errors.push(`preregistration schema: ${e.message}`); prereg = null; }
      if (prereg) {
        for (const i of prereg.predictedSubstitutions) {
          if (i >= n || !rep.pulls[i].substituted) report.errors.push(`preregistered substitution at pull ${i} did not occur in the record`);
        }
        if (!opt.committedBefore || !opt.unmodified) {
          report.notes.push(`preregistration not accepted as prior evidence: ${opt.reason ?? (!opt.committedBefore ? 'not committed before the record' : 'modified after commit')}`);
          prereg.accepted = false;
        } else prereg.accepted = true;
      }
    }
  }

  report.ok = report.errors.length === 0;

  // 5) Reward-rule events. Common requirements: record passed, event in held-out part,
  //    >= MIN_EVENT_TAIL matched pulls after it, every competing draw rule contradicted by the record.
  //    Award      : additionally listed in observedEvents (guaranteed when ok).
  //    Substitution: additionally preregistered (accepted) at that index.
  rep.pulls.forEach((p, i) => {
    let kind = null, alts = [];
    if (p.row.subType === 'Limited' && !p.substituted) { kind = 'awarded'; alts = [['draws=0', awardAlt(0)], ['draws=1', awardAlt(1)], ['draws=3', awardAlt(3)], ['substituted', substituteAlt(0)]]; }
    else if (p.substituted) { kind = 'substituted'; alts = [['awarded(draws=2)', awardAlt(2)], ['subst draws=1', substituteAlt(1)], ['subst draws=2', substituteAlt(2)]]; }
    if (!kind) return;
    const ev = { kind, index: i, tail: n - 1 - i, inHeldOut: i >= report.heldOutStart, undiscriminated: [] };
    for (const [name, alt] of alts) if (!discriminates(before, fx.context, fx.pulls, i, alt)) ev.undiscriminated.push(name);
    const ruleOk = report.ok && ev.inHeldOut && ev.tail >= MIN_EVENT_TAIL && ev.undiscriminated.length === 0;
    if (kind === 'awarded') {
      ev.observed = fx.observedEvents.some(e => e.index === i);
      ev.verified = ruleOk && ev.observed;
    } else {
      ev.preregistered = !!(prereg && prereg.accepted && prereg.predictedSubstitutions.includes(i));
      ev.verified = ruleOk && ev.preregistered;
    }
    report.events.push(ev);
  });
  return report;
}

/**
 * Gate over many fixtures: all must pass AND coverage must be complete.
 * fixtures: [{ name, data }]; preregistrations: { [fileName]: { data, committedBefore, unmodified, reason } }
 */
export function evaluateGate(fixtures, preregistrations = {}) {
  const results = fixtures.map(({ name, data }) => {
    const pr = data && typeof data.preregistration === 'string' ? preregistrations[data.preregistration] : undefined;
    return { name, report: evaluateFixture(data, { preregistration: pr }) };
  });
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
