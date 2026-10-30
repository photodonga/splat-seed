// Builds dist/lab-standalone.html: lab.html with engine modules inlined into one <script type="module">.
// Lets the lab run from a single file (artifact / file://). Search falls back to the main thread there.
import fs from 'node:fs';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = src => src
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/^export\s+(?=(async\s+)?(function|class|const|let)\b)/gm, '');
const modules = ['engine/murmur3.mjs', 'engine/xorshift128.mjs', 'engine/shellout.mjs', 'engine/npln-id.mjs']
  .map(p => `// ---- ${p}\n${strip(read(p))}`).join('\n');
const lab = read('lab.html');
const m = lab.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) throw new Error('module script not found in lab.html');
const app = strip(m[1]);
const out = lab.replace(m[0], () => `<script type="module">\n${modules}\n// ---- lab.html\n${app}\n</script>`);
fs.mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../dist/lab-standalone.html', import.meta.url), out);
console.log('dist/lab-standalone.html', out.length, 'bytes');
