// Downloads actual original game PNGs listed in assets/game-manifest.json.
// Source files are not modified here; verify PNG signature after each download.
// Afterwards run tools/shrink-game-art.py to scale capsule/food art down to display size.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=fileURLToPath(new URL('../assets/game/',import.meta.url));
const list=JSON.parse(fs.readFileSync(new URL('../assets/game-manifest.json',import.meta.url),'utf8'));
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
for(const {path:relative,url} of list){
 if(!/^(?:capsules|header|images)\/[A-Za-z0-9_.^/-]+\.png$/.test(relative))throw Error('bad path '+relative);
 if(!/^https:\/\/(?:cdn\.wikimg\.net|raw\.githubusercontent\.com)\//.test(url))throw Error('bad source '+url);
 const output=path.join(root,relative);fs.mkdirSync(path.dirname(output),{recursive:true});
 execFileSync('curl',['--fail','--location','--silent','--show-error','--retry','4','--retry-all-errors','--connect-timeout','20','--max-time','90','--user-agent','Mozilla/5.0 (compatible; SPLATSEED personal fan tool)','--output',output,url],{stdio:'inherit'});
 const bytes=fs.readFileSync(output);
 if(bytes.length<100 || !bytes.subarray(0,8).equals(signature))throw Error('not a PNG '+relative);
 console.log('vendored',relative,bytes.length);
}
console.log('Downloaded original PNGs:',list.length);
