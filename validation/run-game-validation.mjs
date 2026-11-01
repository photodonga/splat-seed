#!/usr/bin/env node
// Game-validation gate. Exit 0 only when every real-game record's unseen pulls are predicted exactly,
// normal and fest streams are covered, an OBSERVED jackpot award is verified, and a PREREGISTERED
// duplicate substitution is verified.
// Usage: node validation/run-game-validation.mjs [fixtures/real-game]
// Preregistrations live in <dir>/preregistrations/*.json; their commit order is read from git history
// (CI must check out full history).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluateGate, MIN_HELD_OUT, MIN_EVENT_TAIL } from './game-fixture.mjs';

const dir = path.resolve(process.argv[2] ?? 'fixtures/real-game');
const preregDir = path.join(dir, 'preregistrations');

function git(args) {
  try { return { ok: true, out: execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }; }
  catch (e) { return { ok: false, status: e.status, out: String(e.stdout ?? '').trim() }; }
}
function commitsTouching(file) {
  const r = git(['log', '--format=%H', '--', file]);
  return r.ok && r.out ? r.out.split('\n') : [];
}
function dirty(file) {
  const r = git(['status', '--porcelain', '--', file]);
  return !r.ok || r.out !== '';
}

/** Was `prereg` committed in a strictly earlier commit than `record`, and never changed afterwards? */
function preregistrationOrder(preregFile, recordFile) {
  if (!git(['rev-parse', '--is-inside-work-tree']).ok) return { committedBefore: false, unmodified: false, reason: 'not a git work tree' };
  if (git(['rev-parse', '--is-shallow-repository']).out === 'true') return { committedBefore: false, unmodified: false, reason: 'shallow clone: full history required' };
  const pc = commitsTouching(preregFile), rc = commitsTouching(recordFile);
  if (!pc.length || dirty(preregFile)) return { committedBefore: false, unmodified: false, reason: 'preregistration not committed (or has uncommitted changes)' };
  if (!rc.length) return { committedBefore: false, unmodified: pc.length === 1, reason: 'record not committed yet; order unknown' };
  const pAdd = pc.at(-1), rAdd = rc.at(-1);
  const unmodified = pc.length === 1;
  const committedBefore = pAdd !== rAdd && git(['merge-base', '--is-ancestor', pAdd, rAdd]).ok;
  return { committedBefore, unmodified, reason: !committedBefore ? 'preregistration was not committed strictly before the record' : !unmodified ? 'preregistration was modified after its first commit' : undefined };
}

const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
const fixtures = [];
const loadErrors = [];
for (const f of files) {
  try { fixtures.push({ name: f, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }); }
  catch (e) { loadErrors.push(`${f}: invalid JSON (${e.message})`); }
}

const preregistrations = {};
for (const { name, data } of fixtures) {
  const pr = data && data.preregistration;
  if (typeof pr !== 'string' || !/^[\w.-]+\.json$/.test(pr)) continue;
  const p = path.join(preregDir, pr);
  if (!fs.existsSync(p)) continue;
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { loadErrors.push(`preregistrations/${pr}: invalid JSON`); continue; }
  preregistrations[pr] = { data: parsed, ...preregistrationOrder(p, path.join(dir, name)) };
}

const gate = evaluateGate(fixtures, preregistrations);
const problems = [...loadErrors, ...gate.problems];

console.log(`Game validation gate — ${dir}`);
console.log(`records: ${files.length}  (held-out >= ${MIN_HELD_OUT}, jackpot tail >= ${MIN_EVENT_TAIL})`);
for (const { name, report } of gate.results) {
  const ev = report.events.map(e => `${e.kind}@${e.index}${e.verified ? '✓' : '✗'}`).join(' ') || 'none';
  console.log(`  ${report.ok ? 'PASS' : 'FAIL'} ${name} [${report.mode ?? '?'} / ${report.anchor ?? '?'}] held-out=${report.heldOutCount ?? 0} searched=${report.offsetsSearched} jackpot-events: ${ev}`);
  for (const note of report.notes ?? []) console.log(`       note: ${note}`);
}
console.log('coverage:');
for (const [k, v] of Object.entries(gate.coverage)) console.log(`  ${v ? '✓' : '✗'} ${k}`);
if (problems.length) {
  console.log('\nGATE FAILED — engine is NOT validated against the real game:');
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('\nGATE PASSED');
