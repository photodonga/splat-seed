#!/usr/bin/env node
// Game-validation gate. Exit 0 only when every real-game fixture's unseen pulls are predicted
// exactly AND normal/fest streams and both jackpot rules (award, substitution) are verified.
// Usage: node validation/run-game-validation.mjs [fixtures/real-game]
import fs from 'node:fs';
import path from 'node:path';
import { evaluateGate, MIN_HELD_OUT, MIN_EVENT_TAIL } from './game-fixture.mjs';

const dir = path.resolve(process.argv[2] ?? 'fixtures/real-game');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
const fixtures = [];
const loadErrors = [];
for (const f of files) {
  try { fixtures.push({ name: f, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }); }
  catch (e) { loadErrors.push(`${f}: invalid JSON (${e.message})`); }
}

const gate = evaluateGate(fixtures);
const problems = [...loadErrors, ...gate.problems];

console.log(`Game validation gate — ${dir}`);
console.log(`fixtures: ${files.length}  (held-out >= ${MIN_HELD_OUT}, jackpot tail >= ${MIN_EVENT_TAIL})`);
for (const { name, report } of gate.results) {
  const ev = report.events.map(e => `${e.kind}@${e.index}${e.verified ? '✓' : '✗'}`).join(' ') || 'none';
  console.log(`  ${report.ok ? 'PASS' : 'FAIL'} ${name} [${report.mode ?? '?'} / ${report.anchor ?? '?'}] held-out=${report.heldOutCount ?? 0} searched=${report.offsetsSearched} jackpot-events: ${ev}`);
}
console.log('coverage:');
for (const [k, v] of Object.entries(gate.coverage)) console.log(`  ${v ? '✓' : '✗'} ${k}`);
if (problems.length) {
  console.log('\nGATE FAILED — engine is NOT validated against the real game:');
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('\nGATE PASSED');
