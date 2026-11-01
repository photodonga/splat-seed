/**
 * Getting the player's NPLN user ID once, for personal use.
 *
 *  A. From a Leanny Seed Checker backup (or nxapi `util splatoon3-seed --json` output):
 *     the ID is stored as base64(bytes(id) XOR (h & 0xff)) together with h = MurmurHash3(id).
 *     Decoding is local; no network.
 *  B. From a replay code, via the existing public replay-lookup API (used by Leanny).
 *     That API is intended for Leanny's site; here it is used only for the owner's personal lookup.
 *     The ID is also re-derived from the returned replay.id and must agree.
 */
import { murmur3x86_32 } from './murmur3.mjs';
import { NPLN_USER_ID_RE } from './shellout.mjs';

export const REPLAY_LOOKUP_URL = 'https://splatoon3-replay-lookup.fancy.org.uk/api/splatnet3/replay/';

export class NplnIdError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

function base64ToBytes(b64) {
  if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64.trim())) throw new NplnIdError('bad_key', 'key is not base64');
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** key (base64) + h -> NPLN user ID. Throws unless the hash and the ID format both check out. */
export function decodeSeedKey(key, h) {
  const hash = Number(h);
  if (!Number.isInteger(hash) || hash < 0 || hash > 0xffffffff) throw new NplnIdError('bad_key', 'h must be a uint32');
  const bytes = base64ToBytes(key);
  let id = '';
  for (const b of bytes) id += String.fromCharCode(b ^ (hash & 0xff));
  if (!/^[\x20-\x7e]*$/.test(id) || murmur3x86_32(id) !== hash >>> 0) throw new NplnIdError('bad_key', 'key and h do not match');
  if (!NPLN_USER_ID_RE.test(id)) throw new NplnIdError('bad_id', 'decoded value is not an NPLN user ID');
  return id;
}

/**
 * Accepts the text of: a Leanny backup ({ UserData: { UserKey, H } } or top-level { UserKey, H }),
 * or nxapi `util splatoon3-seed --json` output ({ key, h }).
 */
export function idFromSeedExport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new NplnIdError('bad_file', 'not valid JSON'); }
  if (!data || typeof data !== 'object') throw new NplnIdError('bad_file', 'not a JSON object');
  const candidates = [
    data.UserData && [data.UserData.UserKey, data.UserData.H],
    [data.UserKey, data.H],
    [data.key, data.h],
  ].filter(c => c && typeof c[0] === 'string' && c[0] !== '' && c[1] != null);
  if (!candidates.length) throw new NplnIdError('no_key', 'no seed key in this file (UserData.UserKey/H or key/h)');
  return decodeSeedKey(candidates[0][0], candidates[0][1]);
}

export function normalizeReplayCode(code) {
  const c = String(code ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z0-9]{16}$/.test(c)) throw new NplnIdError('invalid_code', 'replay code must be 16 letters/digits');
  return c;
}

/** Re-derive the ID from replay.id (base64 of "Replay-u-…:<CODE>"). */
export function idFromReplayId(replayId, code) {
  let s;
  try { s = atob(String(replayId)); } catch { return null; }
  const m = s.match(/^Replay-(u-[0-9a-z]{20}):([0-9A-Z]{16})$/);
  if (!m || (code && m[2] !== code)) return null;
  return m[1];
}

/**
 * Replay code -> NPLN user ID via the existing lookup API.
 * Errors: invalid_code | network (offline, blocked, or cross-origin refused) | timeout |
 *         not_found | server | bad_response
 */
export async function lookupReplayCode(code, { fetchImpl = globalThis.fetch, timeoutMs = 20000, baseUrl = REPLAY_LOOKUP_URL } = {}) {
  const c = normalizeReplayCode(code);
  let res;
  try {
    res = await fetchImpl(baseUrl + c, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
  } catch (e) {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new NplnIdError('timeout', 'lookup timed out');
    throw new NplnIdError('network', 'request failed (offline, blocked, or cross-origin refused)');
  }
  let body = null;
  try { body = await res.json(); } catch { /* handled below */ }
  if (!res.ok) {
    if (res.status === 404 || body?.error === 'not_found') throw new NplnIdError('not_found', 'replay not found');
    if (res.status === 400 || body?.error === 'invalid_code') throw new NplnIdError('invalid_code', 'server rejected the code');
    throw new NplnIdError('server', `lookup server error ${res.status}${body?.error_message ? `: ${body.error_message}` : ''}`);
  }
  if (!body || typeof body !== 'object') throw new NplnIdError('bad_response', 'response is not JSON');
  const fromField = body.npln_user_id;
  const fromReplay = body.replay ? idFromReplayId(body.replay.id, c) : null;
  if (!NPLN_USER_ID_RE.test(String(fromField ?? ''))) throw new NplnIdError('bad_response', 'response has no valid npln_user_id');
  if (fromReplay !== fromField) throw new NplnIdError('bad_response', 'npln_user_id does not match replay.id');
  const player = body.replay?.historyDetail?.player;
  return { id: fromField, playerName: player ? `${player.name}#${player.nameId}` : null };
}
