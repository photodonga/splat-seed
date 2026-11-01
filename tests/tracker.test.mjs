import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, makeContext, simulate } from '../engine/shellout.mjs';
import {
  parseStateText, formatState, newStream, predictions, untilGold, untilGrade, findOutcomes, record, undo, setOwnership,
  replaceState, changeSeason, cashPlan, serialize, deserialize,
} from '../engine/tracker.mjs';

const ID = 'u-trackertest000000001';
function setup({ season = 17, mb = 2, mt = 2, skip = 400 } = {}) {
  const ctx = makeContext({ season, missingBanners: mb, missingTitles: mt });
  const h = simulate(initialState(ID, 'normal'), ctx, skip);
  return { state: h.state, season, missingBanners: h.ctx.missingBanners, missingTitles: h.ctx.missingTitles, ctx: h.ctx };
}

test('parseStateText accepts the public tool display format and plain lists', () => {
  const s = [0x3fa1c20e, 0x91b7d4a3, 0x0c5e7712, 0xe2d48b90];
  assert.deepEqual(parseStateText('0x3fa1c20e | 0x91b7d4a3 | 0x0c5e7712 | 0xe2d48b90'), s);
  assert.deepEqual(parseStateText('3fa1c20e, 91b7d4a3\n0c5e7712 e2d48b90'), s);
  assert.equal(formatState(s), '0x3fa1c20e | 0x91b7d4a3 | 0x0c5e7712 | 0xe2d48b90');
  assert.deepEqual(parseStateText(formatState(s)), s);
  for (const bad of ['', '0x1 0x2 0x3', '0x1 0x2 0x3 0x4 0x5', '0x0 0x0 0x0 0x0']) assert.throws(() => parseStateText(bad));
});

test('recording the true sequence: every pull matches and the state follows the engine', () => {
  const st = setup();
  let s = newStream(st);
  const truth = simulate(st.state, st.ctx, 60);
  for (const [i, p] of truth.pulls.entries()) {
    const withItem = i % 2 === 0;
    const r = record(s, withItem ? { grade: p.grade, type: p.row.type, subType: p.row.subType } : { grade: p.grade });
    assert.equal(r.match, true, `pull ${i}`);
    s = r.stream;
  }
  assert.deepEqual(s.state, truth.state);
  assert.equal(s.missingBanners, truth.ctx.missingBanners);
  assert.equal(s.streak, 60);
  assert.equal(s.history.length, 60);
});

test('a wrong color or wrong item stops the stream without moving the state', () => {
  const st = setup();
  const s = newStream(st);
  const p = predictions(s, 1)[0];
  const wrongGrade = (p.grade + 1) % 6;
  const r = record(s, { grade: wrongGrade });
  assert.equal(r.match, false);
  assert.deepEqual(r.stream.state, s.state);
  assert.equal(r.stream.stopped.obs.grade, wrongGrade);
  assert.throws(() => record(r.stream, { grade: p.grade }), /stopped/);
  // undo clears the stop, then the right pull is accepted
  const ok = record(undo(r.stream), { grade: p.grade });
  assert.equal(ok.match, true);
  const r2 = record(s, { grade: p.grade, type: 'Emote', subType: p.row.type === 'Emote' ? 'X' : 'None' });
  assert.equal(r2.match, false);
});

test('undo reverts accepted pulls exactly, including jackpot ownership', () => {
  const st = setup();
  let s = newStream(st);
  const snaps = [s];
  for (const p of predictions(s, 25)) { s = record(s, { grade: p.grade }).stream; snaps.push(s); }
  for (let i = 25; i > 0; i--) { s = undo(s); assert.deepEqual(s.state, snaps[i - 1].state); assert.equal(s.missingBanners, snaps[i - 1].missingBanners); }
  assert.equal(undo(s), s);
});

