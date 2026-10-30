import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  GRADES, TABLES, initialState, makeContext, cloneContext, pullOnce, simulate, seasonAt,
  tableForSeason, OffsetSearch, refineCandidates, pullsUntilGold, gradeProbabilities,
} from '../engine/shellout.mjs';
import { XorShift128 } from '../engine/xorshift128.mjs';

const fixtures = JSON.parse(fs.readFileSync(new URL('../fixtures/leanny-parity.json', import.meta.url)));

// deterministic test PRNG (independent of the engine)
function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; }
function randKey(rand) { const a = 'abcdefghijklmnopqrstuvwxyz0123456789'; return Array.from({ length: 20 }, () => a[Math.floor(rand() * 36)]).join(''); }

// ---------- table facts ----------
test('reward tables sum to 100% and grade odds match published odds', () => {
  for (const t of Object.values(TABLES)) assert.equal(t.at(-1).cumulative, 100);
  const pct = t => gradeProbabilities(t).map(p => Math.round(p * 1000) / 10);
  assert.deepEqual(pct(TABLES.v300), [0.1, 0.3, 0.6, 15, 39, 45]);
  assert.deepEqual(pct(TABLES.v110), [0.1, 0.3, 0.6, 13, 39, 47]);
  assert.equal(tableForSeason(2), TABLES.v110);
  assert.equal(tableForSeason(3), TABLES.v300);
});

test('float32 vs double scaling never changes capsule color or RNG consumption (exhaustive 2^23)', () => {
  const f = Math.fround;
  const sameClass = (a, b) => a.grade === b.grade && drawsOf(a) === drawsOf(b);
  const drawsOf = r => (r.subType === 'Limited' ? 2 : (r.type === 'FoodTicket' || r.type === 'GearSkillChip' || r.type === 'DrinkTicket') ? 1 : 0);
  for (const t of Object.values(TABLES)) {
    let c = 0; const cum32 = t.map(r => (c = f(c + f(r.percent))));
    let differing = 0;
    for (let m = 0; m < 8388608; m++) {
      const rd = (m / 8388608) * 100, rf = f(f(m / 8388608) * 100);
      const a = t.findIndex(r => rd < r.cumulative), b = cum32.findIndex(x => rf < x);
      if (a !== b) { differing++; assert.ok(sameClass(t[a], t[b]), `mantissa ${m}`); }
    }
    assert.ok(differing <= 2);
  }
});

test('season numbering matches the public season boundary list', () => {
  const starts = [1661990400000, 1669852800000, 1677628800000, 1685577600000, 1693526400000, 1701388800000,
    1709251200000, 1717200000000, 1725148800000, 1733011200000, 1740787200000, 1748736000000, 1756684800000,
    1764547200000, 1772323200000, 1780272000000, 1788220800000, 1796083200000, 1803859200000];
  starts.forEach((ms, i) => {
    assert.equal(seasonAt(new Date(ms)), i, 'exact start belongs to previous count');
    assert.equal(seasonAt(new Date(ms + 1)), i + 1);
  });
  assert.equal(seasonAt(new Date('2026-10-30T10:00:00Z')), 17);
});

// ---------- parity with the public tool (NOT game truth) ----------
test('parity fixtures: initial states, first 80 grades and state after 3000 pulls', () => {
  assert.ok(fixtures.cases.length >= 50);
  for (const c of fixtures.cases) {
    assert.deepEqual(initialState(c.key, c.mode), c.initialState);
    const ctx = makeContext({ season: c.season, ownershipAware: c.ownershipAware, missingBanners: c.missing ?? undefined, missingTitles: c.missing ?? undefined });
    const run = simulate(c.initialState, ctx, 3000);
    assert.deepEqual(run.pulls.slice(0, 80).map(p => p.grade), c.grades80);
    assert.deepEqual(run.state, c.stateAfter3000);
  }
});

test('normal and fest streams are independent', () => {
  const a = initialState('abcdef0123456789abcd', 'normal');
  const b = initialState('abcdef0123456789abcd', 'fest');
  assert.notDeepEqual(a, b);
  assert.throws(() => initialState('abc', 'normal'));
  assert.throws(() => initialState('abcdef0123', 'gear'));
});

