import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newSession, runSearch, addPull, removeLastPull, changeConditions, status, forecast, consensusFirst,
  withSearchResult, isComplete, serializeSession, deserializeSession, itemsForGrade, searchParams,
} from '../engine/candidates.mjs';
import { initialState, makeContext, simulate, OffsetSearch } from '../engine/shellout.mjs';
import { XorShift128 } from '../engine/xorshift128.mjs';

const ID = 'u-abcdefghij0123456789';
const SEASON = 17;

/** Ground truth: the real pulls starting `offset` draws after the initial state. */
function truth(mode, offset, n) {
  const rng = XorShift128.fromState(initialState(ID, mode));
  for (let i = 0; i < offset; i++) rng.nextU32();
  const pulls = simulate(rng.state(), makeContext({ season: SEASON }), n).pulls;
  return pulls.map(p => ({ grade: p.grade, type: p.row.type, subType: p.row.subType }));
}
const colorOnly = o => ({ grade: o.grade });

function session(extra = {}) {
  return newSession({ mode: 'fest', season: SEASON, maxOffset: 1 << 14, maxCandidates: 100000, ...extra });
}

test('candidates shrink pull by pull and the true offset survives (color only)', () => {
  const OFF = 1234;
  const real = truth('fest', OFF, 40).map(colorOnly);
  let s = session();
  let r = null;
  const counts = [];
  ({ session: s } = addPull(s, r, real[0]));
  r = runSearch(s, ID);
  s = withSearchResult(s, r);
  counts.push(r.candidates.length);
  let i = 1;
  while (r.candidates.length > 1 && i < real.length) {
    const out = addPull(s, r, real[i++]);
    assert.equal(out.needsSearch, false, 'complete result must be refined, not re-searched');
    s = out.session; r = out.result;
    counts.push(r.candidates.length);
  }
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].offset, OFF);
  for (let k = 1; k < counts.length; k++) assert.ok(counts[k] <= counts[k - 1], 'count never grows');
  assert.equal(s.timeline.length, counts.length);
  assert.deepEqual(s.timeline.map(e => e.count), counts);
  assert.equal(status(s, r).kind, 'unique');
});

test('refine after a complete search equals a fresh full search with all pulls', () => {
  const real = truth('fest', 777, 6);
  let s = session();
  ({ session: s } = addPull(s, null, real[0]));
  let r = runSearch(s, ID);
  for (const o of real.slice(1, 4)) ({ session: s, result: r } = addPull(s, r, o));
  const fresh = runSearch(s, ID);
  assert.deepEqual(r.candidates.map(c => c.offset), fresh.candidates.map(c => c.offset));
  assert.deepEqual(r.candidates.map(c => c.stateAfter), fresh.candidates.map(c => c.stateAfter));
});

test('capped search is reported as "at least" and the next pull forces a re-search', () => {
  let s = newSession({ mode: 'fest', season: SEASON, maxOffset: 1 << 16, maxCandidates: 10 });
  const real = truth('fest', 50, 3).map(colorOnly);
  ({ session: s } = addPull(s, null, real[0]));
  const r = runSearch(s, ID);
  assert.equal(r.truncated, true);
  const st = status(s, r);
  assert.equal(st.kind, 'capped');
  assert.equal(st.atLeast, true);
  assert.equal(isComplete(r), false);
  const out = addPull(s, r, real[1]);
  assert.equal(out.needsSearch, true);
  assert.equal(out.result, null);
});

test('zero candidates when a pull contradicts every position (mismatch)', () => {
  const real = truth('fest', 300, 3);
  let s = session();
  ({ session: s } = addPull(s, null, real[0]));
  let r = runSearch(s, ID);
  for (const o of real.slice(1)) ({ session: s, result: r } = addPull(s, r, o));
  assert.ok(r.candidates.length >= 1);
  const fc = forecast(r, 1);
  const predictedGrades = new Set(fc.steps[0].colors.map(c => c.grade));
  const impossible = [0, 1, 2, 3, 4, 5].find(g => !predictedGrades.has(g));
  ({ session: s, result: r } = addPull(s, r, { grade: impossible }));
  assert.equal(r.candidates.length, 0);
  assert.equal(status(s, r).kind, 'none');
});

test('forecast: shares are candidate counts, consensus detection, length 10', () => {
  const real = truth('fest', 999, 30).map(colorOnly);
  let s = session();
  ({ session: s } = addPull(s, null, real[0]));
  let r = runSearch(s, ID);
  ({ session: s, result: r } = addPull(s, r, real[1]));
  const fc = forecast(r);
  assert.equal(fc.steps.length, 10);
  for (const step of fc.steps) {
    const sum = step.groups.reduce((a, g) => a + g.count, 0);
    assert.equal(sum, r.candidates.length);
    assert.equal(step.consensus, step.groups.length === 1);
  }
  assert.equal(consensusFirst(fc) === null, !fc.steps[0].consensus);
  // narrow to one candidate -> every step is consensus and matches the truth
  let i = 2;
  while (r.candidates.length > 1) ({ session: s, result: r } = addPull(s, r, real[i++]));
  const one = forecast(r);
  assert.ok(one.steps.every(x => x.consensus));
  const exact = truth('fest', 999, i + 10);
  for (let k = 0; k < 10; k++) {
    assert.equal(one.steps[k].groups[0].grade, exact[i + k].grade);
    assert.equal(one.steps[k].groups[0].type, exact[i + k].type);
  }
});

