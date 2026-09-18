#!/usr/bin/env node
/**
 * build.mjs — Humanity Timeline bundler (CONTRACT.md §0 and §9)
 *
 * Node ≥ 18, zero dependencies. Reads the sources in the contract order
 *   time.js, tiers.js, ticks.js, layout.js, earth.js, data/*.js (sorted by filename), app.js
 * concatenates them (one comment banner per file) followed by `HT.app.init();`,
 * inlines that bundle and src/styles.css into src/index.template.html, and writes
 * ./index.html — ONE self-contained file that works from file://.
 *
 * Exits 1 (after printing every problem it found) when:
 *   - any expected source file is missing, or src/data has no .js files
 *   - a template placeholder is missing or duplicated
 *   - the JS bundle contains `import `, `export ` or `require(` outside comments/strings
 *   - the JS bundle would break the inline <script> (`</script`, `<!--`), or has a syntax error
 *   - the CSS would break the inline <style> (`</style`)
 *   - the output has a src= / href= attribute pointing at an external (http(s):// or //) URL
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(ROOT, 'src');
const OUT_FILE = path.join(ROOT, 'index.html');

const TEMPLATE = 'index.template.html';
const STYLES = 'styles.css';
const JS_HEAD = ['time.js', 'tiers.js', 'ticks.js', 'layout.js', 'core.js', 'earth.js', 'context.js', 'map.js', 'geo.js', 'objects.js'];
const JS_TAIL = ['app.js'];
const DATA_DIR = 'data';
const STYLES_PLACEHOLDER = '<!--STYLES-->';
const SCRIPTS_PLACEHOLDER = '<!--SCRIPTS-->';
const INIT_CALL = 'HT.app.init();';

const errors = [];
const problem = (msg) => errors.push(msg);

function die() {
  for (const e of errors) console.error(`build: error: ${e}`);
  console.error(`build: FAILED with ${errors.length} error${errors.length === 1 ? '' : 's'}`);
  process.exit(1);
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const isENOENT = (err) => err && (err.code === 'ENOENT' || err.code === 'ENOTDIR');

// --------------------------------------------------------------------------
// 1. Resolve the source list
// --------------------------------------------------------------------------
let dataFiles = [];
try {
  dataFiles = (await readdir(path.join(SRC_DIR, DATA_DIR)))
    .filter((f) => f.endsWith('.js'))
    .sort(); // plain code-unit sort: deterministic regardless of locale; NN- prefix orders them
} catch (err) {
  if (isENOENT(err)) problem(`missing directory src/${DATA_DIR}/`);
  else throw err;
}
if (dataFiles.length === 0 && errors.length === 0) problem(`no .js files in src/${DATA_DIR}/`);

const jsOrder = [...JS_HEAD, ...dataFiles.map((f) => `${DATA_DIR}/${f}`), ...JS_TAIL];

// --------------------------------------------------------------------------
// 2. Read everything (report every missing file at once)
// --------------------------------------------------------------------------
async function readSrc(name) {
  const file = path.join(SRC_DIR, name);
  try {
    return { name, text: await readFile(file, 'utf8') };
  } catch (err) {
    if (isENOENT(err)) {
      problem(`missing file src/${name}`);
      return { name, text: null };
    }
    throw err;
  }
}

const [template, styles, ...sources] = await Promise.all([
  readSrc(TEMPLATE),
  readSrc(STYLES),
  ...jsOrder.map(readSrc),
]);

if (errors.length) die();

// --------------------------------------------------------------------------
// 3. Template sanity
// --------------------------------------------------------------------------
for (const ph of [STYLES_PLACEHOLDER, SCRIPTS_PLACEHOLDER]) {
  const count = template.text.split(ph).length - 1;
  if (count !== 1) problem(`src/${TEMPLATE} must contain ${ph} exactly once (found ${count})`);
}
if (/<\/style/i.test(styles.text)) problem(`src/${STYLES} contains "</style", which would break the inline <style>`);

// --------------------------------------------------------------------------
// 4. Assemble the JS bundle
// --------------------------------------------------------------------------
const banner = (name) => `/* ======== src/${name} ======== */\n`;
let bundle = '';
for (const { name, text } of sources) {
  bundle += banner(name);
  bundle += text.endsWith('\n') ? text : text + '\n';
  bundle += '\n';
}
bundle += `/* ======== bootstrap ======== */\n${INIT_CALL}\n`;

// --------------------------------------------------------------------------
// 5. Bundle checks
// --------------------------------------------------------------------------

/**
 * Blank out comments, string/template literals and regex literals, preserving
 * newlines so line numbers stay exact. Used only for the token scan below; the
 * bundle itself is inlined verbatim.
 */
function stripCommentsAndStrings(src) {
  const n = src.length;
  let out = '';
  let sig = ''; // trailing run of significant chars, for the regex/division heuristic
  const push = (s) => {
    out += s;
    const t = s.replace(/\s+/g, '');
    if (t) sig = (sig + t).slice(-16);
  };
  const newlinesOf = (s) => s.replace(/[^\n]/g, '');
  const regexAfterChar = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  const regexAfterWord = /(?:^|[^\w$.])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    if (c === '/' && d === '/') {
      const j = src.indexOf('\n', i);
      i = j === -1 ? n : j; // keep the newline
      continue;
    }
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j === -1 ? n : j + 2;
      out += newlinesOf(src.slice(i, end)) + ' ';
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        j++;
      }
      push(c + c);
      i = j + 1;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') j++;
        j++;
      }
      push('`' + newlinesOf(src.slice(i + 1, j)) + '`');
      i = j + 1;
      continue;
    }
    if (c === '/') {
      const prev = sig.slice(-1);
      const isRegex = prev === '' || regexAfterChar.has(prev) || regexAfterWord.test(sig);
      if (isRegex) {
        let j = i + 1;
        let inClass = false;
        while (j < n && src[j] !== '\n') {
          const ch = src[j];
          if (ch === '\\') { j += 2; continue; }
          if (inClass) { if (ch === ']') inClass = false; }
          else if (ch === '[') inClass = true;
          else if (ch === '/') break;
          j++;
        }
        j++; // closing slash
        while (j < n && /[a-z]/i.test(src[j])) j++; // flags
        push('/re/');
        i = j;
        continue;
      }
    }
    push(c);
    i++;
  }
  return out;
}

const FORBIDDEN = [
  { token: 'import ', re: /\bimport\s/g },
  { token: 'export ', re: /\bexport\s/g },
  { token: 'require(', re: /\brequire\s*\(/g },
];

for (const { name, text } of sources) {
  const code = stripCommentsAndStrings(text);
  for (const { token, re } of FORBIDDEN) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      const line = code.slice(0, m.index).split('\n').length;
      problem(`src/${name}:${line}: forbidden token "${token}" (src files must be plain scripts, CONTRACT.md §1)`);
    }
  }
}

if (/<\/script/i.test(bundle)) problem('JS bundle contains "</script", which would terminate the inline <script>');
if (/<!--/.test(bundle)) problem('JS bundle contains "<!--", which changes how the HTML parser reads the inline <script>');

if (!errors.length) {
  try {
    // Compile only — nothing is executed. Catches syntax errors before the browser does.
    new Script(bundle, { filename: 'index.html (inline bundle)' });
  } catch (err) {
    const where = err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err);
    problem(`JS bundle does not parse: ${err.message} — ${where}`);
  }
}

if (errors.length) die();

// --------------------------------------------------------------------------
// 6. Inline into the template and check the output
// --------------------------------------------------------------------------
// Function replacers so "$&"-style patterns inside CSS/JS are never interpreted.
let html = template.text
  .replace(STYLES_PLACEHOLDER, () => styles.text.trimEnd())
  .replace(SCRIPTS_PLACEHOLDER, () => bundle.trimEnd());
if (!html.endsWith('\n')) html += '\n';

const externalRef = /\b(?:src|href)\s*=\s*(?:["']\s*)?(?:https?:)?\/\//gi;
let m;
while ((m = externalRef.exec(html)) !== null) {
  const line = html.slice(0, m.index).split('\n').length;
  const snippet = html.slice(m.index, m.index + 60).split('\n')[0];
  problem(`index.html:${line}: external reference "${snippet}" — the page must not load anything over the network`);
}

if (errors.length) die();

// --------------------------------------------------------------------------
// 7. Write
// --------------------------------------------------------------------------
await writeFile(OUT_FILE, html, 'utf8');

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `build: wrote ${rel(OUT_FILE)} (${kb(Buffer.byteLength(html))}) — ` +
  `${sources.length} scripts (${dataFiles.length} data files), css ${kb(Buffer.byteLength(styles.text))}`
);
