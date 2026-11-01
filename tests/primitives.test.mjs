import test from 'node:test';
import assert from 'node:assert/strict';
import { murmur3x86_32 } from '../engine/murmur3.mjs';
import { XorShift128, parseStateHex } from '../engine/xorshift128.mjs';

test('MurmurHash3 x86_32 published vectors', () => {
  const vectors = [
    ['', 0, 0x00000000],
    ['', 1, 0x514e28b7],
    ['hello', 0, 0x248bfa47],
    ['Hello, world!', 1234, 0xfaf6cdb3],
    ['The quick brown fox jumps over the lazy dog', 0, 0x2e4ff723],
    ['abc', 0, 0xb3dd93fa], // 3-byte tail
    ['abcd', 0, 0x43ed676a], // exact block
  ];
  for (const [s, seed, h] of vectors) assert.equal(murmur3x86_32(s, seed), h, `${JSON.stringify(s)} seed ${seed}`);
});

test('MurmurHash3 rejects non-ASCII keys instead of silently diverging', () => {
  assert.throws(() => murmur3x86_32('키'));
});

test('xorshift128 matches Marsaglia (2003) reference sequence', () => {
  const r = new XorShift128(123456789, 362436069, 521288629, 88675123);
  assert.deepEqual([r.nextU32(), r.nextU32(), r.nextU32()], [3701687786, 458299110, 2500872618]);
});

test('nextPercent is (u>>>9)/2^23*100, within [0,100)', () => {
  const a = new XorShift128(1, 2, 3, 4), b = a.clone();
  for (let i = 0; i < 10000; i++) {
    const p = a.nextPercent();
    const u = b.nextU32();
    assert.equal(p, ((u >>> 9) / 8388608) * 100);
    assert.ok(p >= 0 && p < 100);
  }
});

test('state validation and hex parsing', () => {
  assert.throws(() => XorShift128.fromState([0, 0, 0, 0]));
  assert.throws(() => XorShift128.fromState([1, 2, 3]));
  assert.throws(() => XorShift128.fromState([1, 2, 3, 2 ** 32]));
  assert.deepEqual(parseStateHex(['0x1', 'ffffffff', '0X0a', '00000000']), [1, 0xffffffff, 10, 0]);
  assert.throws(() => parseStateHex(['0x1', 'zz', '1', '1']));
  assert.throws(() => parseStateHex(['123456789', '1', '1', '1']));
});
