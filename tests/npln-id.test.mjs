// NPLN user ID handling: real "u-" format, hashed WITH the prefix, cross-checked against
// the public seed tool (initial lottery state) and nxapi's `util splatoon3-seed` export (hash + key).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initialState, NPLN_USER_ID_RE } from '../engine/shellout.mjs';
import { murmur3x86_32 } from '../engine/murmur3.mjs';

const { vectors } = JSON.parse(fs.readFileSync(new URL('../fixtures/npln-id-vectors.json', import.meta.url)));

/** Inverse of nxapi's export: bytes(key) XOR (hash & 0xff) -> ID; hash must match the decoded ID. */
function decodeNxapiKey(keyBase64, hash) {
  const b = Buffer.from(keyBase64, 'base64');
  for (let i = 0; i < b.length; i++) b[i] ^= hash & 0xff;
  const id = b.toString('latin1');
  return murmur3x86_32(id) === hash >>> 0 ? id : null;
}

test('ID vectors cover the real format', () => {
  assert.ok(vectors.length >= 40);
  for (const v of vectors) assert.match(v.id, NPLN_USER_ID_RE);
});

test('hash of the full "u-" ID equals nxapi splatoon3-seed hash', () => {
  for (const v of vectors) assert.equal(murmur3x86_32(v.id), v.nxapiHash, v.id);
});

test('nxapi-format key decodes back to the same ID', () => {
  for (const v of vectors) assert.equal(decodeNxapiKey(v.nxapiKey, v.nxapiHash), v.id);
  assert.equal(decodeNxapiKey(vectors[0].nxapiKey, (vectors[0].nxapiHash ^ 1) >>> 0), null);
});

test('initial lottery states (normal, fest) equal the public seed tool for "u-" IDs', () => {
  for (const v of vectors) {
    assert.deepEqual(initialState(v.id, 'normal'), v.leannyInitial.normal, v.id);
    assert.deepEqual(initialState(v.id, 'fest'), v.leannyInitial.fest, v.id);
  }
});

test('the "u-" prefix is part of the hashed string (stripping it gives a different stream)', () => {
  const v = vectors[2];
  assert.equal(v.id, 'u-abcdefghij0123456789');
  const stripped = [0, 1, 2, 3].map(i => murmur3x86_32(`${v.id.slice(2)}_Lot_${i}`));
  assert.notDeepEqual(stripped, v.leannyInitial.normal);
});

test('only the real ID format is accepted', () => {
  for (const bad of ['abcdefghij0123456789', 'u-abcdefghij012345678', 'u-abcdefghij01234567890', 'U-abcdefghij0123456789',
    'u-ABCDEFGHIJ0123456789', 'u_abcdefghij0123456789', ' u-abcdefghij0123456789', 'u-abcdefghij012345678!', '', null]) {
    assert.throws(() => initialState(bad, 'normal'), RangeError, String(bad));
  }
  assert.doesNotThrow(() => initialState('u-abcdefghij0123456789', 'fest'));
});
