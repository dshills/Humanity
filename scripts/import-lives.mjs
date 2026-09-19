#!/usr/bin/env node
// Imports the lives of notable people into src/data/14-lives.js: one ranged event per person, birth to death,
// flagged `life: true`. The page draws them as a swimlane layer ("Lives") and never in the ordinary event lanes.
//
// Who counts as notable is not decided here. The names come from English Wikipedia's "Vital articles, level 4:
// People" (about 1,900 biographies chosen and balanced across eras, regions and fields by its editors); dates,
// descriptions and birthplaces come from Wikidata (CC0) through the entity API, which, unlike the SPARQL
// endpoint, answers this kind of bulk lookup quickly. Only people with a recorded death are kept: this is a
// history layer, and the living are left out.
// Run: node scripts/import-lives.mjs   (network access needed at import time only)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = { 'User-Agent': 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; import script)' };
const LIST = 'Wikipedia:Vital articles/Level 4/People';
const TOO_BROAD = new Set(['Q6256', 'Q3624078', 'Q3024240', 'Q7275', 'Q48349', 'Q5107', 'Q417175', 'Q1250464', 'Q15634554', 'Q35657', 'Q10864048', 'Q82794']);

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
    const p = Object.values(j.query.pages)[0];
    out = out.concat((p.links || []).map((l) => l.title));
    if (!j.continue) break;
    cont = '&plcontinue=' + encodeURIComponent(j.continue.plcontinue);
  }
  return out;
}

