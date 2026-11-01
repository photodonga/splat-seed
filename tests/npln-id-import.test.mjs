// ID import paths. Backup decoding uses real reference vectors; the replay lookup tests use a MOCK fetch
// (response shape taken from the public splatoon3-replay-lookup source) — they do not prove the live API works.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  decodeSeedKey, idFromSeedExport, normalizeReplayCode, idFromReplayId, lookupReplayCode, NplnIdError,
} from '../engine/npln-id.mjs';
import { initialState } from '../engine/shellout.mjs';

const { vectors } = JSON.parse(fs.readFileSync(new URL('../fixtures/npln-id-vectors.json', import.meta.url)));
const v = vectors[2]; // u-abcdefghij0123456789

test('A: key + h from nxapi/Leanny decode to the ID for all vectors', () => {
  for (const x of vectors) assert.equal(decodeSeedKey(x.nxapiKey, x.nxapiHash), x.id);
  assert.throws(() => decodeSeedKey(v.nxapiKey, v.nxapiHash ^ 1), e => e.kind === 'bad_key');
  assert.throws(() => decodeSeedKey('not base64!', v.nxapiHash), e => e.kind === 'bad_key');
  assert.throws(() => decodeSeedKey(v.nxapiKey, -1), e => e.kind === 'bad_key');
});

test('A: Leanny backup (UserData), legacy top-level, and nxapi --json are all accepted', () => {
  const leanny = JSON.stringify({ GearDB: {}, UserData: { CloudRandomSet: { Map: {} }, UserKey: v.nxapiKey, H: v.nxapiHash }, Profile: {} });
  const legacy = JSON.stringify({ UserKey: v.nxapiKey, H: v.nxapiHash });
  const nxapi = JSON.stringify({ key: v.nxapiKey, h: v.nxapiHash, timestamp: 1700000000 });
  for (const t of [leanny, legacy, nxapi]) assert.equal(idFromSeedExport(t), v.id);
  // the imported ID feeds the engine directly
  assert.deepEqual(initialState(idFromSeedExport(leanny), 'normal'), v.leannyInitial.normal);
});

test('A: files without a key, empty keys, or broken JSON are rejected', () => {
  assert.throws(() => idFromSeedExport('{'), e => e.kind === 'bad_file');
  assert.throws(() => idFromSeedExport('{"UserData":{"UserKey":"","H":0}}'), e => e.kind === 'no_key');
  assert.throws(() => idFromSeedExport('{"GearDB":{}}'), e => e.kind === 'no_key');
  assert.throws(() => idFromSeedExport(JSON.stringify({ key: v.nxapiKey, h: 123 })), e => e.kind === 'bad_key');
});

test('B: replay code normalization', () => {
  assert.equal(normalizeReplayCode('abcd-1234-efgh-5678'), 'ABCD1234EFGH5678');
  assert.equal(normalizeReplayCode(' ABCD 1234 EFGH 5678 '), 'ABCD1234EFGH5678');
  for (const bad of ['ABCD-1234', 'ABCD1234EFGH567!', '', null]) assert.throws(() => normalizeReplayCode(bad), e => e.kind === 'invalid_code');
});

const CODE = 'ABCD1234EFGH5678';
const replayId = (id, code = CODE) => Buffer.from(`Replay-${id}:${code}`).toString('base64');
const okBody = (over = {}) => ({
  code: CODE, npln_user_id: v.id,
  replay: { id: replayId(v.id), historyDetail: { player: { name: 'Inkling', nameId: '1234' } } }, ...over,
});
const mockFetch = (status, body, seen) => async (url, opts) => {
  if (seen) seen.push({ url, opts });
  return { ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new Error('no json'); return body; } };
};

test('B (mock): success returns the ID and checks it against replay.id', async () => {
  const seen = [];
  const r = await lookupReplayCode('abcd-1234-efgh-5678', { fetchImpl: mockFetch(200, okBody(), seen) });
  assert.deepEqual(r, { id: v.id, playerName: 'Inkling#1234' });
  assert.equal(seen[0].url, 'https://splatoon3-replay-lookup.fancy.org.uk/api/splatnet3/replay/ABCD1234EFGH5678');
  assert.equal(idFromReplayId(replayId(v.id), CODE), v.id);
  assert.equal(idFromReplayId(replayId(v.id, 'ZZZZ1234EFGH5678'), CODE), null);
});

test('B (mock): inconsistent or malformed responses are rejected', async () => {
  const other = vectors[3].id;
  const cases = [
    okBody({ npln_user_id: other }),                           // field disagrees with replay.id
    okBody({ replay: { id: replayId(v.id, 'ZZZZ1234EFGH5678') } }), // replay belongs to another code
    okBody({ npln_user_id: 'abcdefghij0123456789' }),          // not the u- format
    okBody({ replay: null }),
  ];
  for (const b of cases) await assert.rejects(lookupReplayCode(CODE, { fetchImpl: mockFetch(200, b) }), e => e.kind === 'bad_response');
  await assert.rejects(lookupReplayCode(CODE, { fetchImpl: mockFetch(200, undefined) }), e => e.kind === 'bad_response');
});

test('B (mock): error kinds — not found, rejected code, server, network, timeout, local validation', async () => {
  await assert.rejects(lookupReplayCode(CODE, { fetchImpl: mockFetch(404, { error: 'not_found', error_message: 'Replay not found' }) }), e => e.kind === 'not_found');
  await assert.rejects(lookupReplayCode(CODE, { fetchImpl: mockFetch(400, { error: 'invalid_code' }) }), e => e.kind === 'invalid_code');
  await assert.rejects(lookupReplayCode(CODE, { fetchImpl: mockFetch(500, { error: 'unknown_error', error_message: 'x' }) }), e => e.kind === 'server' && /500/.test(e.message));
  await assert.rejects(lookupReplayCode(CODE, { fetchImpl: mockFetch(502, undefined) }), e => e.kind === 'server');
  await assert.rejects(lookupReplayCode(CODE, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), e => e.kind === 'network');
  const keepAlive = setTimeout(() => {}, 5000); // AbortSignal.timeout's timer is unref'd in Node
  await assert.rejects(lookupReplayCode(CODE, { fetchImpl: (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(o.signal.reason))), timeoutMs: 20 }), e => e.kind === 'timeout');
  clearTimeout(keepAlive);
  let called = false;
  await assert.rejects(lookupReplayCode('ABCD', { fetchImpl: async () => { called = true; } }), e => e instanceof NplnIdError && e.kind === 'invalid_code');
  assert.equal(called, false, 'invalid codes never reach the network');
});
