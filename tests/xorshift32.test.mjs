import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceXorShift32, reverseXorShift32, advanceMany, findSeedsForExactOutputs } from '../research/xorshift32.mjs';

test('published xorshift32 reference vector', () => {
  assert.equal(advanceXorShift32(1), 270369);
  assert.equal(advanceXorShift32(0), 0);
});
test('exact forward/reverse round trips including edge cases', () => {
  for (const value of [0, 1, 2, 123456789, 0x12345678, 0x7fffffff, 0x80000000, 0xffffffff]) {
    assert.equal(reverseXorShift32(advanceXorShift32(value)), value);
    assert.equal(advanceXorShift32(reverseXorShift32(value)), value);
  }
  let sample = 0xa36b91a7;
  for (let i = 0; i < 50000; i++) {
    sample = advanceXorShift32(sample);
    assert.equal(advanceXorShift32(reverseXorShift32(sample)), sample);
  }
});
test('synthetic 32-bit output fixture can be recovered in bounded range', () => {
  const seed = 54321;
  const expected = [advanceMany(seed, 1), advanceMany(seed, 2), advanceMany(seed, 3)];
  assert.deepEqual(findSeedsForExactOutputs(expected, {start: 0, end: 75000}), [seed]);
  assert.deepEqual(findSeedsForExactOutputs(expected, {start: 60000, end: 75000}), []);
});
test('invalid input is rejected instead of silently truncated', () => {
  for (const value of [-1, 2**32, 1.5, Infinity, NaN, '0x01']) assert.throws(() => advanceXorShift32(value));
  assert.throws(() => findSeedsForExactOutputs([]));
  assert.throws(() => advanceMany(1, -1));
});