async function entities(params, keys, props) {
  const out = [];
  for (let i = 0; i < keys.length; i += 50) {
    const batch = keys.slice(i, i + 50);
    const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=en%7Cmul&languagefallback=1&props=${props}&${params}=${encodeURIComponent(batch.join('|'))}`);
    for (const e of Object.values(j.entities || {})) if (e && e.id && e.missing === undefined) out.push(e);
    await sleep(150);
  }
  return out;
}

const claimIds = (e, p) => ((e.claims || {})[p] || []).map((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id).filter(Boolean);
// Wikidata's JSON writes BCE years as negative historical years ("-0044-03-15" is 15 March 44 BCE); precision 9 = year.
function bestTime(e, p) {
  const cs = ((e.claims || {})[p] || []).filter((c) => c.rank !== 'deprecated' && c.mainsnak && c.mainsnak.datavalue);
  cs.sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred') || b.mainsnak.datavalue.value.precision - a.mainsnak.datavalue.value.precision);
  for (const c of cs) {
    const v = c.mainsnak.datavalue.value;
    const m = /^([+-])(\d+)-(\d\d)-(\d\d)T/.exec(v.time || '');
    if (!m || v.precision < 9) continue;
    const y = Number(m[2]);
    if (!y) continue;
    return { bce: m[1] === '-', y, m: v.precision >= 10 ? Number(m[3]) || 0 : 0, d: v.precision >= 11 ? Number(m[4]) || 0 : 0 };
  }
  return null;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateExpr = (t) => (t.bce ? (t.m && t.d ? `bce(${t.y}, ${t.m}, ${t.d})` : `bce(${t.y})`) : t.m && t.d ? `ymd(${t.y}, ${t.m}, ${t.d})` : `ce(${t.y})`);
const dateText = (t) => { const yr = t.bce ? `${t.y} BCE` : String(t.y); return t.m && t.d ? `${t.d} ${MONTHS[t.m - 1]} ${yr}` : yr; };
const astro = (t) => (t.bce ? 1 - t.y : t.y) + (t.m ? (t.m - 1) / 12 + (t.d ? (t.d - 1) / 372 : 0) : 0);
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, ' ')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029').replace(/</g, '\\x3c');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

// One of the page's sixteen categories from the person's description; order matters (first match wins).
const FIELDS = [
  [/physician|surgeon|nurse|epidemiolog|anatomist|medical/i, 'medicine'],
  [/computer|programmer|cryptograph/i, 'computing'],
  [/astronaut|cosmonaut|rocket/i, 'space'],
  [/explorer|navigator|conquistador|mountaineer|aviator|traveller|traveler/i, 'exploration'],
  [/physicist|chemist|mathematic|astronom|biolog|naturalist|geolog|scientist|polymath|philosopher|economist|psycholog|sociolog|anthropolog|linguist|logician|botanist|zoolog|historian|geograph/i, 'science'],
  [/inventor|engineer|industrialist|entrepreneur|businessman|businesswoman|architect|printer/i, 'technology'],
  [/prophet|saint|apostle|theolog|pope|monk|religious|rabbi|imam|guru|bishop|missionar|mystic|reformer|buddh|preacher|founder of \w+(ism|ity)\b|religion/i, 'religion'],
  [/general|admiral|military|commander|warrior|marshal|soldier|samurai|warlord/i, 'war'],
  [/emperor|empress|pharaoh|king\b|queen\b|sultan|caliph|khan|tsar|shah|monarch|conqueror|ruler|empire|dynasty|chanyu|shogun|regent/i, 'empire'],
  [/president|prime minister|politician|statesman|stateswoman|revolutionar|chancellor|dictator|activist|diplomat|leader|jurist|lawyer|senator|consul|legislator|lawgiver|envoy|triumvir|chieftain|rebel|gladiator/i, 'politics'],
  [/painter|sculptor|composer|writer|poet|novelist|playwright|author|musician|singer|actor|actress|director|film|artist|pianist|dancer|photograph|designer|essayist|dramatist|songwriter|violinist|cartoonist|animator|comedian|architect|orator/i, 'art'],
];
const fieldOf = (desc) => { for (const [re, cat] of FIELDS) if (re.test(desc)) return cat; return 'civilization'; };

const existingTitles = new Set();
{
  for (const f of readdirSync(join(ROOT, 'src/data')).filter((x) => x.endsWith('.js') && !x.startsWith('14-')).sort()) {
    const text = readFileSync(join(ROOT, 'src/data', f), 'utf8');
    for (const m of text.matchAll(/title:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g)) existingTitles.add((m[1] || m[2]).replace(/\\(.)/g, '$1').toLowerCase());
  }
}

console.log(`reading ${LIST} …`);
const names = await listLinks(LIST);
console.log(`${names.length} linked articles`);
const ents = await entities('sites=enwiki&titles', names, 'claims|descriptions|labels|sitelinks');
console.log(`${ents.length} Wikidata items`);

const NOW_ASTRO = new Date().getUTCFullYear() + new Date().getUTCMonth() / 12;
let people = [];
for (const e of ents) {
  if (!claimIds(e, 'P31').includes('Q5')) continue;                      // bands, families and fictional people drop out here
  const born = bestTime(e, 'P569'); const died = bestTime(e, 'P570');
  if (!born || !died) continue;
  const a = astro(born); const b = astro(died);
  if (!(b > a) || b - a > 125 || b > NOW_ASTRO) continue;               // bad data guard
  // A person is named by the title of their English Wikipedia article, minus any "(disambiguation)": labels on
  // Wikidata can be edited by anyone and sometimes are (Andy Warhol's once read "Andy Warhol TM by Campbell Soup
  // Company"), while an article title only changes through a page move. It is also the common English name.
  const article = e.sitelinks && e.sitelinks.enwiki && e.sitelinks.enwiki.title;
  if (!article) continue;
  const label = article.replace(/ \([^)]*\)$/, '');
  const desc = (e.descriptions && e.descriptions.en && e.descriptions.en.value) || '';
  people.push({ id: e.id, label, article, desc, born, died, a, b, links: Object.keys(e.sitelinks).length, place: claimIds(e, 'P19')[0] || null });
}
console.log(`${people.length} people with a birth and a death`);

// Birthplaces: coordinates of the place itself, never of a country, state, empire or continent.
const placeIds = [...new Set(people.map((p) => p.place).filter(Boolean))];
const places = new Map();
for (const e of await entities('ids', placeIds, 'claims')) {
  if (claimIds(e, 'P31').some((x) => TOO_BROAD.has(x))) continue;
  const c = ((e.claims || {}).P625 || [])[0];
  const v = c && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value;
  if (v && Number.isFinite(v.latitude) && Number.isFinite(v.longitude)) places.set(e.id, [Math.round(v.latitude * 10) / 10, Math.round(v.longitude * 10) / 10]);
}
console.log(`${places.size} of ${placeIds.length} birthplaces located`);

people.sort((x, y) => x.a - y.a);
const used = new Set();
const lines = [];
for (const p of people) {
  let title = clip(p.label, 80).replace(/\.$/, '');       // "Martin Luther King Jr.": titles carry no trailing period
  if (existingTitles.has(title.toLowerCase()) || used.has(title.toLowerCase())) title = clip(`${p.label} (${dateText({ ...p.born, m: 0, d: 0 })}–${dateText({ ...p.died, m: 0, d: 0 })})`, 80);
  if (existingTitles.has(title.toLowerCase()) || used.has(title.toLowerCase())) continue;
  used.add(title.toLowerCase());
  const tier = p.links >= 220 ? 4 : p.links >= 160 ? 5 : p.links >= 110 ? 6 : 7;
  const age = Math.floor(p.b - p.a);
  let detail = p.desc && !/^Q\d+$/.test(p.desc) ? `${cap(p.desc).replace(/\.$/, '')}. ` : '';
  detail += `Lived about ${age} years.`;                  // the panel's date line already gives birth and death
  const geo = p.place && places.get(p.place);
  const link = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.article.replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%28/g, '(').replace(/%29/g, ')');
  lines.push(`    { t: ${dateExpr(p.born)}, end: ${dateExpr(p.died)}, title: '${esc(title)}', tier: ${tier}, category: '${fieldOf(p.desc)}', detail: '${esc(clip(detail, 300))}', link: '${esc(link)}'${geo ? `, lat: ${geo[0]}, lon: ${geo[1]}` : ''}, life: true }`);
}

const file = `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const { bce, ce, ymd, ya } = HT.time;
  HT.events = HT.events || [];
  // Generated by scripts/import-lives.mjs. The people are those of English Wikipedia's "Vital articles, level 4:
  // People" who have died; dates, descriptions and birthplaces are from Wikidata (CC0). Each is a ranged event
  // from birth to death flagged \`life\`, drawn only in the Lives layer. lat/lon, when present, is the birthplace.
  // Dates are as recorded in Wikidata (Julian before 1582).
  HT.events.push(
${lines.join(',\n')}
  );
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(join(ROOT, 'src/data/14-lives.js'), file);
console.log(`14-lives.js: ${lines.length} lives, ${Math.round(file.length / 1024)} KB`);
