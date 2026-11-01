/**
 * Marsaglia xorshift128 (a=11, b=8, c=19), 4 x uint32 state.
 * Independent implementation. Mutable, allocation-free stepping for speed.
 */
export class XorShift128 {
  constructor(x, y, z, w) {
    this.x = x >>> 0;
    this.y = y >>> 0;
    this.z = z >>> 0;
    this.w = w >>> 0;
  }

  static fromState(state) {
    if (!Array.isArray(state) || state.length !== 4) throw new RangeError('State must be 4 uint32 words');
    for (const v of state) {
      if (!Number.isInteger(v) || v < 0 || v > 0xffffffff) throw new RangeError('State word out of range');
    }
    if (state.every(v => v === 0)) throw new RangeError('All-zero state is invalid for xorshift');
    return new XorShift128(state[0], state[1], state[2], state[3]);
  }

  nextU32() {
    const t = (this.x ^ (this.x << 11)) >>> 0;
    this.x = this.y;
    this.y = this.z;
    this.z = this.w;
    this.w = (this.w ^ (this.w >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    return this.w;
  }

  /**
   * Float in [0, 100): top 23 bits of the next u32 as a float32 mantissa,
   * i.e. exactly (u >>> 9) / 2^23, scaled by 100 in double precision.
   * NOTE: the game presumably scales in float32; see README "float32 boundary".
   */
  nextPercent() {
    return ((this.nextU32() >>> 9) / 8388608) * 100;
  }

  clone() {
    return new XorShift128(this.x, this.y, this.z, this.w);
  }

  copyFrom(o) {
    this.x = o.x; this.y = o.y; this.z = o.z; this.w = o.w;
    return this;
  }

  state() {
    return [this.x, this.y, this.z, this.w];
  }

  stateHex() {
    return this.state().map(v => '0x' + v.toString(16).padStart(8, '0'));
  }
}

export function parseStateHex(words) {
  if (!Array.isArray(words) || words.length !== 4) throw new RangeError('Need 4 hex words');
  return words.map(w => {
    const s = String(w).trim().replace(/^0x/i, '');
    if (!/^[0-9a-f]{1,8}$/i.test(s)) throw new RangeError(`Invalid hex word: ${w}`);
    return parseInt(s, 16) >>> 0;
  });
}
