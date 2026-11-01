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
      const grade=color.toLowerCase();
      assert.ok(html.includes('capsules/normal-'+grade+'.png'), 'missing normal '+grade);
      assert.ok(html.includes('capsules/fest-'+grade+'.png'), 'missing fest '+grade);
    }
    assert.doesNotMatch(html, /cdn\.wikimg\.net|raw\.githubusercontent\.com/);
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
  const normalize = css => css.replace(/url\("(?:\.\/assets\/game\/[a-zA-Z0-9_./-]+\.png|data:image\/png;base64,[^"]+)"\)/g, 'url("[ORIGINAL_LOCAL_PNG]")');
  assert.equal(normalize(gameCSS(SOURCE)), normalize(gameCSS(STANDALONE)));
});
