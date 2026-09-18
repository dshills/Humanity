#!/usr/bin/env node
// Builds src/context.js: two long-run context series for the Earth layer.
//   pop     world population, 10,000 BCE to the latest historical year (Our World in Data, CC BY 4.0; the years
//           before 1800 derive from HYDE 3.3, which is CC BY-NC-SA 4.0 — fine for this open-source page, not for
//           commercial reuse)
//   cities  the world's largest city through time, derived from Chandler's historical urban population table as
//           digitised by Reba, Reitsma & Seto 2016 (figshare 10.6084/m9.figshare.2059494, CC BY 4.0)
// Run: node scripts/import-context.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; import script)';
const NL = String.fromCharCode(10);
async function text(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.text();
}
// Minimal CSV line parser (quoted fields with commas).
function parseLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const astro = (y) => (y < 0 ? y + 1 : y);                                 // historical year (no year 0) -> astronomical

// ---------------- population ----------------
const popCsv = await text('https://ourworldindata.org/grapher/population-long-run-with-projections.csv?csvType=full&useColumnShortNames=true');
const popLines = popCsv.split(NL);
const ph = parseLine(popLines[0]);
const iEnt = ph.indexOf('entity'), iYear = ph.indexOf('year'), iHist = ph.indexOf('population_historical');
const pop = [];
for (const line of popLines.slice(1)) {
  if (!line.startsWith('World,')) continue;
  const f = parseLine(line);
  const v = parseFloat(f[iHist]);
  if (f[iEnt] === 'World' && Number.isFinite(v)) pop.push([astro(parseInt(f[iYear], 10)), Math.round(v)]);
}
pop.sort((a, b) => a[0] - b[0]);
// Thin the annual modern series: every year is more than a sparkline needs before 1950.
const popOut = pop.filter(([t], i) => t < 1800 || t >= 1950 || t % 5 === 0 || i === pop.length - 1);

// ---------------- largest city ----------------
const cityCsv = await text('https://ndownloader.figshare.com/files/5407640');
const rows = cityCsv.split(/\r?\n/).filter(Boolean).map(parseLine);
const hdr = rows[0];
const yearCols = hdr.map((h, i) => { const m = /^(BC|AD)_(\d+)$/.exec(h); return m ? { i, y: astro(m[1] === 'BC' ? -Number(m[2]) : Number(m[2])) } : null; }).filter(Boolean);
const cities = rows.slice(1).map((f) => ({
  name: f[0].trim(),
  obs: yearCols.map((c) => [c.y, parseFloat(f[c.i])]).filter((p) => Number.isFinite(p[1]) && p[1] > 0).sort((a, b) => a[0] - b[0]),
})).filter((c) => c.name && c.obs.length);
// Digitisation slips: an observation at least five times both of its neighbours (Delhi reads 1,250,000 in 1375
// between 125,000 in 1354 and 125,000 in 1398) is dropped.
let dropped = 0;
for (const c of cities) {
  c.obs = c.obs.filter((p, k, o) => {
    if (k === 0 || k === o.length - 1) return true;
    const spike = p[1] >= 5 * o[k - 1][1] && p[1] >= 5 * o[k + 1][1];
    if (spike) dropped++;
    return !spike;
  });
}
console.log(`dropped ${dropped} spike observations`);
const MAX_GAP = 400;                                                       // do not interpolate across longer silences
function at(city, y) {
  const o = city.obs;
  if (y < o[0][0] || y > o[o.length - 1][0]) return null;
  for (let k = 0; k < o.length - 1; k++) {
    if (y >= o[k][0] && y <= o[k + 1][0]) {
      if (o[k + 1][0] - o[k][0] > MAX_GAP && y !== o[k][0] && y !== o[k + 1][0]) return null;
      const span = o[k + 1][0] - o[k][0] || 1;
      return o[k][1] + (o[k + 1][1] - o[k][1]) * (y - o[k][0]) / span;
    }
  }
  return o[o.length - 1][0] === y ? o[o.length - 1][1] : null;
}
// Benchmarks: Chandler's own BCE observation years, then every 25 years CE, plus the last column.
const bench = [...new Set(yearCols.filter((c) => c.y < 1).map((c) => c.y).concat(Array.from({ length: 76 }, (_, k) => 100 + k * 25)).concat([1975]))].sort((a, b) => a - b);
const winners = [];
for (const y of bench) {
  let best = null;
  for (const c of cities) { const v = at(c, y); if (v !== null && (!best || v > best.v)) best = { name: c.name, v }; }
  if (best) winners.push({ y, name: best.name, v: best.v });
}
// Merge consecutive benchmarks won by the same city; a segment runs to the next change.
const segs = [];
for (const w of winners) {
  const last = segs[segs.length - 1];
  if (last && last.name === w.name) { last.end = w.y; last.peak = Math.max(last.peak, w.v); }
  else { if (last) last.end = w.y; segs.push({ start: w.y, end: w.y, name: w.name, peak: w.v }); }
}
const cityOut = segs.filter((s) => s.end > s.start).map((s) => [s.start, s.end, s.name, Math.round(s.peak / 1000) * 1000]);

const out = `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  // Generated by scripts/import-context.mjs.
  // pop: world population [astronomical year, people] — Our World in Data (CC BY 4.0); pre-1800 values derive from
  //      HYDE 3.3 (CC BY-NC-SA 4.0). cities: [start, end, city, peak population] — the largest city by interpolated
  //      estimates from Chandler's table, digitised by Reba, Reitsma & Seto 2016 (figshare, CC BY 4.0).
  HT.context = {
    pop: ${JSON.stringify(popOut)},
    cities: ${JSON.stringify(cityOut)}
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(join(ROOT, 'src/context.js'), out);
console.log(`context.js: population ${popOut.length} pts (${pop[0][0]}..${pop[pop.length - 1][0]}), ${cityOut.length} city segments, ${Math.round(out.length / 1024)} KB`);
console.log(cityOut.map((s) => `${s[0]}→${s[1]} ${s[2]} (${(s[3] / 1000).toFixed(0)}k)`).join(' | '));
