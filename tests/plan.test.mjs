import test from 'node:test';
import assert from 'node:assert/strict';
import { planPerDay, planAllNow } from '../engine/plan.mjs';

const NOW = new Date('2026-10-31T13:00:00Z'); // 22:00 KST

test('one discounted pull a day', () => {
  const p = planPerDay(105, 1, { now: NOW });
  assert.equal(p.days, 105);
  assert.equal(p.gold, 105 * 5000);
  assert.equal(p.start.toISOString(), '2026-10-31T00:00:00.000Z');
  assert.equal(p.finish.toISOString(), '2027-02-12T00:00:00.000Z');
});

test('several pulls a day: one discounted per day, rest regular', () => {
  const p = planPerDay(105, 6, { now: NOW });
  assert.equal(p.days, 18);
  assert.equal(p.gold, 18 * 5000 + 87 * 30000);
  assert.equal(p.finish.toISOString(), '2026-11-17T00:00:00.000Z');
});

test('discount used today starts tomorrow', () => {
  const p = planPerDay(3, 1, { now: NOW, discountUsedToday: true });
  assert.equal(p.start.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(p.finish.toISOString(), '2026-11-03T00:00:00.000Z');
});

test('all now and invalid input', () => {
  assert.equal(planAllNow(105).gold, 5000 + 104 * 30000);
  assert.equal(planAllNow(2, { discountUsedToday: true }).gold, 60000);
  assert.equal(planPerDay(0, 1), null);
  assert.throws(() => planPerDay(5, 0));
});
