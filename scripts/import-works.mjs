#!/usr/bin/env node
// Imports landmark creative works into src/data/15-works.js: books, plays, poems, music, paintings, sculpture,
// buildings and films, each an ordinary point event in the `art` category dated by its publication, creation
// or first performance.
//
// As with the Lives layer, the selection is not made here. The titles come from English Wikipedia's "Vital
// articles, level 4: Arts" (about 700 articles chosen by its editors); roughly a third of them are individual
// works, the rest genres, movements, instruments and techniques, which are dropped. Dates, descriptions,
// creators and sites come from Wikidata (CC0) through the entity API.
// Run: node scripts/import-works.mjs   (network access needed at import time only; WORKS_CACHE=<file> reuses a dump)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; import script)' };
const LIST = 'Wikipedia:Vital articles/Level 4/Arts';
// An item is kept only if none of its "instance of" values reads like a kind of thing rather than a thing.
const NOT_A_WORK = /genre|movement|style|type of|family of|class of|discipline|profession|occupation|field of|technique|form\b|by country|by period|of an area|geographic|museum|franchise|institution|organi[sz]ation|award|festival|company|school|tradition|concept|term|industry|human|group|orchestra|band\b|theat(er|re) (company|troupe)/i;
// A premiere dates a play, an opera or a symphony best, publication a book or a film, and inception (which for
// a novel is often when writing began, and for a building when work started) is the fallback.
const DATE_PROPS = ['P1191', 'P577', 'P1619', 'P571']; // first performance, publication, official opening, inception
const SKIP = new Set(['Kaaba']);                       // its Wikidata inception is one rebuilding of many: no honest single date
const CREATOR_PROPS = ['P50', 'P57', 'P170', 'P86', 'P84'];   // author, director, creator, composer, architect
const PERFORMER = 'P175';                                     // for a record, the artist, who may be a band

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, attempt = 1) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) {
    if (attempt < 4 && (r.status === 429 || r.status >= 500)) { await sleep(2000 * attempt); return getJson(url, attempt + 1); }
    throw new Error(`${r.status} for ${url.slice(0, 120)}`);
  }
  return r.json();
}
async function listLinks(page) {
  let out = []; let cont = '';
  for (;;) {
    const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=links&plnamespace=0&pllimit=max&titles=${encodeURIComponent(page)}${cont}`);
    out = out.concat((Object.values(j.query.pages)[0].links || []).map((l) => l.title));
    if (!j.continue) break;
    cont = '&plcontinue=' + encodeURIComponent(j.continue.plcontinue);
  }
  return out;
}
async function entities(params, keys, props) {
  const out = [];
  for (let i = 0; i < keys.length; i += 50) {
    const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=en%7Cmul&languagefallback=1&props=${props}&${params}=${encodeURIComponent(keys.slice(i, i + 50).join('|'))}`);
    for (const e of Object.values(j.entities || {})) if (e && e.id && e.missing === undefined) out.push(e);
    await sleep(150);
  }
  return out;
}
const labelOf = (e) => e && e.labels && ((e.labels.en && e.labels.en.value) || (e.labels.mul && e.labels.mul.value));
const claimIds = (e, p) => ((e.claims || {})[p] || []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id).filter(Boolean);

// The earliest value of the first dated property in DATE_PROPS. Wikidata's JSON writes BCE years as negative
// historical years; precision 9 = year, 8 = decade, 7 = century (kept, and described as approximate).
function earliestDate(e) {
  for (const p of DATE_PROPS) {
    let best = null;
    for (const c of (e.claims || {})[p] || []) {
      const v = c.rank !== 'deprecated' && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value;
      const m = v && /^([+-])(\d+)-(\d\d)-(\d\d)T/.exec(v.time || '');
      if (!m || v.precision < 7 || !Number(m[2])) continue;
      let yy = Number(m[2]);
      // Decades and centuries are stored by a boundary year ("+2000" with century precision is the 20th century,
      // "-0800" the 8th BCE): use the middle of the period. A century is no way to date anything since 1500.
      if (v.precision === 7) { if (m[1] === '+' && yy > 1500) continue; if (yy % 100 === 0) yy = Math.max(1, yy - 50); }
      if (v.precision === 8 && yy % 10 === 0) yy = m[1] === '-' ? Math.max(1, yy - 5) : yy + 5;
      const t = { bce: m[1] === '-', y: yy, m: v.precision >= 10 ? Number(m[3]) || 0 : 0, d: v.precision >= 11 ? Number(m[4]) || 0 : 0, precision: v.precision };
      const a = (t.bce ? 1 - t.y : t.y) + (t.m ? (t.m - 1) / 12 : 0);
      if (!best || a < best.a) best = { t, a };
    }
    if (best) {
      // A publication date far later than the work's inception is a later edition (In Search of Lost Time, 2000).
      if (p === 'P577') { const made = earliestDate({ claims: { P571: (e.claims || {}).P571 } }); if (made && best.a - made.a > 25) return made; }
      return best;
    }
  }
  return null;
}
const dateExpr = (t) => (t.bce ? `bce(${t.y})` : t.m && t.d ? `ymd(${t.y}, ${t.m}, ${t.d})` : `ce(${t.y})`);
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, ' ')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029').replace(/</g, '\\x3c');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

