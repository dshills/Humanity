#!/usr/bin/env node
// Imports NOAA public-domain data into the bundle:
//   src/earth.js            HT.earth: CO2, Antarctic temperature and sea-level series (800,000 years to today)
//   src/data/09-hazards.js  significant earthquakes, tsunamis and eruptions as `earth` events
// Sources (US Government works, unrestricted; citation requested):
//   Bereiter et al. 2015 CO2 composite; Jouzel et al. 2007 EPICA Dome C temperature; Spratt & Lisiecki 2016 sea level;
//   NOAA GML Mauna Loa annual mean CO2; NCEI/WDS Global Significant Earthquake, Tsunami and Volcanic Eruption databases
//   (doi:10.7289/V5TD9V7K). Run: node scripts/import-noaa.mjs   (network access needed at import time only)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; import script)';
const PRESENT = 1950;

async function text(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}
async function json(url, attempt = 1) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) {
    if (attempt < 4 && (r.status >= 500 || r.status === 429)) {
      await new Promise((res) => setTimeout(res, 1500 * attempt));
      return json(url, attempt + 1);
    }
    throw new Error(`${r.status} ${url}`);
  }
  return r.json();
}
const num = (s) => { const v = parseFloat(s); return Number.isFinite(v) ? v : null; };
const bpToT = (ageBP) => PRESENT - ageBP;

// Average a [t, v] series into bins of `width` years where t < cutoff (older); keep younger points as they are.
function bin(points, width, cutoff) {
  const keep = points.filter((p) => p[0] >= cutoff);
  const old = points.filter((p) => p[0] < cutoff);
  const map = new Map();
  for (const [t, v] of old) {
    const k = Math.floor(t / width);
    const b = map.get(k) || { s: 0, n: 0, ts: 0 };
    b.s += v; b.n++; b.ts += t; map.set(k, b);
  }
  const binned = [...map.values()].map((b) => [b.ts / b.n, b.s / b.n]);
  return binned.concat(keep).sort((a, b) => a[0] - b[0]);
}
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

