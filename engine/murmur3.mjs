/**
 * MurmurHash3 x86_32 (Austin Appleby, public domain algorithm), seed 0 by default.
 * Independent implementation operating on bytes.
 *
 * The Shell-Out key strings are ASCII, so UTF-8 bytes == char codes here.
 * Non-ASCII input is rejected to avoid silently diverging from other
 * implementations that hash `charCodeAt(i) & 0xff`.
 */
const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;

function rotl32(x, r) {
  return ((x << r) | (x >>> (32 - r))) >>> 0;
}

function fmix32(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function asciiBytes(str) {
  if (typeof str !== 'string') throw new TypeError('Expected a string');
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c > 0x7f) throw new RangeError('Only ASCII keys are supported');
    out[i] = c;
  }
  return out;
}

export function murmur3x86_32(input, seed = 0) {
  const data = typeof input === 'string' ? asciiBytes(input) : input;
  if (!(data instanceof Uint8Array)) throw new TypeError('Expected string or Uint8Array');
  const len = data.length;
  const nblocks = len >>> 2;
  let h = seed >>> 0;

  for (let i = 0; i < nblocks; i++) {
    const o = i * 4;
    let k = (data[o] | (data[o + 1] << 8) | (data[o + 2] << 16) | (data[o + 3] << 24)) >>> 0;
    k = Math.imul(k, C1);
    k = rotl32(k, 15);
    k = Math.imul(k, C2);
    h ^= k;
    h = rotl32(h, 13);
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }

  const tail = nblocks * 4;
  let k1 = 0;
  switch (len & 3) {
    case 3: k1 ^= data[tail + 2] << 16; // falls through
    case 2: k1 ^= data[tail + 1] << 8; // falls through
    case 1:
      k1 ^= data[tail];
      k1 = Math.imul(k1, C1);
      k1 = rotl32(k1, 15);
      k1 = Math.imul(k1, C2);
      h ^= k1;
  }

  h ^= len;
  return fmix32(h >>> 0);
}
