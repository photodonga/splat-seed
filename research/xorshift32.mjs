/**
 * xorshift32 reference implementation.
 * WARNING: This is NOT a verified Splatoon 3 Shell-Out Machine predictor.
 * The shift parameters are documented for GEAR RNG, not yet verified for Shell-Out.
 */
const MAX = 0xffffffff;
export function asUint32(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX)
    throw new RangeError('Expected an unsigned 32-bit integer');
  return value >>> 0;
}
export function advanceXorShift32(seed) {
  let x = asUint32(seed);
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
function undoLeft(value, shift) {
  let x = value >>> 0;
  for (let n = shift; n < 32; n *= 2) x ^= x << n;
  return x >>> 0;
}
function undoRight(value, shift) {
  let x = value >>> 0;
  for (let n = shift; n < 32; n *= 2) x ^= x >>> n;
  return x >>> 0;
}
export function reverseXorShift32(value) {
  let x = asUint32(value);
  x = undoLeft(x, 5);
  x = undoRight(x, 17);
  x = undoLeft(x, 13);
  return x >>> 0;
}
export function advanceMany(seed, count) {
  let x = asUint32(seed);
  if (!Number.isSafeInteger(count) || count < 0 || count > 10_000_000)
    throw new RangeError('count out of range');
  for (let i = 0; i < count; i++) x = advanceXorShift32(x);
  return x;
}
/**
 * Search against synthetic FULL 32-bit RNG observations.
 * This cannot recover a real capsule seed from colors: the game rules
 * for mapping RNG states to capsules remain to be verified.
 */
export function findSeedsForExactOutputs(outputs, {start = 0, end = 0x100000000, maxResults = 20} = {}) {
  if (!Array.isArray(outputs) || outputs.length < 1 || outputs.length > 64)
    throw new RangeError('Provide 1–64 outputs');
  const expected = outputs.map(asUint32);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || end > 0x100000000 || start >= end)
    throw new RangeError('Invalid search range');
  if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 1000)
    throw new RangeError('Invalid result limit');
  const matches = [];
  for (let seed = start; seed < end; seed++) {
    let current = advanceXorShift32(seed);
    if (current !== expected[0]) continue;
    let valid = true;
    for (let i = 1; i < expected.length; i++) {
      current = advanceXorShift32(current);
      if (current !== expected[i]) { valid = false; break; }
    }
    if (valid) {
      matches.push(seed >>> 0);
      if (matches.length === maxResults) break;
    }
  }
  return matches;
}
