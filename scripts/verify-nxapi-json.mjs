#!/usr/bin/env node
/**
 * SPLAT SEED local-only result verifier. Does not print, upload or persist
 * NPLN IDs, nxapi key/h pairs, session tokens, or their raw JSON content.
 */
import fs from 'node:fs';

function murmur3x86_32(bytes) {
  let hash = 0;
  let offset = 0;
  const total = bytes.length;
  while (offset + 4 <= total) {
    let k = bytes.readUInt32LE(offset);
    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);
    hash ^= k;
    hash = (hash << 13) | (hash >>> 19);
    hash = (Math.imul(hash, 5) + 0xe6546b64) | 0;
    offset += 4;
  }
  let tail = 0;
  const remaining = total - offset;
  if (remaining === 3) tail ^= bytes[offset + 2] << 16;
  if (remaining >= 2) tail ^= bytes[offset + 1] << 8;
  if (remaining >= 1) {
    tail ^= bytes[offset];
    tail = Math.imul(tail, 0xcc9e2d51);
    tail = (tail << 15) | (tail >>> 17);
    tail = Math.imul(tail, 0x1b873593);
    hash ^= tail;
  }
  hash ^= total;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function readVerified(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0 || stat.size > 50_000) throw Error('invalid file');
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!result || typeof result.key !== 'string' ||
      !Number.isInteger(result.h) || result.h < 0 || result.h > 0xffffffff) {
    throw Error('invalid shape');
  }
  const encoded = Buffer.from(result.key, 'base64');
  if (encoded.length !== 22 || encoded.toString('base64') !== result.key) {
    throw Error('invalid key');
  }
  const original = Buffer.from(encoded);
  for (let i = 0; i < original.length; i++) original[i] ^= result.h & 0xff;
  const id = original.toString('ascii');
  if (!/^u-[0-9a-z]{20}$/.test(id) || murmur3x86_32(Buffer.from(id, 'utf8')) !== result.h) {
    throw Error('invalid ID/hash pair');
  }
  return {key: result.key, h: result.h};
}

const [operation, ...files] = process.argv.slice(2);
try {
  if (operation === 'validate' && files.length === 1) {
    readVerified(files[0]);
    console.log('형식 검증 성공');
  } else if (operation === 'compare' && files.length === 2) {
    const a = readVerified(files[0]);
    const b = readVerified(files[1]);
    console.log(a.key === b.key && a.h === b.h ? '같음' : '다름');
  } else {
    throw Error('invalid usage');
  }
} catch {
  console.error('비교 불가: 결과 파일이 비었거나 유효한 key/h 쌍이 아닙니다');
  process.exitCode = 1;
}
