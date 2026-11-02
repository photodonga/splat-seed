import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { newSession, serializeSession, deserializeSession } from '../engine/candidates.mjs';
import { newStream, predictions, record, serialize, deserialize } from '../engine/tracker.mjs';

const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const standalone = readFileSync(new URL('../dist/app-standalone.html', import.meta.url), 'utf8');
const checkpointSource = html.match(/\/\* PORTABLE_BACKUP:[\s\S]*?\nload\(\);/)?.[0];
if (!checkpointSource) throw new Error('Checkpoint functions not found');
const vmSource = checkpointSource.replace(/\nload\(\);$/, '') + '\n({checkpoint,parsePortableBackup})';

function setup() {
  const ses = mode => newSession({ mode, season: 17, maxOffset: 2048, maxCandidates: 500 });
  const initial = newStream({ state: [1, 2, 3, 4], season: 17, missingBanners: 2, missingTitles: 2 });
  const p = predictions(initial, 1)[0];
  const progressed = record(initial, { grade: p.grade, type: p.row.type, subType: p.row.subType });
  assert.equal(progressed.match, true);
  const app = {
    mode: 'normal', keepId: true, id: 'u-' + 'a'.repeat(20), perDay: 5,
    target: { grade: 0 }, setupDone: true,
    m: { normal: { phase: 'track', cand: ses('normal'), stream: progressed.stream },
         fest: { phase: 'locate', cand: ses('fest'), stream: null } },
  };
  const helpers = vm.runInNewContext(vmSource, { app, serializeSession, serialize, deserializeSession, deserialize,
    NPLN_USER_ID_RE: /^u-[0-9a-z]{20}$/, localStorage: { setItem() {} }, KEY: 'test' });
  return { app, ...helpers };
}

test('backups resume at the next unconsumed RNG state, with separate modes', () => {
  const { app, checkpoint, parsePortableBackup } = setup();
  const file = JSON.stringify({ format:'splat-seed-checkpoint', version:1, data:checkpoint(false) });
  const restored = parsePortableBackup(file);
  assert.equal(restored.modes.normal.phase, 'track');
  assert.deepEqual([...restored.modes.normal.stream.state], [...app.m.normal.stream.state]);
  assert.equal(restored.modes.normal.stream.history.length, 1);
  assert.equal(restored.modes.fest.phase, 'locate');
  assert.equal(restored.id, null);
  assert.equal(restored.keepId, false);
  assert.equal(predictions(restored.modes.normal.stream,1)[0].grade,
    predictions(app.m.normal.stream,1)[0].grade);
});
test('NPLN ID is exported only after explicit opt-in, never via the implicit checkpoint', () => {
  const {checkpoint,parsePortableBackup} = setup();
  const noId = checkpoint(false);
  assert.equal(Object.hasOwn(noId, 'id'), false);
  assert.equal(noId.keepId, false);
  const withId = checkpoint(true);
  assert.equal(withId.id, 'u-'+'a'.repeat(20));
  const restored = parsePortableBackup(JSON.stringify({format:'splat-seed-checkpoint',version:1,data:withId}));
  assert.equal(restored.keepId, true);
  assert.equal(restored.id, withId.id);
});
test('wrong file, corrupted record or missing tracking position is rejected', () => {
  const {checkpoint,parsePortableBackup} = setup();
  assert.throws(() => parsePortableBackup('{}'));
  assert.throws(() => parsePortableBackup('not-json'));
  const invalid = checkpoint(false);
  invalid.modes.normal.stream = null;
  assert.throws(() => parsePortableBackup(JSON.stringify({format:'splat-seed-checkpoint',version:1,data:invalid})));
  invalid.modes.normal.stream = {v:1,state:[0,0,0,0],season:17,missingBanners:2,missingTitles:2};
  assert.throws(() => parsePortableBackup(JSON.stringify({format:'splat-seed-checkpoint',version:1,data:invalid})));
});
test('mobile and desktop have same visible import/export controls and safe restore flow', () => {
  assert.equal(html, index, 'GitHub Pages root should match modular app');
  for (const [name, source] of [['modular', html], ['standalone', standalone]]) {
    assert.match(source, /id="backupExport"/, name);
    assert.match(source, /id="backupImport"/, name);
    assert.match(source, /id="backupInput"/, name);
    assert.match(source, /id="backupWithId"/, name);
    assert.match(source, /navigator\.canShare/);
    assert.match(source, /URL\.createObjectURL/);
    assert.match(source, /parsePortableBackup\(await file\.text\(\)\)/);
    assert.match(source, /if \(!confirm\(/);
    assert.match(source, /cancelSearch\(true\);\s*app\.m = restored\.modes/);
  }
});
