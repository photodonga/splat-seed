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

// Embed SVG files for the truly standalone/offline build.
// The modular app references ./assets/*.svg; the distributable embeds every SVG.
const ASSET_DIR = new URL('../assets/', import.meta.url);
const embeddedAssets = {};
function collectSvg(path = '') {
  for (const ent of fs.readdirSync(new URL(path, ASSET_DIR), { withFileTypes:true }).sort((a,b) => a.name.localeCompare(b.name,'en'))) {
    const relative = path + ent.name;
    if (ent.isDirectory()) collectSvg(relative + '/');
    else if (ent.isFile() && relative.endsWith('.svg')) {
      const source = fs.readFileSync(new URL(relative, ASSET_DIR), 'utf8');
      embeddedAssets[relative] = 'data:image/svg+xml,' + encodeURIComponent(source);
    }
  }
}
collectSvg();
if (!result.includes('const EMBEDDED_ASSETS = null;')) throw new Error('embedded SVG placeholder missing');
result = result.replace('const EMBEDDED_ASSETS = null;', () => 'const EMBEDDED_ASSETS = Object.freeze(' + JSON.stringify(embeddedAssets) + ');');
result = result.replace(/\.\/assets\/([a-zA-Z0-9_./-]+\.svg)/g, (match, name) => {
  if (!embeddedAssets[name]) throw new Error('missing SVG asset ' + name);
  return embeddedAssets[name];
});
if (/https?:\/\/(?:raw\.githubusercontent\.com|cdn\.wikimg\.net|fonts\.googleapis\.com)/.test(result)) {
  throw new Error('remote imagery or webfont dependency in standalone build');
}

fs.mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
fs.writeFileSync(out, result);
console.log(out, result.length, 'bytes');