// ---------------- climate series ----------------
async function climate() {
  const co2Txt = await text('https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/antarctica2015co2composite.txt');
  const co2 = [];
  for (const line of co2Txt.split('\n')) {
    if (line.startsWith('#') || !/^\s*-?\d/.test(line)) continue;
    const [age, ppm] = line.trim().split(/\s+/).map(num);
    if (age !== null && ppm !== null && age > 7) co2.push([bpToT(age), ppm]);   // < 1957 CE; Mauna Loa takes over
  }
  const mloTxt = await text('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt');
  for (const line of mloTxt.split('\n')) {
    if (line.startsWith('#') || !/^\s*\d{4}/.test(line)) continue;
    const [yr, mean] = line.trim().split(/\s+/).map(num);
    if (yr !== null && mean !== null) co2.push([yr + 0.5, mean]);
  }
  const tempTxt = await text('https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/epica_domec/edc3deuttemp2007.txt');
  const temp = [];
  for (const line of tempTxt.split('\n')) {
    const f = line.trim().split(/\s+/);
    if (f.length < 5 || !/^\d+$/.test(f[0])) continue;                    // "bag ztop age deuterium temperature"
    const age = num(f[2]); const dT = num(f[4]);
    if (age !== null && dT !== null) temp.push([bpToT(age), dT]);
  }
  const seaTxt = await text('https://www.ncei.noaa.gov/pub/data/paleo/contributions_by_author/spratt2016/spratt2016.txt');
  const sea = [];
  for (const line of seaTxt.split('\n')) {
    if (line.startsWith('#') || !/^\s*\d/.test(line)) continue;
    const f = line.trim().split(/\s+/).map(num);
    if (f[0] !== null && f[5] !== null) sea.push([bpToT(f[0] * 1000), f[5]]);   // long PC1 (0-798 ka)
  }
  // The Spratt & Lisiecki stack is a regression estimate that does not pass exactly through 0 at the
  // present; express it relative to its youngest (0 ka) value so "today" reads 0 m.
  sea.sort((a, b) => a[0] - b[0]);
  const seaNow = sea.length ? sea[sea.length - 1][1] : 0;
  for (const p of sea) p[1] -= seaNow;
  const series = {
    co2:  bin(co2.sort((a, b) => a[0] - b[0]), 500, PRESENT - 20000).map(([t, v]) => [Math.round(t), round(v, 1)]),
    temp: bin(temp.sort((a, b) => a[0] - b[0]), 600, PRESENT - 20000).map(([t, v]) => [Math.round(t), round(v, 1)]),
    sea:  sea.sort((a, b) => a[0] - b[0]).map(([t, v]) => [Math.round(t), round(v, 1)]),
  };
  const meta = {
    co2:  { label: 'CO₂', unit: 'ppm', range: [170, 430], source: 'Bereiter et al. 2015 composite (NOAA NCEI) + NOAA GML Mauna Loa annual means' },
    temp: { label: 'Antarctic ΔT', unit: '°C', range: [-11, 6], source: 'EPICA Dome C EDC3, Jouzel et al. 2007 (NOAA NCEI); difference from the last-millennium mean' },
    sea:  { label: 'Sea level', unit: 'm', range: [-140, 15], source: 'Spratt & Lisiecki 2016 stack, long PC1 (NOAA NCEI); metres relative to the 0 ka value' },
  };
  const out = `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  // Generated by scripts/import-noaa.mjs — NOAA public-domain climate series, [astronomical year, value].
  HT.earth = {
    meta: ${JSON.stringify(meta, null, 2).replace(/\n/g, '\n    ')},
    series: {
      co2: ${JSON.stringify(series.co2)},
      temp: ${JSON.stringify(series.temp)},
      sea: ${JSON.stringify(series.sea)}
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
  writeFileSync(join(ROOT, 'src/earth.js'), out);
  console.log(`earth.js: co2 ${series.co2.length} pts, temp ${series.temp.length} pts, sea ${series.sea.length} pts, ${Math.round(out.length / 1024)} KB`);
}

// ---------------- hazards ----------------
async function all(endpoint) {
  const items = [];
  for (let page = 1; ; page++) {
    const d = await json(`https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/${endpoint}?itemsPerPage=200&page=${page}`);
    items.push(...d.items);
    if (page >= d.totalPages) break;
  }
  return items;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function place(loc, country) {
  // "CHINA:  SHAANXI PROVINCE" -> "Shaanxi Province, China"; "ECUADOR" -> "Ecuador"
  const parts = String(loc || '').split(':').map((s) => s.trim()).filter(Boolean);
  const tc = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bOf\b/g, 'of').replace(/\bAnd\b/g, 'and');
  const c = tc(String(country || parts[0] || ''));
  const rest = parts.slice(1).map(tc).filter((p) => p && p !== c);
  return rest.length ? `${rest[rest.length - 1]}, ${c}` : c;
}
// NCEI years are historical: -2150 means 2150 BCE and there is no year 0 (bce(2150) = astronomical -2149).
function dateExpr(y, m, d) {
  if (y < 0) return `bce(${-y})`;
  if (y === 0) return 'bce(1)';
  return m && d ? `ymd(${y}, ${m}, ${d})` : m ? `ymd(${y}, ${m}, 1)` : `ce(${y})`;
}
function dateText(y, m, d) {
  const yr = y < 0 ? `${-y} BCE` : y === 0 ? '1 BCE' : String(y);
  return m && d ? `${d} ${MONTHS[m - 1]} ${yr}` : m ? `${MONTHS[m - 1]} ${yr}` : yr;
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
function tierFor(deaths, vei) {
  if (vei >= 7) return 3;
  if (deaths >= 100000) return 3;
  if (deaths >= 20000) return 4;
  if (vei >= 6 || deaths >= 5000) return 5;
  return 6;
}
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const curatedTitles = new Set();
function existingHazardYears() {
  // Curated events that already describe a quake/tsunami/eruption: skip NCEI records within a year of them.
  const years = [];
  for (const f of readdirSync(join(ROOT, 'src/data')).sort()) {
    if (f.startsWith('09-')) continue;
    const src = readFileSync(join(ROOT, 'src/data', f), 'utf8');
    const re = /\{\s*t:\s*(bce|ce|ymd|ya)\(([^)]*)\)[^}]*?title:\s*(['"])(.*?)\3/g;
    let m;
    while ((m = re.exec(src))) {
      curatedTitles.add(m[4].toLowerCase());
      if (!/earthquake|quake|tsunami|erupt|volcan/i.test(m[4])) continue;
      const a = m[2].split(',').map((x) => parseFloat(x));
      const y = m[1] === 'bce' ? 1 - a[0] : m[1] === 'ya' ? PRESENT - a[0] : a[0];
      years.push({ y, title: m[4] });
    }
  }
  return years;
}

async function hazards() {
  const [quakes, tsunamis, volcanoes] = await Promise.all([all('earthquakes'), all('tsunamis/events'), all('volcanoes')]);
  console.log(`fetched ${quakes.length} quakes, ${tsunamis.length} tsunamis, ${volcanoes.length} eruptions`);
  const curated = existingHazardYears();
  const nearCurated = (y) => curated.find((c) => Math.abs(c.y - y) <= 1);
  const out = [];
  const usedQuakeIds = new Set();

  // Tsunamis with big death tolls: merged into their causative quake when that quake is selected too.
  const tsuByQuake = new Map();
  for (const ts of tsunamis) if (ts.earthquakeEventId) tsuByQuake.set(ts.earthquakeEventId, ts);

  for (const q of quakes) {
    const deaths = q.deathsTotal || q.deaths || 0;
    const mag = q.eqMagnitude || 0;
    if (!(deaths >= 10000 || mag >= 8.5)) continue;
    const yr = q.year;
    if (nearCurated(yr)) continue;
    const ts = tsuByQuake.get(q.id);
    const where = place(q.locationName, q.country);
    const magTxt = mag ? ` (M ${mag.toFixed(1)})` : '';
    const title = `${where.split(',')[0]} earthquake${magTxt}`;
    let detail = `${mag ? `Magnitude ${mag.toFixed(1)} earthquake` : 'Earthquake'} on ${dateText(yr, q.month, q.day)} near ${where}`;
    if (deaths) detail += `; about ${fmt(deaths)} deaths recorded`;
    if (ts && (ts.deaths || ts.maxWaterHeight)) detail += `. It raised a tsunami${ts.maxWaterHeight ? ` with run-ups to ${ts.maxWaterHeight} m` : ''}`;
    detail += ' (NCEI Significant Earthquake Database).';
    usedQuakeIds.add(q.id);
    out.push({ t: dateExpr(yr, q.month, q.day), y: yr, title, detail, tier: tierFor(deaths, 0),
      link: `https://www.ngdc.noaa.gov/hazel/view/hazards/earthquake/event-more-info/${q.id}` });
  }
  for (const ts of tsunamis) {
    const deaths = ts.deathsTotal || ts.deaths || 0;
    if (deaths < 5000 || usedQuakeIds.has(ts.earthquakeEventId)) continue;
    const yr = ts.year;
    if (nearCurated(yr)) continue;
    const where = place(ts.locationName, ts.country);
    const title = `Tsunami strikes ${where.split(',')[0]}${ts.eqMagnitude ? ` (M ${ts.eqMagnitude.toFixed(1)} quake)` : ''}`;
    let detail = `Tsunami on ${dateText(yr, ts.month, ts.day)} striking ${where}`;
    if (ts.maxWaterHeight) detail += `, run-ups to ${ts.maxWaterHeight} m`;
    detail += `; about ${fmt(deaths)} deaths recorded (NCEI Global Historical Tsunami Database).`;
    out.push({ t: dateExpr(yr, ts.month, ts.day), y: yr, title, detail, tier: tierFor(deaths, 0),
      link: `https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${ts.id}` });
  }
  for (const v of volcanoes) {
    const deaths = v.deathsTotal || v.deaths || 0;
    const vei = v.vei || 0;
    if (!(vei >= 6 || deaths >= 1000)) continue;
    const yr = v.year;
    if (nearCurated(yr)) continue;
    const title = `${v.name} erupts${vei >= 5 ? ` (VEI ${vei})` : ''}`;
    let detail = `${vei ? `VEI ${vei} eruption` : 'Eruption'} of ${v.name}, ${v.location ? `${v.location}, ` : ''}${v.country}, ${dateText(yr, v.month, v.day)}`;
    if (deaths) detail += `; about ${fmt(deaths)} deaths recorded`;
    detail += ' (NCEI Significant Volcanic Eruption Database).';
    out.push({ t: dateExpr(yr, v.month, v.day), y: yr, title, detail, tier: tierFor(deaths, vei),
      link: `https://www.ngdc.noaa.gov/hazel/view/hazards/volcano/event-more-info/${v.id}` });
  }
  // Same title in the same year (a main shock and its aftershock, two eruptive phases): keep the deadliest.
  const byKey = new Map();
  for (const e of out) {
    const k = e.title + '|' + e.y;
    const prev = byKey.get(k);
    if (!prev || (e.tier < prev.tier)) byKey.set(k, e);
  }
  out.length = 0;
  out.push(...byKey.values());
  // De-duplicate titles (same place, different years get the year prefixed).
  const seen = new Map();
  for (const e of out) seen.set(e.title, (seen.get(e.title) || 0) + 1);
  for (const e of out) {
    if (seen.get(e.title) > 1 || curatedTitles.has(e.title.toLowerCase())) e.title = `${e.y < 0 ? `${-e.y} BCE` : e.y} ${e.title}`;
  }
  out.sort((a, b) => a.y - b.y);
  for (const e of out) {
    if (e.title.length > 80) e.title = e.title.slice(0, 79).replace(/\s+\S*$/, '') + '…';
    if (e.detail.length > 300) e.detail = e.detail.slice(0, 296).replace(/\s+\S*$/, '') + '….';
  }
  const lines = out.map((e) => `    { t: ${e.t}, title: '${esc(e.title)}', tier: ${e.tier}, category: 'earth',\n      detail: '${esc(e.detail)}',\n      link: '${e.link}' }`);
  const file = `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const { bce, ce, ymd, ya } = HT.time;
  HT.events = HT.events || [];
  // Generated by scripts/import-noaa.mjs from the NCEI/WDS Global Significant Earthquake, Tsunami and
  // Volcanic Eruption databases (doi:10.7289/V5TD9V7K), US Government works. Selection: earthquakes with
  // >= 10,000 deaths or M >= 8.5; tsunamis with >= 5,000 deaths not already carried by their quake;
  // eruptions of VEI >= 6 or >= 1,000 deaths. Records within a year of a hand-curated quake/tsunami/eruption
  // event are skipped so the curated entry keeps its place.
  HT.events.push(
    { t: ymd(2015, 1, 1), title: 'Atmospheric CO₂ passes 400 ppm', tier: 4, category: 'earth',
      detail: 'The Mauna Loa annual mean reached 400 ppm in 2015, higher than at any point in the 800,000-year ice-core record, where it swung between about 180 and 300 ppm.',
      link: 'https://en.wikipedia.org/wiki/Carbon_dioxide_in_Earth%27s_atmosphere' },
${lines.join(',\n')}
  );
})(typeof window !== 'undefined' ? window : globalThis);
`;
  writeFileSync(join(ROOT, 'src/data/09-hazards.js'), file);
  console.log(`09-hazards.js: ${out.length} hazard events (+1 curated), ${Math.round(file.length / 1024)} KB`);
}

await climate();
await hazards();