// What is already on the timeline: every article linked from a data file, every title (for uniqueness), and the
// hand-curated events with their dates, read by evaluating the files the way the page does.
const knownArticles = new Set();
const allTitles = new Set();
const curated = [];
{
  const box = vm.createContext({});
  vm.runInContext(readFileSync(join(ROOT, 'src/time.js'), 'utf8'), box);
  for (const f of readdirSync(join(ROOT, 'src/data')).filter((x) => x.endsWith('.js') && !x.startsWith('15-')).sort()) {
    const before = (box.HT.events || []).length;
    vm.runInContext(readFileSync(join(ROOT, 'src/data', f), 'utf8'), box);
    for (const ev of box.HT.events.slice(before)) {
      allTitles.add(String(ev.title).toLowerCase());
      const m = /^https:\/\/en\.wikipedia\.org\/wiki\/(.+)$/.exec(ev.link || '');
      if (m) { try { knownArticles.add(decodeURIComponent(m[1]).replace(/_/g, ' ')); } catch (err) { /* keep going */ } }
      if (/^0[1-8]-/.test(f)) curated.push({ title: String(ev.title).toLowerCase(), t: ev.t, end: Number.isFinite(ev.end) ? ev.end : ev.t });
    }
  }
}
// A curated event already tells a work's story when it names it as whole words and lies within fifty years of
// it: "Homer's Iliad and Odyssey are composed" covers both epics, but "Romans ... found the Republic" (509 BCE)
// does not cover Plato's Republic.
function alreadyTold(name, a) {
  if (name.length < 4) return false;
  const re = new RegExp('(^|[^a-z0-9])' + name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])');
  return curated.some((c) => a >= c.t - 50 && a <= c.end + 50 && re.test(c.title));
}

let ents;
if (process.env.WORKS_CACHE && existsSync(process.env.WORKS_CACHE)) {
  ents = JSON.parse(readFileSync(process.env.WORKS_CACHE, 'utf8'));
  console.log(`${ents.length} Wikidata items from ${process.env.WORKS_CACHE}`);
} else {
  console.log(`reading ${LIST} …`);
  const names = await listLinks(LIST);
  ents = await entities('sites=enwiki&titles', names, 'claims|descriptions|labels|sitelinks');
  console.log(`${names.length} linked articles, ${ents.length} Wikidata items`);
}

// Labels for every "instance of" value and every creator in one pass.
const need = new Set();
for (const e of ents) { for (const id of claimIds(e, 'P31')) need.add(id); for (const p of CREATOR_PROPS.concat([PERFORMER])) for (const id of claimIds(e, p).slice(0, 2)) need.add(id); }
const names2 = new Map();
const isHuman = new Set();
// A creator is named by the title of their English Wikipedia article when there is one: labels on Wikidata can
// be edited by anyone and sometimes are (Andy Warhol's read "Andy Warhol TM by Campbell Soup Company" when this
// was written), while an article title only changes through a page move.
for (const e of await entities('ids', [...need], 'labels|claims|sitelinks&sitefilter=enwiki')) {
  const page = e.sitelinks && e.sitelinks.enwiki && e.sitelinks.enwiki.title;
  names2.set(e.id, (page ? page.replace(/ \([^)]*\)$/, '') : labelOf(e)) || '');
  if (claimIds(e, 'P31').includes('Q5')) isHuman.add(e.id);
}

