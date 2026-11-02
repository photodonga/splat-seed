import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.html', import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html', import.meta.url),'utf8');
const standalone=readFileSync(new URL('../dist/app-standalone.html', import.meta.url),'utf8');
const brand=readFileSync(new URL('../assets/brand/splat-seed.svg', import.meta.url),'utf8');
test('main root serves precisely the current app',()=>assert.equal(index,app));
test('official logo is editable local SVG without fonts or external images',()=>{
 assert.match(brand,/<svg\b/); assert.match(brand,/<path\b/);
 assert.doesNotMatch(brand,/<image\b|<text\b|https?:\/\//);
 assert.match(app, /src="\.\/assets\/brand\/splat-seed\.svg"/);
});
test('standalone embeds the logo without a network URL',()=>{
 assert.match(standalone,/src="data:image\/svg\+xml,/);
 assert.doesNotMatch(standalone,/src="\.\/assets\/brand\/splat-seed\.svg"/);
});