// ---------- jackpot ownership / duplicate handling ----------
function findLimitedOffset(state, ctx, wantType) {
  const rng = XorShift128.fromState(state);
  for (let off = 0; off < 5_000_000; off++) {
    const s = rng.clone(), c = cloneContext(ctx);
    const r = pullOnce(s, c);
    const row = r.substituted ? r.original : r.row;
    if (row.subType === 'Limited' && row.type === wantType) return off;
    rng.nextU32();
  }
  throw new Error('not found');
}
function stateAtOffset(state, off) { const r = XorShift128.fromState(state); for (let i = 0; i < off; i++) r.nextU32(); return r.state(); }

test('gold jackpot: missing item -> gold, 2 extra draws, item becomes owned', () => {
  const st = initialState('k3y00000000000000001', 'normal');
  const ctx = makeContext({ season: 17, missingBanners: 2, missingTitles: 2 });
  const off = findLimitedOffset(st, ctx, 'NamePlateBg');
  const s0 = stateAtOffset(st, off);
  const rng = XorShift128.fromState(s0), c = cloneContext(ctx);
  const r = pullOnce(rng, c);
  assert.equal(r.grade, 0); assert.equal(r.extraDraws, 2); assert.equal(r.substituted, false);
  assert.equal(c.missingBanners, 1); assert.equal(c.missingTitles, 2);
  assert.deepEqual(rng.state(), stateAtOffset(s0, 3));
});

test('gold jackpot already owned -> bronze substitute, no extra draws', () => {
  const st = initialState('k3y00000000000000001', 'normal');
  const owned = makeContext({ season: 17, missingBanners: 0, missingTitles: 0 });
  const off = findLimitedOffset(st, owned, 'NamePlateBg');
  const s0 = stateAtOffset(st, off);
  const rng = XorShift128.fromState(s0);
  const r = pullOnce(rng, cloneContext(owned));
  assert.equal(r.grade, 2); assert.equal(r.substituted, true); assert.equal(r.original.grade, 0);
  assert.equal(r.row.type, 'AllGearSkillChip'); assert.equal(r.extraDraws, 0);
  assert.deepEqual(rng.state(), stateAtOffset(s0, 1));
  // with everything owned, gold never appears
  assert.equal(pullsUntilGold(st, owned, 20000), null);
});

test('second jackpot of the same kind in one season substitutes once both are owned', () => {
  const ctx = makeContext({ season: 5, missingBanners: 1, missingTitles: 1 }); // seasons 1-8: one item per kind
  const st = initialState('dup0000000000000test', 'normal');
  const run = simulate(st, ctx, 40000);
  const golds = run.pulls.filter(p => p.grade === 0);
  const subsFromGold = run.pulls.filter(p => p.substituted && p.original.grade === 0);
  assert.ok(golds.length <= 1, 'only one real gold per season with one banner');
  if (golds.length === 1) {
    const iGold = run.pulls.findIndex(p => p.grade === 0);
    assert.ok(subsFromGold.every(p => run.pulls.indexOf(p) > iGold));
  }
  assert.equal(run.ctx.missingBanners, 1 - golds.length);
});

test('simple (non-ownership) mode always draws 2 for jackpot rows and never substitutes', () => {
  const ctx = makeContext({ season: 17, ownershipAware: false });
  const run = simulate(initialState('simple00000000000000', 'normal'), ctx, 30000);
  assert.ok(run.pulls.every(p => !p.substituted));
  assert.ok(run.pulls.filter(p => p.row.subType === 'Limited').every(p => p.extraDraws === 2));
});