const NOW_ASTRO = new Date().getUTCFullYear() + new Date().getUTCMonth() / 12;
const works = [];
let dropped = { kind: 0, undated: 0, known: 0 };
for (const e of ents) {
  const label = labelOf(e);
  const article = e.sitelinks && e.sitelinks.enwiki && e.sitelinks.enwiki.title;
  if (!label || !article || SKIP.has(article)) continue;
  const kinds = claimIds(e, 'P31').map((id) => names2.get(id) || '');
  if (!kinds.length || kinds.some((k) => NOT_A_WORK.test(k))) { dropped.kind++; continue; }
  const date = earliestDate(e);
  if (!date || date.a > NOW_ASTRO) { dropped.undated++; continue; }
  if (knownArticles.has(article) || alreadyTold(article.replace(/ \([^)]*\)$/, ''), date.a)) { dropped.known++; continue; }
  let creators = [];
  // Only people are credited: "by anonymous" and "by Ancient Celts" say nothing.
  for (const p of CREATOR_PROPS) { creators = claimIds(e, p).filter((id) => isHuman.has(id)).slice(0, 2).map((id) => names2.get(id)).filter(Boolean); if (creators.length) break; }
  if (!creators.length) creators = claimIds(e, PERFORMER).slice(0, 1).map((id) => names2.get(id)).filter(Boolean);
  const coord = ((e.claims || {}).P625 || [])[0];
  const cv = coord && coord.mainsnak && coord.mainsnak.datavalue && coord.mainsnak.datavalue.value;
  // The article title is the common English name ("Sagrada Família", not the Wikidata label's official one).
  const name = article.replace(/ \([^)]*\)$/, '');
  works.push({ label: name, article, date, kinds, creators, desc: (e.descriptions && e.descriptions.en && e.descriptions.en.value) || '',
    links: Object.keys(e.sitelinks).length, geo: cv && Number.isFinite(cv.latitude) ? [Math.round(cv.latitude * 10) / 10, Math.round(cv.longitude * 10) / 10] : null });
}
console.log(`${works.length} works; dropped ${dropped.kind} that are kinds of thing, ${dropped.undated} undated, ${dropped.known} already on the timeline`);

works.sort((a, b) => a.date.a - b.date.a);
const used = new Set();
const lines = [];
for (const w of works) {
  const by = w.creators.length ? ` by ${w.creators.join(' and ')}` : '';
  let title = clip(`${w.label}${by}`, 80).replace(/\.$/, '');
  if (allTitles.has(title.toLowerCase()) || used.has(title.toLowerCase())) title = clip(`${w.label}${by} (${w.kinds[0]})`, 80).replace(/\.$/, '');
  if (allTitles.has(title.toLowerCase()) || used.has(title.toLowerCase())) continue;
  used.add(title.toLowerCase());
  // Language editions stand in for reach; works since 1800 sit one tier finer, as the other imports do.
  let tier = w.links >= 130 ? 5 : w.links >= 75 ? 6 : 7;
  if (w.date.a >= 1800) tier = Math.min(7, tier + 1);
  const approx = w.date.t.precision === 7 ? ' The date is known only to the century.' : w.date.t.precision === 8 ? ' The date is known only to the decade.' : '';
  let detail = w.desc && !/^Q\d+$/.test(w.desc) ? `${cap(w.desc).replace(/\.$/, '')}.` : `${cap(w.kinds[0])}${by}.`;
  if (detail.length < 24) detail = `${cap(w.kinds[0])}${by}: ${detail}`;
  detail = clip(detail + approx, 300);
  if (detail.length < 20) detail = clip(`${detail} One of Wikipedia's vital articles on the arts.`, 300);
  const link = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(w.article.replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%28/g, '(').replace(/%29/g, ')');
  lines.push(`    { t: ${dateExpr(w.date.t)}, title: '${esc(title)}', tier: ${tier}, category: '${/philosoph|treatise|encyclop|histor(y|ical) (work|text|book)|economic|scientific|political/i.test(w.desc) ? 'science' : /scripture|bible|religious text|sacred/i.test(w.desc) ? 'religion' : 'art'}', detail: '${esc(detail)}', link: '${esc(link)}'${w.geo ? `, lat: ${w.geo[0]}, lon: ${w.geo[1]}` : ''} }`);
}

const file = `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const { bce, ce, ymd, ya } = HT.time;
  HT.events = HT.events || [];
  // Generated by scripts/import-works.mjs: the individual works among English Wikipedia's "Vital articles,
  // level 4: Arts", dated by publication, creation or first performance from Wikidata (CC0). Works already
  // on the timeline (same article, or named by a curated event) are left out. lat/lon is the work's own site.
  HT.events.push(
${lines.join(',\n')}
  );
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(join(ROOT, 'src/data/15-works.js'), file);
console.log(`15-works.js: ${lines.length} works, ${Math.round(file.length / 1024)} KB`);
