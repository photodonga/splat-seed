import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const pages = [
  ['app.html', readFileSync(new URL('../app.html', import.meta.url), 'utf8')],
  ['dist/app-standalone.html', readFileSync(new URL('../dist/app-standalone.html', import.meta.url), 'utf8')],
];
const expectedArt = [
  'rewards/card-pack.svg',
  'rewards/food-party.svg',
  'rewards/food-boost.svg',
  'rewards/food-small.svg',
  'rewards/drink.svg',
  'rewards/banner.svg',
  'rewards/banner-gold.svg',
  'rewards/title.svg',
  'rewards/title-silver.svg',
  'rewards/chip.svg',
  'rewards/chips-10.svg',
  'rewards/emote.svg',
  'rewards/locker-sticker.svg',
  'rewards/locker-figure.svg',
];

for (const [name, source] of pages) {
  test(name + ': ten forecast buttons are individually selectable', () => {
    assert.match(source, /preds\.map\(\(p, i\) => \{/);
    assert.match(source, /data-preview=/);
    assert.match(source, /aria-pressed=/);
    assert.match(source, /previewIndex = Number\(button\.dataset\.preview\)/);
    assert.match(source, /\$\('previewName'\)\.textContent = label\(chosen\)/);
    assert.match(source, /\$\('previewDetail'\)\.hidden = false/);
    assert.match(source, /grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/);
  });
  test(name + ': original locker sticker gallery includes 15 local designs', () => {
    const samples = [
      'sticker-01.svg',
      'sticker-02.svg',
      'sticker-03.svg',
      'sticker-04.svg',
      'sticker-05.svg',
      'sticker-06.svg',
      'sticker-07.svg',
      'sticker-08.svg',
      'sticker-09.svg',
      'sticker-10.svg',
      'sticker-11.svg',
      'sticker-12.svg',
      'sticker-13.svg',
      'sticker-14.svg',
      'sticker-15.svg',
    ];
    for (const id of samples) assert.ok(source.includes(id), 'missing sticker sample '+id);
    assert.match(source, /function renderStickerGallery\(\)/);
    assert.match(source, /const isSticker = chosen\.type === 'LockerSticker'/);
    assert.match(source, /\$\('stickerGallery'\)\.hidden = !isSticker/);
    assert.match(source, /오리지널 스티커 일러스트 예시/);
    assert.match(source, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  });
  test(name + ': reward icons never consume the text column', () => {
    assert.match(source, /grid-template-columns:24px 28px minmax\(0,1fr\) auto/);
    assert.match(source, /\.tap-copy\{flex:1 1 auto;min-width:0\}/);
    assert.match(source, /\.item-label\{display:block;min-width:0/);
    assert.match(source, /\.hist-label\{display:block;min-width:0/);
    assert.match(source, /\.reward-image\[hidden\]\{display:none!important\}/);
  });
  test(name + ': selecting a preview is read-only', () => {
    const start = source.indexOf("$('strip').onclick = e => {");
    const end = source.indexOf('const selected = preds[previewIndex];', start);
    assert.ok(start !== -1 && end > start);
    const clickHandler = source.slice(start, end);
    assert.doesNotMatch(clickHandler, /trRecord\(|record\(|save\(/);
    assert.match(clickHandler, /renderTrack\(\)/);
    assert.match(source, /previewIndex = 0; \/\/ transient display choice/);
    assert.match(source, /previewIndex = 0; save\(\); render\(\)/);
  });
  test(name + ': original reward icons are mapped by predicted category', () => {
    for (const asset of expectedArt) assert.ok(source.includes(asset), 'missing '+asset);
    assert.match(source, /function updateRewardImage\(id, outcome\)/);
    assert.match(source, /\$\('nextOpts'\)\.innerHTML = st\.groups\.map/);
    assert.ok(source.includes('${rewardIcon(g)}'));
    assert.ok(source.includes('${rewardIcon(it)}'));
    assert.ok(source.includes("updateRewardImage('tapItemIcon', actual)"));
    assert.ok(source.includes("updateRewardImage('previewItemIcon', chosen)"));
    assert.ok(source.includes('아이템 그림은 종류별 대표 이미지입니다.'));
  });
}

test('single-file bundle exactly matches committed output', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'splat-forecast-'));
  const out = join(workdir, 'app.html');
  const root = new URL('../', import.meta.url);
  try {
    execFileSync(process.execPath, [
      'tools/bundle.mjs','app.html',out,
      'engine/murmur3.mjs','engine/xorshift128.mjs','engine/shellout.mjs',
      'engine/npln-id.mjs','engine/candidates.mjs','engine/tracker.mjs','engine/plan.mjs'
    ], { cwd: root, stdio: 'pipe' });
    assert.equal(readFileSync(out,'utf8'), pages[1][1]);
  } finally { rmSync(workdir, {recursive:true,force:true}); }
});
