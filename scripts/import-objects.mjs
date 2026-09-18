#!/usr/bin/env node
// Pairs selected events with a museum object and writes src/objects.js:
//   HT.objects = { "<event title>": { museum, title, maker, date, url, img, credit } }
// Sources: The Metropolitan Museum of Art Open Access API and the Cleveland Museum of Art Open Access API (both CC0,
// no key). Each pairing names a query and an expected pattern; an object is accepted only when it is public domain /
// CC0, has an image, and its title, maker, culture or period matches the pattern. Nothing is accepted on rank alone.
// Run: node scripts/import-objects.mjs
import { writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; import script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) {
  for (let a = 1; a <= 3; a++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    await sleep(1500 * a);
  }
  return null;
}
// [event title pattern, museum, search query, pattern the object must match]
const PAIRS = [
  [/^Sumerians invent cuneiform/, 'met', 'cuneiform tablet', /cuneiform tablet/i],
  [/^Hatshepsut sends/, 'met', 'Seated Statue of Hatshepsut', /Hatshepsut/i],
  [/^Howard Carter finds the tomb/, 'met', 'Tutankhamun', /Tutankhamun/i],
  [/^Lydia strikes/, 'met', 'Lydia electrum coin', /Lydia|electrum/i],
  [/^Kofun period/, 'met', 'Haniwa', /Haniwa/i],
  [/^Socrates is tried/, 'met', 'The Death of Socrates', /Death of Socrates/i],
  [/^Aristotle founds/, 'met', 'Aristotle with a Bust of Homer', /Aristotle/i],
  [/^Alexander the Great conquers/, 'met', 'Alexander the Great', /Alexander/i],
  [/^Siddhartha Gautama/, 'met', 'Standing Buddha Gandhara', /Buddha/i],
  [/^Octavian becomes Augustus/, 'met', 'portrait emperor Augustus', /Augustus/i],
  [/^Moche culture/, 'met', 'Moche portrait vessel', /Moche/i],
  [/^Maya Classic/, 'met', 'Maya vessel', /Maya/i],
  [/^Chandragupta I founds/, 'met', 'Gupta period Buddha', /Gupta/i],
  [/^Hagia Sophia/, 'met', 'Byzantine processional cross', /Byzantine|Cross/i],
  [/^Tang dynasty/, 'cma', 'Tang dynasty horse', /Tang|Horse/i],
  [/^Viking Age/, 'met', 'Viking sword', /Viking/i],
  [/^Song dynasty/, 'met', 'Finches and bamboo', /Finches/i],
  [/^Murasaki Shikibu/, 'met', 'Tale of Genji', /Genji/i],
  [/^Ferdowsi completes/, 'met', 'Shahnama Shah Tahmasp', /Shahnama/i],
  [/^Angkor Wat/, 'cma', 'Angkor', /Angkor|Cambodia|Khmer/i],
  [/^Aztecs found Tenochtitlan/, 'met', 'Aztec sculpture', /Aztec|Mexica/i],
  [/^Inca Empire expands/, 'met', 'Inca tunic', /Inca/i],
  [/^Ming dynasty/, 'met', 'Ming dynasty porcelain jar dragon', /Ming/i],
  [/^Columbus reaches/, 'met', 'Portrait of a Man, Said to be Christopher Columbus', /Columbus/i],
  [/^Leonardo da Vinci begins/, 'met', 'Leonardo da Vinci drawing', /Leonardo da Vinci/i],
  [/^Michelangelo paints/, 'met', 'Studies for the Libyan Sibyl', /Libyan Sibyl/i],
  [/^Martin Luther posts/, 'met', 'Martin Luther Cranach', /Martin Luther/i],
  [/^Akbar the Great/, 'cma', 'Akbar', /Akbar/i],
  [/^Tokugawa Ieyasu/, 'met', 'Armor (Gusoku)', /Armor/i],
  [/^Shah Jahan builds/, 'met', 'Shah Jahan on Horseback', /Shah Jahan/i],
  [/^United States Declaration/, 'met', 'Washington Crossing the Delaware', /Washington Crossing/i],
  [/^American Civil War/, 'met', 'Prisoners from the Front', /Prisoners from the Front/i],
  [/^Meiji Restoration/, 'cma', 'Meiji period', /Meiji/i],
];

async function fromMet(query, expect) {
  const s = await getJson('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=' + encodeURIComponent(query));
  for (const id of ((s && s.objectIDs) || []).slice(0, 12)) {
    const o = await getJson('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + id);
    await sleep(60);
    if (!o || !o.isPublicDomain || !o.primaryImageSmall) continue;
    if (!expect.test([o.title, o.artistDisplayName, o.culture, o.period, o.dynasty].join(' '))) continue;
    return { museum: 'The Met', title: o.title, maker: o.artistDisplayName || o.culture || '', date: o.objectDate || '', url: o.objectURL, img: o.primaryImageSmall,
      credit: 'The Metropolitan Museum of Art, Open Access (CC0)' };
  }
  return null;
}
async function fromCma(query, expect) {
  const s = await getJson('https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&limit=12&q=' + encodeURIComponent(query));
  for (const o of ((s && s.data) || [])) {
    if (o.share_license_status !== 'CC0' || !o.images || !o.images.web) continue;
    const maker = (o.creators || []).map((c) => c.description).join('; ');
    if (!expect.test([o.title, maker, (o.culture || []).join(' '), o.technique].join(' '))) continue;
    return { museum: 'Cleveland Museum of Art', title: o.title, maker: maker || (o.culture || []).join(', '), date: o.creation_date || '', url: o.url, img: o.images.web.url,
      credit: 'The Cleveland Museum of Art, Open Access (CC0)' };
  }
  return null;
}

require(join(ROOT, 'src/time.js')); require(join(ROOT, 'src/tiers.js'));
for (const f of readdirSync(join(ROOT, 'src/data')).sort()) if (/^0[1-8]-/.test(f)) require(join(ROOT, 'src/data', f));
const titles = globalThis.HT.events.map((e) => e.title);
const out = {}; const missed = [];
for (const [pat, museum, query, expect] of PAIRS) {
  const title = titles.find((t) => pat.test(t));
  if (!title) { missed.push('no event: ' + pat); continue; }
  const obj = museum === 'met' ? await fromMet(query, expect) : await fromCma(query, expect);
  if (!obj) { missed.push('no object: ' + title); continue; }
  for (const k of ['title', 'maker', 'date']) obj[k] = String(obj[k] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
  out[title] = obj;
  console.log(`${obj.museum.padEnd(24)} ${title.slice(0, 44).padEnd(44)} <- ${obj.title.slice(0, 50)}${obj.maker ? ' / ' + obj.maker.slice(0, 30) : ''}`);
}
const js = JSON.stringify(out, null, 1).split('<').join('\\u003c');
writeFileSync(join(ROOT, 'src/objects.js'), `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  // Generated by scripts/import-objects.mjs: one museum object per selected event, keyed by event title. Objects and
  // their images are CC0 / public domain (The Metropolitan Museum of Art Open Access; The Cleveland Museum of Art Open
  // Access). Images are only ever requested when the panel's Wikimedia/museum image option is switched on.
  HT.objects = ${js};
})(typeof window !== 'undefined' ? window : globalThis);
`);
console.log(`objects: ${Object.keys(out).length}/${PAIRS.length}`); if (missed.length) console.log('missed:\n  ' + missed.join('\n  '));