test('fixing ownership after a mismatch re-checks the pending pull (jackpot owned -> bronze)', () => {
  // find a position where the next pull is a jackpot row: with all owned it is bronze, otherwise gold/silver
  const ctxOwned = makeContext({ season: 17, missingBanners: 0, missingTitles: 0 });
  const run = simulate(initialState(ID, 'normal'), ctxOwned, 60000);
  const j = run.pulls.findIndex(p => p.substituted);
  assert.ok(j > 0);
  const before = simulate(initialState(ID, 'normal'), ctxOwned, j);
  // user wrongly says nothing is owned -> engine predicts a jackpot; the game shows bronze
  const s = newStream({ state: before.state, season: 17, missingBanners: 2, missingTitles: 2 });
  const r = record(s, { grade: 2 });
  assert.equal(r.match, false);
  assert.ok(r.predicted.grade <= 1);
  const fixed = setOwnership(r.stream, 0, 0);
  assert.equal(fixed.resolved, true);
  assert.equal(fixed.stream.history.length, 1);
  assert.equal(fixed.stream.stopped, null);
  // still wrong ownership -> stays stopped
  const still = setOwnership(r.stream, 1, 2);
  assert.equal(still.resolved, false);
  assert.ok(still.stream.stopped);
});

test('untilGold equals the first gold in the prediction list', () => {
  const s = newStream(setup());
  const n = untilGold(s);
  const preds = predictions(s, n);
  assert.equal(preds.at(-1).grade, 0);
  assert.ok(preds.slice(0, -1).every(p => p.grade !== 0));
});

test('replaceState / changeSeason / validation', () => {
  const s = newStream(setup());
  const r = replaceState(s, [1, 2, 3, 4]);
  assert.deepEqual(r.state, [1, 2, 3, 4]); assert.equal(r.streak, 0);
  const c = changeSeason({ ...s, missingBanners: 0, missingTitles: 1 }, 18);
  assert.equal(c.season, 18); assert.equal(c.missingBanners, 2); assert.equal(c.missingTitles, 2);
  assert.throws(() => newStream({ state: [0, 0, 0, 0], season: 17 }));
  assert.throws(() => setOwnership(s, 3, 0));
});

test('cash plan: 5,000G first pull of the day, 30,000G otherwise', () => {
  assert.deepEqual(cashPlan(63), { daily: { days: 63, startsTomorrow: false, gold: 315000 }, allToday: 1865000 });
  assert.deepEqual(cashPlan(1), { daily: { days: 1, startsTomorrow: false, gold: 5000 }, allToday: 5000 });
  assert.deepEqual(cashPlan(3, { discountUsedToday: true }), { daily: { days: 3, startsTomorrow: true, gold: 15000 }, allToday: 90000 });
  assert.equal(cashPlan(0), null);
});

test('serialize / deserialize round trip', () => {
  let s = newStream(setup());
  for (const p of predictions(s, 5)) s = record(s, { grade: p.grade }).stream;
  const back = deserialize(serialize(s));
  assert.deepEqual(back, s);
  assert.throws(() => deserialize('{"v":2}'));
});

test('findOutcomes lists the next positions of a colour or colour+reward target, matching predictions', () => {
  const st = setup();
  const s = newStream(st);
  const p = predictions(s, 300);
  const want = (fn) => p.map((x, i) => fn(x) ? i + 1 : 0).filter(Boolean).slice(0, 3);
  const t = { grade: p[3].grade, type: p[3].row.type, subType: p[3].row.subType };
  assert.deepEqual(findOutcomes(s, t, { limit: 300 }), want(x => x.grade === t.grade && x.row.type === t.type && x.row.subType === t.subType));
  assert.deepEqual(findOutcomes(s, { grade: 1 }, { limit: 300 }), want(x => x.grade === 1));
  assert.equal(findOutcomes(s, { grade: 0 }, { count: 1 })[0] ?? null, untilGrade(s, 0));
  assert.deepEqual(findOutcomes(s, { grade: 3 }, { count: 5, limit: 2 }).every(n => n <= 2), true);
  assert.deepEqual(s.state, st.state); // no mutation
  assert.throws(() => findOutcomes(s, {}));
});
