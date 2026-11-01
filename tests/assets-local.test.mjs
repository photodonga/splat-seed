import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

function svgFiles(dir, prefix='') {
  return readdirSync(dir,{withFileTypes:true}).flatMap(ent => ent.isDirectory()
   ? svgFiles(new URL(ent.name+'/',dir),prefix+ent.name+'/')
   : ent.name.endsWith('.svg') ? [prefix+ent.name] : []);
}
const root=new URL('../assets/',import.meta.url);
const names=svgFiles(root);
const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const alone=readFileSync(new URL('../dist/app-standalone.html',import.meta.url),'utf8');

test('42 original SVG images are committed and self-contained',()=>{
  assert.equal(names.length,42);
  for(const name of names){
    const str=readFileSync(new URL(name,root),'utf8');
    assert.match(str,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(str,/<\/svg>/);
    assert.doesNotMatch(str,/<image|<script|@import|<foreignObject/i);
    assert.ok(alone.includes(name),'missing in standalone: '+name);
  }
});
test('modular references own assets, without external picture links or fonts',()=>{
  assert.match(app,/const EMBEDDED_ASSETS = null;/);
  assert.match(app,/const assetUrl = path/);
  assert.match(app,/\.\/assets\/branding\/seed-mark\.svg/);
  assert.doesNotMatch(app,/cdn\.wikimg\.net|raw\.githubusercontent\.com|fonts\.googleapis\.com/);
});
test('standalone has SVG bytes embedded and never fetches art',()=>{
  assert.doesNotMatch(alone,/const EMBEDDED_ASSETS = null;/);
  assert.match(alone,/const EMBEDDED_ASSETS = Object\.freeze\(\{/);
  assert.ok((alone.match(/data:image\/svg\+xml,/g)||[]).length>=42);
  assert.doesNotMatch(alone,/cdn\.wikimg\.net|raw\.githubusercontent\.com|fonts\.googleapis\.com/);
  assert.doesNotMatch(alone,/url\("\.\/assets\//);
});