// ---------- recovery round trips (synthetic, normal & fest) ----------
for (const mode of ['normal', 'fest']) {
  test(`round trip (${mode}): colors only recover the true position; held-out pulls predicted`, () => {
    const rand = lcg(mode === 'normal' ? 7 : 11);
    for (let trial = 0; trial < 6; trial++) {
      const key = randKey(rand);
      const ctx = makeContext({ season: 17, missingBanners: 2, missingTitles: 2 });
      const start = initialState(key, mode);
      const history = 200 + Math.floor(rand() * 3000);
      const hist = simulate(start, ctx, history);
      const trueOffset = hist.pulls.reduce((s, p) => s + 1 + p.extraDraws, 0);
      const future = simulate(hist.state, hist.ctx, 30 + 60);
      const observed = future.pulls.slice(0, 30).map(p => ({ grade: p.grade }));
      const heldOut = future.pulls.slice(30).map(p => p.grade);

      // ownership at search time = state before the observed pulls
      const search = new OffsetSearch({ startState: start, observations: observed, context: hist.ctx, maxOffset: 1 << 18 });
      const res = search.runToEnd();
      assert.ok(res.exhaustive);
      assert.ok(res.candidates.some(c => c.offset === trueOffset), 'true offset must be among candidates');
      assert.equal(res.unique, true, `30 colors should be unique in 2^18 (got ${res.candidates.length})`);
      const cand = res.candidates[0];
      assert.equal(cand.offset, trueOffset);
      const pred = simulate(cand.stateAfter, cand.contextAfter, 60).pulls.map(p => p.grade);
      assert.deepEqual(pred, heldOut, 'held-out (unused) pulls must match');
      const after30 = simulate(hist.state, hist.ctx, 30);
      assert.equal(pullsUntilGold(cand.stateAfter, cand.contextAfter), pullsUntilGold(after30.state, after30.ctx));
    }
  });
}

test('few observations -> several candidates, never falsely "unique"; refinement narrows correctly', () => {
  const key = 'refine00000000000000';
  const ctx = makeContext({ season: 17 });
  const start = initialState(key, 'normal');
  const hist = simulate(start, ctx, 1500);
  const trueOffset = hist.pulls.reduce((s, p) => s + 1 + p.extraDraws, 0);
  const fut = simulate(hist.state, hist.ctx, 40).pulls.map(p => ({ grade: p.grade }));
  const res = new OffsetSearch({ startState: start, observations: fut.slice(0, 4), context: hist.ctx, maxOffset: 1 << 16, maxCandidates: 1e6 }).runToEnd();
  assert.ok(res.candidates.length > 1);
  assert.equal(res.unique, false);
  assert.ok(res.candidates.some(c => c.offset === trueOffset));
  let cands = res.candidates;
  for (let i = 4; i < 40 && cands.length > 1; i += 4) {
    cands = refineCandidates(cands, fut.slice(i, i + 4));
    assert.ok(cands.some(c => c.offset === trueOffset));
  }
  assert.equal(cands.length, 1);
});

test('exact reward types narrow faster than colors alone', () => {
  const ctx = makeContext({ season: 17 });
  const start = initialState('typed000000000000000', 'normal');
  const hist = simulate(start, ctx, 800);
  const fut = simulate(hist.state, hist.ctx, 8).pulls;
  const byColor = new OffsetSearch({ startState: start, observations: fut.map(p => ({ grade: p.grade })), context: hist.ctx, maxOffset: 1 << 17, maxCandidates: 1e6 }).runToEnd();
  const byType = new OffsetSearch({ startState: start, observations: fut.map(p => ({ grade: p.grade, type: p.row.type, subType: p.row.subType })), context: hist.ctx, maxOffset: 1 << 17, maxCandidates: 1e6 }).runToEnd();
  assert.ok(byType.candidates.length <= byColor.candidates.length);
  assert.ok(byType.candidates.length >= 1);
});

test('maxCandidates truncation is reported as non-exhaustive', () => {
  const res = new OffsetSearch({ startState: [1, 2, 3, 4], observations: ['blue'], context: makeContext({ season: 17 }), maxOffset: 10000, maxCandidates: 5 }).runToEnd();
  assert.equal(res.truncated, true); assert.equal(res.exhaustive, false); assert.equal(res.unique, false);
});

test('input validation', () => {
  assert.throws(() => makeContext({}));
  assert.throws(() => makeContext({ season: 5, missingBanners: 2 })); // only 1 item per kind before season 9
  assert.throws(() => new OffsetSearch({ startState: [1, 2, 3, 4], observations: [], context: makeContext({ season: 17 }) }));
  assert.throws(() => new OffsetSearch({ startState: [1, 2, 3, 4], observations: [{ grade: 6 }], context: makeContext({ season: 17 }) }));
  assert.equal(GRADES.length, 6);
});
