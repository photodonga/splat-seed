// Builds a single-file HTML: inlines engine modules (imports/exports stripped) and the personal font loader.
// Usage: node tools/bundle.mjs <page.html> <out.html> <module.mjs>...
import fs from 'node:fs';
const [page, out, ...mods] = process.argv.slice(2);
if (!page || !out || !mods.length) throw new Error('usage: node tools/bundle.mjs page.html out.html engine/a.mjs ...');
const strip = src => src
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
  .replace(/^export\s+(?=(async\s+)?(function|class|const|let)\b)/gm, '');
const html = fs.readFileSync(page, 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) throw new Error('module script not found');
const code = mods.map(p => `// ---- ${p}\n${strip(fs.readFileSync(p, 'utf8'))}`).join('\n') + `\n// ---- ${page}\n${strip(m[1])}`;
let result = html.replace(m[0], () => `<script type="module">\n${code}\n</script>`);
const fontTag = '<script src="personal-fonts.js" defer></script>';
if (result.includes(fontTag)) result = result.replace(fontTag, () => `<script>\n${fs.readFileSync('personal-fonts.js', 'utf8')}\n</script>`);
// Embed checked original PNG bytes in the standalone release.
const manifest=JSON.parse(fs.readFileSync('assets/game-manifest.json','utf8'));
const embedded={};
for(const {path:p} of manifest){
 const bytes=fs.readFileSync('assets/game/'+p);
 if(bytes.length<100||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw new Error('Invalid PNG '+p);
 embedded[p]='data:image/png;base64,'+bytes.toString('base64');
}
if(!result.includes('const EMBEDDED_GAME_ASSETS = null;'))throw new Error('No original-art placeholder');
result=result.replace('const EMBEDDED_GAME_ASSETS = null;',()=> 'const EMBEDDED_GAME_ASSETS = Object.freeze('+JSON.stringify(embedded)+');');
result=result.replace(/\.\/assets\/game\/([a-zA-Z0-9_./-]+\.png)/g,(match,p)=>{if(!embedded[p])throw new Error('Missing PNG '+p);return embedded[p]});
if(/https?:\/\/(?:cdn\.wikimg\.net|raw\.githubusercontent\.com)/.test(result))throw new Error('Runtime external art');

fs.mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
fs.writeFileSync(out, result);
console.log(out, result.length, 'bytes');