test('clicking a consensus first card keeps the same candidates and advances them', () => {
  const real = truth('fest', 4321, 40).map(colorOnly);
  let s = session();
  ({ session: s } = addPull(s, null, real[0]));
  let r = runSearch(s, ID);
  let i = 1;
  while (r.candidates.length > 1) ({ session: s, result: r } = addPull(s, r, real[i++]));
  const fc = forecast(r);
  const obs = consensusFirst(fc);
  assert.ok(obs);
  const before = r.candidates[0].offset;
  ({ session: s, result: r } = addPull(s, r, obs));
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].offset, before);
  const fc2 = forecast(r);
  assert.deepEqual(fc2.steps.slice(0, 9).map(x => x.groups[0]), fc.steps.slice(1).map(x => x.groups[0]));
});

test('undo: removing the last pull and re-searching restores the earlier candidate set', () => {
  const real = truth('fest', 600, 5).map(colorOnly);
  let s = session();
  ({ session: s } = addPull(s, null, real[0]));
  let r = runSearch(s, ID);
  s = withSearchResult(s, r);
  ({ session: s, result: r } = addPull(s, r, real[1]));
  const two = r.candidates.map(c => c.offset);
  ({ session: s, result: r } = addPull(s, r, real[2]));
  s = removeLastPull(s);
  assert.equal(s.observations.length, 2);
  assert.equal(s.timeline.length, 2);
  const again = runSearch(s, ID);
  assert.deepEqual(again.candidates.map(c => c.offset), two);
});

test('changing the range starts a new epoch and results are recorded as re-search', () => {
  const real = truth('fest', 200, 3).map(colorOnly);
  let s = session();
  ({ session: s } = addPull(s, null, real[0]));
  let r = runSearch(s, ID);
  s = withSearchResult(s, r);
  const s2 = changeConditions(s, { maxOffset: 1 << 12 });
  assert.equal(s2.epoch, s.epoch + 1);
  const r2 = runSearch(s2, ID);
  const s3 = withSearchResult(s2, r2, 'research');
  const last = s3.timeline.at(-1);
  assert.equal(last.kind, 'research');
  assert.equal(last.epoch, s2.epoch);
  assert.equal(last.maxOffset, 1 << 12);
  assert.ok(r2.candidates.length <= r.candidates.length);
  assert.throws(() => changeConditions(s, { maxOffset: 0 }));
  assert.throws(() => changeConditions(s, { missingBanners: 3 }));
});

test('normal and fest streams are independent', () => {
  const realFest = truth('fest', 900, 30).map(colorOnly);
  let s = session({ mode: 'normal' });
  ({ session: s } = addPull(s, null, realFest[0]));
  let r = runSearch(s, ID);
  let i = 1;
  while (r.candidates.length > 0 && i < 30) ({ session: s, result: r } = addPull(s, r, realFest[i++]));
  // the fest truth offset must not be found in the normal stream
  assert.ok(!r.candidates.some(c => c.offset === 900) || r.candidates.length > 1);
  assert.notDeepEqual(initialState(ID, 'normal'), initialState(ID, 'fest'));
});

test('cancelled (partial) search is not treated as complete', () => {
  const s0 = session({ maxOffset: 1 << 16 });
  const { session: s } = addPull(s0, null, { grade: 5 });
  const search = new OffsetSearch({ startState: initialState(ID, 'fest'), observations: s.observations, context: makeContext({ season: SEASON }), maxOffset: s.maxOffset, maxCandidates: 100000 });
  search.step(1000);
  const partial = search.result();
  assert.equal(partial.exhaustive, false);
  assert.equal(status(s, partial).kind, 'cancelled');
  assert.equal(status(s, partial, { searching: true, progress: 0.1 }).kind, 'searching');
  assert.equal(addPull(s, partial, { grade: 5 }).needsSearch, true);
});

test('serialize keeps pulls/conditions only (no ID, no states) and round-trips', () => {
  let s = session();
  ({ session: s } = addPull(s, null, { grade: 4, type: 'FoodTicket', subType: 'Food100' }));
  const r = runSearch(s, ID);
  s = withSearchResult(s, r);
  const text = JSON.stringify(serializeSession(s));
  assert.ok(!text.includes(ID));
  assert.ok(!text.includes('stateAfter') && !text.includes('stateBefore'));
  const back = deserializeSession(JSON.parse(text));
  assert.deepEqual(back.observations, s.observations);
  assert.equal(back.maxOffset, s.maxOffset);
  assert.equal(back.mode, 'fest');
  assert.throws(() => deserializeSession({ v: 9 }));
});

test('status kinds: idle, searching; params require a pull; picker items', () => {
  const s = session();
  assert.equal(status(s, null).kind, 'idle');
  assert.throws(() => searchParams(s, ID));
  const purple = itemsForGrade(SEASON, 4).map(x => x.type);
  assert.deepEqual(purple.sort(), ['Byname', 'FoodTicket', 'GearSkillChip']);
});

test('re-running the same search (reload/retry) does not add a duplicate timeline step', () => {
  let s = session();
  ({ session: s } = addPull(s, null, { grade: 5 }));
  const r = runSearch(s, ID);
  s = withSearchResult(s, r);
  s = withSearchResult(s, runSearch(s, ID));
  assert.equal(s.timeline.length, 1);
});

test('date-based range follows the public tool heuristic; pull estimate is offset / draws per pull', async () => {
  const { rangeForDate, drawsPerPull, estimatePulls } = await import('../engine/candidates.mjs');
  const d = new Date(2026, 9, 31, 23, 0);
  const days = Math.floor((d - new Date(2022, 8, 1)) / 86400000);
  assert.equal(rangeForDate(d), days * 33 + 20);
  const dpp = drawsPerPull(17);
  assert.ok(dpp > 1.4 && dpp < 1.5, `draws per pull ${dpp}`);
  assert.equal(estimatePulls(0, 17), 0);
  assert.equal(estimatePulls(Math.round(dpp * 600), 17), 600);
});
