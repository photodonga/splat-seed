import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const list=JSON.parse(fs.readFileSync(new URL('../assets/game-manifest.json',import.meta.url),'utf8'));
const app=fs.readFileSync(new URL('../app.html',import.meta.url),'utf8');
const standalone=fs.readFileSync(new URL('../dist/app-standalone.html',import.meta.url),'utf8');
test('original sprite manifest contains all original game art categories',()=>{
 const paths=new Set(list.map(x=>x.path));
 assert.equal(paths.size,list.length);
 assert.equal(list.filter(x=>x.path.startsWith('capsules/')).length,12);
 assert.equal(list.filter(x=>x.path.startsWith('header/')).length,1);
 assert.equal(list.filter(x=>x.path.startsWith('images/zakka/')).length>=16,true);
});
test('PNG files exist locally and keep PNG bytes',()=>{
 const sig=Buffer.from([137,80,78,71,13,10,26,10]);
 for(const {path} of list){
 const b=fs.readFileSync(new URL('../assets/game/'+path,import.meta.url));
 assert.ok(b.length>100,path);assert.ok(b.subarray(0,8).equals(sig),path);
 }
});
test('app and standalone no longer fetch external game art',()=>{
 assert.doesNotMatch(app,/cdn\.wikimg\.net|raw\.githubusercontent\.com/);
 assert.doesNotMatch(standalone,/cdn\.wikimg\.net|raw\.githubusercontent\.com/);
 assert.match(standalone,/const EMBEDDED_GAME_ASSETS = Object\.freeze/);
 assert.ok((standalone.match(/data:image\/png;base64,/g)||[]).length>=list.length);
});
