#!/usr/bin/env node
// Imports launch milestones from Jonathan McDowell's GCAT (CC BY 4.0, planet4589.org) into src/data/12-launches.js:
//   - every human orbital spaceflight launch (matched by programme name; there is no crew flag in launch.tsv)
//   - the first successful orbital launch from each launch site and by each launch vehicle family with >= 10 orbital flights
// Run: node scripts/import-gcat.mjs   (downloads ~14 MB at import time only)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; import script)';
const BASE = 'https://planet4589.org/space/gcat/tsv/';
async function tsv(path) {
  const r = await fetch(BASE + path, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  const text = await r.text();
  const lines = text.split('\n').filter((l) => l && !l.startsWith('# '));
  const cols = lines[0].replace(/^#/, '').split('\t').map((c) => c.trim());
  return lines.slice(1).map((l) => { const f = l.split('\t'); const o = {}; cols.forEach((c, i) => { o[c] = (f[i] || '').trim(); }); return o; });
}
const esc = (s) => String(s)
  .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  .replace(/</g, '\\x3c');
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
// "1969 Jul 16 1332:00" / "1957 Oct 4 1928:34" / "2020 Nov 16 0027:17" / "1961 Apr 12" (with optional '?')
function parseDate(s) {
  const m = /^(\d{4})\s+([A-Z][a-z]{2})\s+(\d{1,2})/.exec(s.replace(/\?/g, ''));
  if (!m) return null;
  return { y: Number(m[1]), m: MONTHS[m[2]], d: Number(m[3]) };
}
const dateText = (t) => `${t.d} ${Object.keys(MONTHS).find((k) => MONTHS[k] === t.m)} ${t.y}`;
const astro = (t) => t.y + (t.m - 1) / 12 + (t.d - 1) / 365.25;

const CREWED = /^(Vostok \d|Voskhod \d|Mercury-Atlas [6-9]|Gemini (3|[4-9]|1[0-2])\b|Apollo (7|8|9|1[0-7])\b|Skylab [234]\b|ASTP|Apollo-Soyuz|Soyuz[ -]?(\d+|T-\d+|TM-\d+|TMA-\d+M?|MS-\d+)$|STS-\d|Shenzhou (5|[6-9]|1\d|2\d)\b|Dragon Crew|Crew-\d|Crew Dragon (Demo-2|Endeavour|Resilience|Endurance|Freedom)|Axiom|Ax-\d|Inspiration4|Polaris Dawn|Fram2|Starliner (CFT|-?1))/;
const CARGO = /Progress|Kosmos|Zond|Tianzhou|Cargo|^Soyuz[ -]?2$/i;                       // Soyuz 2 (1968) flew uncrewed

function curatedSpaceDates() {
  const out = [];
  for (const f of readdirSync(join(ROOT, 'src/data')).sort()) {
    if (f.startsWith('12-')) continue;
    const src = readFileSync(join(ROOT, 'src/data', f), 'utf8');
    const re = /\{\s*t:\s*ymd\((\d+),\s*(\d+),\s*(\d+)\)[^}]*?category:\s*'space'/g;
    let m;
    while ((m = re.exec(src))) out.push(astro({ y: +m[1], m: +m[2], d: +m[3] }));
  }
  return out;
}

const [launches, sites, orgs] = await Promise.all([tsv('launch/launch.tsv'), tsv('tables/sites.tsv'), tsv('tables/orgs.tsv')]);
const siteGeo = new Map(sites.map((s) => [s.Site, [parseFloat(s.Latitude), parseFloat(s.Longitude)]]));
const siteName = new Map(sites.map((s) => [s.Site, s.ShortEName && s.ShortEName !== '-' ? s.ShortEName : s.ShortName || s.Site]));
const orgName = new Map(orgs.map((o) => [o.Code, o.ShortEName && o.ShortEName !== '-' ? o.ShortEName : o.ShortName || o.Code]));
const curated = curatedSpaceDates();
const nearCurated = (a) => curated.some((c) => Math.abs(c - a) < 2 / 365.25);

const orbital = launches.filter((l) => /^O/.test(l.LaunchCode) && parseDate(l.Launch_Date)).sort((a, b) => a.Launch_JD - b.Launch_JD);
console.log(`orbital launches: ${orbital.length}`);
const out = [];
const add = (l, title, detail, tier) => {
  const t = parseDate(l.Launch_Date);
  const a = astro(t);
  if (nearCurated(a)) return;
  const g = siteGeo.get(l.Launch_Site);
  out.push({ t, a, title: clip(title, 80), detail: clip(detail, 300), tier, lat: g && g[0], lon: g && g[1] });
};
const status = (l) => (/^OS/.test(l.LaunchCode) ? 'reached orbit' : /^OF/.test(l.LaunchCode) ? 'failed to reach orbit' : 'outcome unknown');
const where = (l) => `${siteName.get(l.Launch_Site) || l.Launch_Site}${l.Launch_Pad && l.Launch_Pad !== '-' ? ' ' + l.Launch_Pad : ''}`;
const who = (l) => orgName.get(l.Agency) || l.Agency;

// 1. Human spaceflight launches.
let crewed = 0;
for (const l of orbital) {
  const name = l.Flight !== '-' ? l.Flight : l.Mission;
  if (!CREWED.test(name) || CARGO.test(name) || CARGO.test(l.Mission)) continue;
  const failed = /^OF/.test(l.LaunchCode);
  const t = parseDate(l.Launch_Date);
  const early = t.y < 1981;
  add(l, `${name} launches${failed ? ' (launch failure)' : ''}`,
    `Human spaceflight launch of ${name}${l.Mission !== '-' && l.Mission !== name ? ` (${l.Mission})` : ''} on ${dateText(t)}: ${l.LV_Type}${l.Variant !== '-' ? ' ' + l.Variant : ''} from ${where(l)}, launched by ${who(l)}; ${status(l)} (GCAT).`,
    failed ? 5 : early ? 6 : 7);
  crewed++;
}
// 2. First successful orbital launch from each site.
const siteSeen = new Set();
for (const l of orbital) {
  if (!/^OS/.test(l.LaunchCode) || siteSeen.has(l.Launch_Site)) continue;
  siteSeen.add(l.Launch_Site);
  const t = parseDate(l.Launch_Date);
  add(l, `First orbital launch from ${siteName.get(l.Launch_Site) || l.Launch_Site}`,
    `${l.LV_Type} carrying ${l.Mission !== '-' ? l.Mission : l.Flight} reaches orbit from ${where(l)} on ${dateText(t)}, the site's first successful orbital launch, launched by ${who(l)} (GCAT).`, 5);
}
// 3. First successful flight of each launch vehicle family with >= 10 orbital launches.
const lvCount = new Map();
for (const l of orbital) lvCount.set(l.LV_Type, (lvCount.get(l.LV_Type) || 0) + 1);
const lvSeen = new Set();
for (const l of orbital) {
  if (!/^OS/.test(l.LaunchCode) || lvSeen.has(l.LV_Type) || (lvCount.get(l.LV_Type) || 0) < 10) continue;
  lvSeen.add(l.LV_Type);
  const t = parseDate(l.Launch_Date);
  add(l, `${l.LV_Type} first reaches orbit`,
    `First successful orbital launch of the ${l.LV_Type} vehicle, from ${where(l)} on ${dateText(t)} carrying ${l.Mission !== '-' ? l.Mission : l.Flight}, launched by ${who(l)}; the family went on to ${lvCount.get(l.LV_Type)} orbital launches (GCAT).`, 6);
}
console.log(`crewed ${crewed}, sites ${siteSeen.size}, vehicles ${lvSeen.size}`);
// Distinct titles.
out.sort((x, y) => x.a - y.a);
const seen = new Set();
for (const e of out) { let t = e.title; if (seen.has(t.toLowerCase())) t = clip(e.title, 73) + ` (${e.t.y})`; let k = 2; while (seen.has(t.toLowerCase())) t = clip(e.title, 70) + ` (${e.t.y}, ${k++})`; e.title = t; seen.add(t.toLowerCase()); }
const geo = (e) => (Number.isFinite(e.lat) && Number.isFinite(e.lon) ? `, lat: ${Math.round(e.lat * 10) / 10}, lon: ${Math.round(e.lon * 10) / 10}` : '');
const lines = out.map((e) => `    { t: ymd(${e.t.y}, ${e.t.m}, ${e.t.d}), title: '${esc(e.title)}', tier: ${e.tier}, category: 'space', detail: '${esc(e.detail)}'${geo(e)} }`);
const file = `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const { bce, ce, ymd, ya } = HT.time;
  HT.events = HT.events || [];
  // Generated by scripts/import-gcat.mjs. Data from J. McDowell, planet4589.org (GCAT, CC BY 4.0): human
  // orbital spaceflight launches, the first orbital launch from each site and the first flight of each launch
  // vehicle family with >= 10 orbital launches. Launches within two days of a curated space event are skipped.
  HT.events.push(
${lines.join(',\n')}
  );
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(join(ROOT, 'src/data/12-launches.js'), file);
console.log(`12-launches.js: ${out.length} events, ${Math.round(file.length / 1024)} KB`);
