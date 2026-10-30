// Real-game validation: runs every fixtures/real-game/*.json (see fixtures/real-game/README.md).
// Until at least one such fixture passes, the engine is NOT validated against the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initialState, makeContext, OffsetSearch, simulate, GRADES } from '../engine/shellout.mjs';

const dir = new URL('../fixtures/real-game/', import.meta.url);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : [];

if (files.length === 0) {
  test('real-game fixtures', { todo: 'No real-game observation fixtures yet — engine unvalidated against the game' }, () => {});
}

for (const f of files) {
  test(`real-game fixture ${f}`, () => {
    const fx = JSON.parse(fs.readFileSync(new URL(f, dir)));
    const grades = fx.pulls.map(g => (typeof g === 'string' ? GRADES.indexOf(g) : g));
    const k = fx.useForSearch ?? 20;
    assert.ok(grades.length >= k + 10, 'need >= 10 held-out pulls');
    const start = fx.startState ?? initialState(fx.nplnUserId, fx.mode);
    const ctx = makeContext({ season: fx.season, missingBanners: fx.missingBanners, missingTitles: fx.missingTitles });
    const res = new OffsetSearch({ startState: start, observations: grades.slice(0, k).map(grade => ({ grade })), context: ctx, maxOffset: fx.maxOffset ?? 1 << 22 }).runToEnd();
    assert.equal(res.unique, true, `expected unique candidate, got ${res.candidates.length}`);
    const c = res.candidates[0];
    const pred = simulate(c.stateAfter, c.contextAfter, grades.length - k).pulls.map(p => p.grade);
    assert.deepEqual(pred, grades.slice(k), 'held-out real pulls must match predictions');
  });
}
