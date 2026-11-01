import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const STANDALONE = readFileSync(new URL('../dist/app-standalone.html', import.meta.url), 'utf8');
const grades = ['gold','silver','bronze','red','purple','blue'];

for (const [name,html] of [['modular',SOURCE], ['standalone',STANDALONE]]) {
  test(name + ': every capsule mode has an original local SVG', () => {
    assert.match(html, /SPLAT_GAME_ART_V1/);
    for (const mode of ['normal','fest']) for (const grade of grades)
      assert.ok(html.includes('capsules/'+mode+'-'+grade+'.svg'), mode+' '+grade);
    assert.doesNotMatch(html, /cdn\.wikimg\.net|raw\.githubusercontent\.com|fonts\.googleapis\.com/);
  });
  test(name + ': switching mode changes capsule asset set', () => {
    assert.match(html, /document\.body\.dataset\.splatMode = app\.mode/);
    assert.match(html, /data-splat-mode="normal"/);
    assert.match(html, /var\(--art,none\)/);
    assert.match(html, /\$\('mFest'\)\.onclick = \(\) => switchMode\('fest'\)/);
  });
  test(name + ': tracking and saved data remain unchanged', () => {
    assert.match(html, /const KEY = 'splat-seed-app-v1'/);
    assert.match(html, /function trRecord\(obs\)/);
    assert.match(html, /function renderPicker\(/);
    assert.match(html, /function save\(\)/);
  });
}
test('source mode art references corresponding SVGs on disk', () => {
  for(const mode of ['normal','fest']) for(const grade of grades)
    assert.ok(existsSync(new URL('../assets/capsules/'+mode+'-'+grade+'.svg',import.meta.url)));
});
