#!/usr/bin/env node
// Renders docs/demo.gif: a short scripted walk through the page (the log overview, a zoom into recorded history
// and on to 1500, the Lives layer, an open panel, a tour stop, a measurement). Each frame is a headless Chrome
// screenshot of the built index.html at a given URL and state; zooms are drawn as in-between views, interpolated
// the way the page animates (centre and log of the span). ffmpeg then builds a palette and the GIF.
// Needs a local Chrome or Chromium (CHROME_BIN) and ffmpeg. Run: node scripts/make-demo-gif.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200; const H = 720; const OUT_W = 960;
const chrome = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => existsSync(p));
if (!chrome) { console.error('no Chrome found (set CHROME_BIN)'); process.exit(1); }
if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg not found'); process.exit(1); }

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'humanity-gif-'));
const NOW = new Date().getUTCFullYear() + 0.7;
const FUTURE = 0.035;
const atNow = (start) => ({ start, end: (NOW - FUTURE * start) / (1 - FUTURE) });

// A page variant: what is in localStorage before the app starts, and a script to run after it has.
function page(name, storage, after) {
  const hook = `<script>try{localStorage.clear();${Object.entries({ 'ht-help-seen': '1', ...storage }).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('')}}catch(e){}</script>`;
  const tail = after ? `<script>setTimeout(function(){${after}},700);</script>` : '';
  const file = join(dir, name + '.html');
  writeFileSync(file, html.replace('<body>', '<body>' + hook).replace(/<\/body>(?![\s\S]*<\/body>)/, tail + '</body>'));
  return file;
}
const open = (re) => `var g=[].slice.call(document.querySelectorAll('#timeline .event')).filter(function(e){return ${re}.test(e.getAttribute('aria-label')||'')})[0];if(g)g.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));`;
const plain = page('plain', {});
const lives = page('lives', { 'ht-lives': '1', 'ht-reigns': '0' });
const leonardo = page('leonardo', { 'ht-lives': '1', 'ht-reigns': '0' }, open('/^Leonardo da Vinci,/'));

const hashOf = (v, extra) => `#s=${v.start.toFixed(6)}&e=${Math.abs(v.end - atNow(v.start).end) < 1e-6 ? 'now' : v.end.toFixed(6)}&m=ops${extra || ''}`;
function between(a, b, n) {                       // n in-between views, eased
  const out = [];
  for (let k = 1; k <= n; k++) {
    const u = k / (n + 1); const e = 1 - Math.pow(1 - u, 3);
    const span = Math.exp(Math.log(a.end - a.start) + (Math.log(b.end - b.start) - Math.log(a.end - a.start)) * e);
    const c = (a.start + a.end) / 2 + ((b.start + b.end) / 2 - (a.start + a.end) / 2) * e;
    out.push({ start: c - span / 2, end: c + span / 2 });
  }
  return out;
}

const rootView = atNow(-298050);
const recorded = atNow(-3499);
const v1500 = { start: 1440, end: 1560 };
const frames = [];                                 // { file, hash, hold (seconds) }
const still = (file, hash, hold) => frames.push({ file, hash, hold });
still(plain, hashOf(rootView), 2.0);
for (const v of between(rootView, recorded, 7)) still(plain, hashOf({ start: v.start, end: atNow(v.start).end }), 0.09);
still(plain, hashOf(recorded), 1.3);
for (const v of between(recorded, v1500, 7)) still(plain, hashOf(v), 0.09);
still(plain, hashOf(v1500), 1.2);
still(lives, hashOf(v1500), 1.6);
still(leonardo, hashOf(v1500), 2.2);
still(plain, '#s=1936&e=1946&m=ops&ev=citizen-kane-by-orson-welles&tour=century-of-cinema.5', 2.4);
still(plain, '#s=-2900&e=400&m=ops&ev=cleopatra-pharaoh&from=great-pyramid-of-giza-is-completed-for-khufu', 2.8);

console.log(`${frames.length} frames …`);
const list = [];
frames.forEach((f, i) => {
  const png = join(dir, `f${String(i).padStart(3, '0')}.png`);
  const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--window-size=${W},${H}`, '--virtual-time-budget=5000', `--screenshot=${png}`, pathToFileURL(f.file).href + f.hash], { timeout: 90000 });
  if (r.status !== 0 || !existsSync(png)) { console.error(`frame ${i} failed`); process.exit(1); }
  list.push(`file '${png}'\nduration ${f.hold}`);
  process.stdout.write('.');
});
list.push(`file '${join(dir, `f${String(frames.length - 1).padStart(3, '0')}.png`)}'`);   // the concat demuxer needs the last file twice
writeFileSync(join(dir, 'frames.txt'), list.join('\n') + '\n');
const out = join(ROOT, 'docs/demo.gif');
const filter = `fps=12,scale=${OUT_W}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
const ff = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'), '-vf', filter, '-loop', '0', out], { encoding: 'utf8' });
if (ff.status !== 0) { console.error(ff.stderr.split('\n').slice(-8).join('\n')); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
console.log(`\nwrote docs/demo.gif (${Math.round(readFileSync(out).length / 1024)} KB)`);
