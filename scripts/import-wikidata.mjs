#!/usr/bin/env node
// Imports battles and office-holders (rulers, heads of state and government) from Wikidata (CC0) into
//   src/data/10-wikidata.js
// Selection: battles with >= 20 sitelinks and a dated point in time; holders of a curated list of offices
// with a dated start and >= 25 sitelinks. Titles/descriptions are Wikidata's own (CC0); links go to the
// English Wikipedia article when one exists, else to the Wikidata item.
// Run: node scripts/import-wikidata.mjs   (network access needed at import time only)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; import script)';
const ENDPOINT = 'https://query.wikidata.org/sparql';
const BATTLE_MIN_SITELINKS = 20;
const RULER_MIN_SITELINKS = 35;

// Office item(s), short title used after the holder's name, event category, and optionally the swimlane the
// holders share. An office that was renamed or refounded lists every item that continues it, so its lane runs
// on to the present instead of stopping at the rename (Reich and Federal chancellors; England, Great Britain, UK).
const OFFICES = [
  ['Q37110', 'pharaoh', 'empire'],
  ['Q28124026', 'king of Assyria', 'empire'],
  ['Q28132899', 'king of Babylon', 'empire'],
  ['Q842606', 'Roman emperor', 'empire'],
  ['Q18577504', 'Byzantine emperor', 'empire'],
  ['Q268218', 'emperor of China', 'empire'],
  ['Q208233', 'emperor of Japan', 'empire'],
  ['Q19546', 'pope', 'religion'],
  ['Q28541943', 'Abbasid caliph', 'religion'],
  ['Q181765', 'Holy Roman Emperor', 'empire'],
  ['Q18384454', 'king of France', 'empire'],
  ['Q18810062', 'monarch of England', 'empire', 'English and British monarch'],
  ['Q110324075', 'monarch of Great Britain', 'empire', 'English and British monarch'],
  [['Q111722535', 'Q9134365'], 'monarch of the United Kingdom', 'empire', 'English and British monarch'],
  ['Q187878', 'khagan', 'empire'],
  ['Q4115925', 'sultan of Egypt', 'empire'],
  ['Q15315411', 'Ottoman sultan', 'empire'],
  ['Q10962705', 'emperor of Ethiopia', 'empire'],
  ['Q15390704', 'Mughal emperor', 'empire'],
  ['Q165948', 'Sapa Inca', 'empire'],
  ['Q16104362', 'tlatoani', 'empire'],
  ['Q887176', 'Oba of Benin', 'empire'],
  ['Q3847454', 'monarch of Spain', 'empire'],
  ['Q58800860', 'monarch of Portugal', 'empire'],
  ['Q3240735', 'king of Prussia', 'empire'],
  ['Q2618625', 'emperor of Russia', 'empire'],
  ['Q11696', 'president of the United States', 'politics'],
  ['Q14211', 'prime minister of the United Kingdom', 'politics'],
  ['Q191954', 'president of France', 'politics'],
  [['Q56022', 'Q4970706'], 'chancellor of Germany', 'politics'],
  ['Q1048744', 'general secretary of the CPSU', 'politics'],
  ['Q2708520', 'chairman of the Chinese Communist Party', 'politics'],
  ['Q849418', 'general secretary of the Chinese Communist Party', 'politics'],
  ['Q218295', 'president of Russia', 'politics'],
  ['Q192711', 'prime minister of India', 'politics'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sparql(query, attempt = 1) {
  const r = await fetch(ENDPOINT + '?format=json&query=' + encodeURIComponent(query), {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!r.ok) {
    if (attempt < 4 && (r.status === 429 || r.status >= 500)) { await sleep(3000 * attempt); return sparql(query, attempt + 1); }
    throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  return (await r.json()).results.bindings;
}
const val = (b, k) => (b[k] ? b[k].value : undefined);

// SPARQL returns xsd:dateTime, whose years are astronomical (year 0 = 1 BCE, -0050 = 51 BCE) + precision.
function parseTime(str, precision) {
  const m = /^([+-]?)(\d+)-(\d\d)-(\d\d)T/.exec(str || '');    // JSON results omit the leading + on CE dates
  if (!m) return null;
  const y = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  const mo = Number(m[3]) || 1;
  const d = Number(m[4]) || 1;
  const p = Number(precision || 9);
  if (p < 9) return null;                                                // decade/century precision
  return { y, m: p >= 10 ? mo : 0, d: p >= 11 ? d : 0 };
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateExpr(t) {
  if (t.y <= 0) return t.m && t.d ? `bce(${1 - t.y}, ${t.m}, ${t.d})` : `bce(${1 - t.y})`;
  return t.m && t.d ? `ymd(${t.y}, ${t.m}, ${t.d})` : t.m ? `ymd(${t.y}, ${t.m}, 1)` : `ce(${t.y})`;
}
function dateText(t) {
  const yr = t.y <= 0 ? `${1 - t.y} BCE` : String(t.y);
  return t.m && t.d ? `${t.d} ${MONTHS[t.m - 1]} ${yr}` : t.m ? `${MONTHS[t.m - 1]} ${yr}` : yr;
}
const astro = (t) => t.y + ((t.m || 1) - 1) / 12;
const esc = (s) => String(s)
  .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  .replace(/</g, '\\x3c');                                            // never emit "</script>" into the inline bundle
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
const NOW_ASTRO = new Date().getUTCFullYear() + new Date().getUTCMonth() / 12;   // events after today are excluded

// "Point(lon lat)" -> [lat, lon]
function point(wkt) {
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(wkt || '');
  return m ? [Math.round(parseFloat(m[2]) * 10) / 10, Math.round(parseFloat(m[1]) * 10) / 10] : null;
}

// Blended significance (pageviews + sitelinks) from scripts/score-significance.mjs, when it has been run:
// thresholds[k] is the lowest score a curated tier-k event holds, so imports land on the curated scale.
let SIG = null;
try { SIG = JSON.parse(readFileSync(join(ROOT, 'scripts/cache/significance.json'), 'utf8')); } catch (e) { /* fall back to sitelinks */ }
// Imports lean on sitelinks (70%) over English pageviews (30%): pageviews skew to anglophone subjects (every US
// president outranks most emperors), while sitelinks count language editions. The blended score is read against
// the curated thresholds and then compressed, so only the most prominent imports reach tier 3.
let SIG_STATS = null;
function sigStats() {
  if (SIG_STATS || !SIG) return SIG_STATS;
  const rows = Object.values(SIG.titles);
  const stat = (f) => { const xs = rows.map(f); const m = xs.reduce((x, y) => x + y, 0) / xs.length; const sd = Math.sqrt(xs.reduce((x, y) => x + (y - m) ** 2, 0) / xs.length) || 1; return { m, sd }; };
  SIG_STATS = { v: stat((d) => Math.log10(1 + (d.views || 0))), s: stat((d) => Math.log10(1 + (d.sitelinks || 0))) };
  return SIG_STATS;
}
const COMPRESS = [3, 3, 4, 4, 5, 6, 7, 7];                                // curated-scale tier -> import tier
function blendedTier(article, fallback, floor, year) {
  if (!SIG || !SIG.thresholds || !article) return fallback;
  const d = SIG.titles[article.slice('https://en.wikipedia.org/wiki/'.length)];
  if (!d) return fallback;
  const st = sigStats();
  const score = 0.3 * (Math.log10(1 + (d.views || 0)) - st.v.m) / st.v.sd + 0.7 * (Math.log10(1 + (d.sitelinks || 0)) - st.s.m) / st.s.sd;
  let tier = 7;
  for (let k = 0; k < SIG.thresholds.length; k++) if (score >= SIG.thresholds[k]) { tier = k; break; }
  // Recent figures are over-covered in every language edition: one tier down after 1800.
  return Math.min(7, Math.max(floor, COMPRESS[tier]) + (year >= 1800 ? 1 : 0));
}

function curated() {
  const events = [];
  for (const f of readdirSync(join(ROOT, 'src/data')).sort()) {
    if (f.startsWith('10-')) continue;
    const src = readFileSync(join(ROOT, 'src/data', f), 'utf8');
    const re = /\{\s*t:\s*(bce|ce|ymd|ya)\(([^)]*)\)[^}]*?title:\s*(['"])(.*?)\3/g;
    let m;
    while ((m = re.exec(src))) {
      const a = m[2].split(',').map((x) => parseFloat(x));
      const y = m[1] === 'bce' ? 1 - a[0] : m[1] === 'ya' ? 1950 - a[0] : a[0];
      events.push({ y, title: m[4] });
    }
  }
  return events;
}

async function battles(existing) {
  // The location fallback skips places that are countries, states, empires or continents (same list as import-geo.mjs).
  const q = `SELECT ?b ?bLabel ?bDescription ?d ?prec ?s ?article ?warLabel ?locLabel ?countryLabel ?coord ?locCoord WHERE {
  ?b wdt:P31/wdt:P279* wd:Q178561 ; wikibase:sitelinks ?s . FILTER(?s >= ${BATTLE_MIN_SITELINKS})
  ?b p:P585 ?ds . ?ds ps:P585 ?d ; psv:P585 [ wikibase:timePrecision ?prec ] .
  OPTIONAL { ?b wdt:P361 ?war . }
  OPTIONAL { ?b wdt:P625 ?coord . }
  OPTIONAL { ?b wdt:P276 ?loc . OPTIONAL { ?loc wdt:P625 ?locCoord . FILTER NOT EXISTS { ?loc wdt:P31 ?broad . VALUES ?broad { wd:Q6256 wd:Q3624078 wd:Q3024240 wd:Q7275 wd:Q48349 wd:Q5107 wd:Q417175 wd:Q1250464 wd:Q15634554 wd:Q35657 wd:Q10864048 wd:Q82794 } } } }
  OPTIONAL { ?b wdt:P17 ?country . }
  OPTIONAL { ?article schema:about ?b ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
  const rows = await sparql(q);
  const byItem = new Map();
  for (const r of rows) {                                            // several P585 values: keep the earliest
    const t = parseTime(val(r, 'd'), val(r, 'prec'));
    if (!t) continue;
    const id = val(r, 'b');
    const prev = byItem.get(id);
    if (!prev || astro(t) < astro(prev.t)) byItem.set(id, { r, t });
  }
  const out = [];
  for (const { r, t } of byItem.values()) {
    const label = val(r, 'bLabel') || '';
    if (!label || /^Q\d+$/.test(label)) continue;
    const y = astro(t);
    if (y > NOW_ASTRO) continue;
    // Skip when a curated event of the same year already names the place.
    const place = label.replace(/^(First |Second |Third |Fourth )?(Battle|Siege|Sack|Capture|Fall|Bombardment|Raid) (of|at|on) (the )?/i, '').split(/[(,]/)[0].trim();
    if (place.length >= 4 && existing.some((e) => Math.abs(e.y - y) <= 1 && e.title.toLowerCase().includes(place.toLowerCase()))) continue;
    const s = Number(val(r, 's'));
    const tier = blendedTier(val(r, 'article'), s >= 90 ? 3 : s >= 55 ? 4 : s >= 35 ? 5 : 6, 3, y);
    const geo = point(val(r, 'coord')) || point(val(r, 'locCoord'));
    const desc = cap(val(r, 'bDescription') || 'battle');
    const war = val(r, 'warLabel'); const loc = val(r, 'locLabel'); const country = val(r, 'countryLabel');
    let detail = `${desc}, fought ${dateText(t)}`;
    if (loc && !/^Q\d+$/.test(loc)) detail += ` at ${loc}`;
    if (country && !/^Q\d+$/.test(country) && country !== loc) detail += `${loc ? ',' : ' in'} ${country}`;
    if (war && !/^Q\d+$/.test(war) && !desc.toLowerCase().includes(war.toLowerCase())) detail += `; part of the ${war}`;
    detail += '.';
    out.push({ t: dateExpr(t), y, geo, title: clip(label, 80), detail: clip(detail, 300), tier, category: 'war',
      link: val(r, 'article') || `https://www.wikidata.org/wiki/${val(r, 'b').split('/').pop()}` });
  }
  return out;
}

async function rulers(existing) {
  const out = [];
  for (const [qids, office, category, lane] of OFFICES) {
    // The label service sometimes hands back a bare item id (it did for Donald Trump, Emmanuel Macron and four
    // recent British prime ministers), which used to drop the row. Ask for the English label directly and fall
    // back to the article title, so a holder is only skipped when there is truly no English name.
    const q = `SELECT ?p ?lab ?pLabel ?pDescription ?start ?sprec ?end ?dod ?s ?article ?office WHERE {
  VALUES ?office { ${[].concat(qids).map((id) => 'wd:' + id).join(' ')} }
  ?p p:P39 ?st . ?st ps:P39 ?office ; pq:P580 ?start ; pqv:P580 [ wikibase:timePrecision ?sprec ] .
  OPTIONAL { ?st pq:P582 ?end . }
  OPTIONAL { ?p wdt:P570 ?dod . }
  OPTIONAL { ?p rdfs:label ?lab . FILTER(LANG(?lab) = "en") }
  ?p wdt:P31 wd:Q5 ; wikibase:sitelinks ?s . FILTER(?s >= ${RULER_MIN_SITELINKS})
  OPTIONAL { ?article schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
    let rows;
    try { rows = await sparql(q); } catch (e) { console.error(`office ${office}: ${e.message}`); continue; }
    const found = [];
    for (const r of rows) {
      const t = parseTime(val(r, 'start'), val(r, 'sprec'));
      if (!t) continue;
      let label = val(r, 'lab') || val(r, 'pLabel') || '';
      if ((!label || /^Q\d+$/.test(label)) && val(r, 'article')) {
        try { label = decodeURIComponent(val(r, 'article').split('/wiki/')[1] || '').replace(/_/g, ' ').replace(/ \([^)]*\)$/, ''); } catch (e) { label = ''; }
      }
      if (!label || /^Q\d+$/.test(label)) continue;
      const y = astro(t);
      if (y > NOW_ASTRO) continue;
      const endT = val(r, 'end') ? parseTime(val(r, 'end'), 11) : null;
      found.push({ r, t, y, label, endT: endT && astro(endT) > y ? endT : null });
    }
    // The sitting holder: the latest start in the office, with no end date and no date of death. Historical
    // statements that merely lack an end (Puyi, Lady Jane Grey, one-month popes) stay point events.
    const latest = found.reduce((m, f) => Math.max(m, f.y), -Infinity);
    let n = 0;
    for (const f of found) {
      const { r, t, y, label, endT } = f;
      const ongoing = !endT && !val(r, 'end') && !val(r, 'dod') && y === latest;
      const s = Number(val(r, 's'));
      const tier = blendedTier(val(r, 'article'), s >= 250 ? 3 : s >= 140 ? 4 : s >= 70 ? 5 : s >= 40 ? 6 : 7, 3, y);
      const desc = val(r, 'pDescription');
      const span = ongoing ? `since ${dateText(t)}` : `${dateText(t)}${endT ? ` to ${dateText(endT)}` : ''}`;
      // Wikidata descriptions often already say the office ("President of the United States from 1861 to 1865");
      // then only the precise dates are added, otherwise the office sentence is.
      const officeWord = office.replace(/^(king|monarch|emperor|president|prime minister|chancellor|sultan|general secretary|chairman) of (the )?/i, '').split(' ')[0];
      let detail = desc && !/^Q\d+$/.test(desc) ? `${cap(desc).replace(/\.$/, '')}. ` : '';
      detail += detail && new RegExp(officeWord, 'i').test(desc) ? `In office ${span}.` : `${cap(office)} ${span}.`;
      const title = clip(`${label}, ${office}`, 80);
      if (existing.some((e) => e.title.toLowerCase() === title.toLowerCase())) continue;
      out.push({ t: dateExpr(t), y, end: endT ? dateExpr(endT) : null, endY: endT ? astro(endT) : null, ongoing, title, detail: clip(detail, 300),
        tier, category, group: lane || office, link: val(r, 'article') || `https://www.wikidata.org/wiki/${val(r, 'p').split('/').pop()}`, key: val(r, 'p') + '|' + office + '|' + Math.floor(y) });
      n++;
    }
    console.log(`${office}: ${n}${found.some((f) => !f.endT && !val(f.r, 'dod') && f.y === latest) ? ' (sitting holder found)' : ''}`);
    await sleep(600);
  }
  // One entry per person/office/start (duplicate statements happen); then distinct titles.
  const seenKey = new Set();
  const dedup = out.filter((e) => (seenKey.has(e.key) ? false : (seenKey.add(e.key), true)));
  // An office split across items (the UK crown before and after 1927) yields back-to-back statements for one
  // person under one title: join them into a single reign.
  dedup.sort((a, b) => a.y - b.y);
  const joined = [];
  for (const e of dedup) {
    const person = (x) => x.key.split('|')[0];
    const prev = joined.filter((p) => person(p) === person(e) && p.title === e.title && p.endY !== null && Math.abs(p.endY - e.y) < 0.2).pop();
    if (prev) {
      const tail = / to ([^.]*)\.$/.exec(e.detail);
      prev.detail = prev.detail.replace(/ to [^.]*\.$/, e.ongoing ? ' to the present.' : tail ? ` to ${tail[1]}.` : '.');
      prev.end = e.end; prev.endY = e.endY; prev.ongoing = e.ongoing;
      continue;
    }
    joined.push(e);
  }
  return joined;
}

const existing = curated();
const B = await battles(existing);
console.log(`battles: ${B.length}`);
const R = await rulers(existing);
console.log(`rulers: ${R.length}`);
const all = [...B, ...R].sort((a, b) => a.y - b.y);
const seen = new Map();
for (const e of all) seen.set(e.title.toLowerCase(), (seen.get(e.title.toLowerCase()) || 0) + 1);
const used = new Set();
for (const e of all) {
  const k = e.title.toLowerCase();
  if (seen.get(k) > 1 || used.has(k)) {
    const yr = e.y < 1 ? `${1 - Math.floor(e.y)} BCE` : String(Math.floor(e.y));
    const suffix = ` (${yr})`;
    e.title = clip(e.title.replace(/…$/, ''), 80 - suffix.length) + suffix;
  }
  used.add(e.title.toLowerCase());
}
const lines = all.map((e) => `    { t: ${e.t},${e.end ? ` end: ${e.end},` : ''} title: '${esc(e.title)}', tier: ${e.tier}, category: '${e.category}', detail: '${esc(e.detail)}', link: '${e.link}'${e.geo ? `, lat: ${e.geo[0]}, lon: ${e.geo[1]}` : ''}${e.group ? `, group: '${esc(e.group)}'` : ''}${e.ongoing ? ', ongoing: true' : ''} }`);
const file = `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const { bce, ce, ymd, ya } = HT.time;
  HT.events = HT.events || [];
  // Generated by scripts/import-wikidata.mjs from Wikidata (CC0): battles with >= ${BATTLE_MIN_SITELINKS} sitelinks and a
  // dated point in time, and holders of ${OFFICES.length} offices (reigns and terms as ranged events) with >= ${RULER_MIN_SITELINKS}
  // sitelinks. Battles that a curated event of the same year already names are skipped. Significance tiers come
  // from sitelink counts. Dates are as recorded in Wikidata (Julian before 1582).
  HT.events.push(
${lines.join(',\n')}
  );
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(join(ROOT, 'src/data/10-wikidata.js'), file);
console.log(`10-wikidata.js: ${all.length} events, ${Math.round(file.length / 1024)} KB`);
