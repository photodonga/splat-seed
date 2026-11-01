import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pages = [
  ['modular app', new URL('../app.html', import.meta.url)],
  ['standalone app', new URL('../dist/app-standalone.html', import.meta.url)],
];

for (const [name, url] of pages) {
  const source = readFileSync(url, 'utf8');

  test(name + ': render every next-outcome group without a six-item cap', () => {
    assert.match(source, /\$\('nextOpts'\)\.innerHTML\s*=\s*st\.groups\.map\(/);
    assert.doesNotMatch(source, /\$\('nextOpts'\)\.innerHTML\s*=\s*st\.groups\.slice\(/);
    assert.doesNotMatch(source, /외 \$\{st\.groups\.length - 6\}가지/);
  });

  test(name + ': preserve candidate counts and unique-result confirmation labels', () => {
    assert.ok(source.includes("r.result.truncated ? `${g.count}개` : g.count === 1 ? '→ 확정'"));
    assert.ok(source.includes('상한 걸린 후보 ${fmt(total)}개 기준'));
  });

  test(name + ': next-outcome list fits narrow layouts without its own scroll box', () => {
    assert.ok(source.includes('#nextOpts{min-width:0}'));
    assert.ok(source.includes('.opt{min-width:0;overflow-wrap:anywhere}'));
    assert.doesNotMatch(source, /#nextOpts\s*\{[^}]*overflow-y\s*:/);
    assert.doesNotMatch(source, /#nextOpts\s*\{[^}]*max-height\s*:/);
  });
}
