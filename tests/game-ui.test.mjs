import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const STANDALONE = readFileSync(new URL('../dist/app-standalone.html', import.meta.url), 'utf8');
const colorNames = ['Gold','Silver','Bronze','Red','Purple','Blue'];

function gameCSS(html) {
  return html.split('/* SPLAT_GAME_ART_V1')[1]?.split('</style>')[0];
}

for (const [name, html] of [['modular', SOURCE], ['standalone', STANDALONE]]) {
  test(name + ': all normal and Splatfest colors use explicit matching artwork', () => {
    assert.ok(gameCSS(html), 'game UI stylesheet not present');
    for (const color of colorNames) {
      const regular = 'S3_Shell-Out_' + color + '_Capsule.png';
      const fest = 'S3_Shell-Out_' + color + '_Capsule_Splatfest.png';
      assert.ok(html.includes(regular), 'missing normal ' + color);
      assert.ok(html.includes(fest), 'missing Splatfest ' + color);
    }
    assert.equal((gameCSS(html).match(/cdn.wikimg.net/g) || []).length, 12);
  });
  test(name + ': style follows active mode and keeps fallback capsule', () => {
    assert.match(html, /document\.body\.dataset\.splatMode = app\.mode/);
    assert.match(html, /data-splat-mode="normal"/);
    assert.match(html, /var\(--art,none\)/);
    assert.match(html, /\$\('mFest'\)\.onclick = \(\) => switchMode\('fest'\)/);
  });
  test(name + ': original tracking and backup hooks remain', () => {
    assert.match(html, /const KEY = 'splat-seed-app-v1'/);
    assert.match(html, /function trRecord\(obs\)/);
    assert.match(html, /function renderPicker\(/);
    assert.match(html, /function save\(\)/);
  });
}
test('modular and standalone have identical styling', () => {
  assert.equal(gameCSS(SOURCE), gameCSS(STANDALONE));
});
