#!/usr/bin/env node
// Scores every event that links to English Wikipedia by blending 12 months of pageviews with the number of
// Wikidata sitelinks, maps scores onto tiers by matching the curated tier distribution, and writes:
//   scripts/cache/significance.json   { titles: { "<Article_title>": { views, sitelinks, score } }, thresholds: [...] }
//   docs/TIER-AUDIT.md                curated events whose hand-assigned tier differs most from the data
// Run: node scripts/score-significance.mjs   (about 15 minutes: one pageviews request per article, <= 180/min)
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; significance scorer)';
const PREFIX = 'https://en.wikipedia.org/wiki/';
const CACHE = join(ROOT, 'scripts/cache/significance.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

require(join(ROOT, 'src/time.js')); require(join(ROOT, 'src/tiers.js'));
const owner = []; let prev = 0;
for (const f of readdirSync(join(ROOT, 'src/data')).sort()) {
  require(join(ROOT, 'src/data', f));
  for (let i = prev; i < globalThis.HT.events.length; i++) owner[i] = f;
  prev = globalThis.HT.events.length;
}
const events = globalThis.HT.events.map((e, i) => ({ e, file: owner[i] })).filter((x) => x.e.link && x.e.link.startsWith(PREFIX));
const keyOf = (link) => link.slice(PREFIX.length);
const titles = [...new Set(events.map((x) => keyOf(x.e.link)))];
console.log(`${events.length} linked events, ${titles.length} distinct articles`);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { titles: {} };
const data = cache.titles || {};

// --- sitelinks (50 articles per request) ---
const needLinks = titles.filter((t) => !(data[t] && data[t].sitelinks != null));
for (let i = 0; i < needLinks.length; i += 50) {
  const batch = needLinks.slice(i, i + 50);
  const url = 'https://www.wikidata.org/w/api.php?format=json&' + new URLSearchParams({ action: 'wbgetentities', sites: 'enwiki', titles: batch.map((t) => decodeURIComponent(t).replace(/_/g, ' ')).join('|'), props: 'sitelinks', redirects: 'yes' });
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (r.ok) {
    const d = await r.json();
    const byTitle = new Map();
    for (const ent of Object.values(d.entities || {})) if (ent.sitelinks && ent.sitelinks.enwiki) byTitle.set(ent.sitelinks.enwiki.title, Object.keys(ent.sitelinks).length);
    for (const t of batch) { const n = byTitle.get(decodeURIComponent(t).replace(/_/g, ' ')); (data[t] = data[t] || {}).sitelinks = n != null ? n : 0; }
  }
  await sleep(350);
}
// --- pageviews, last 12 full months ---
const now = new Date(); const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
const stamp = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
const needViews = titles.filter((t) => !(data[t] && data[t].views != null));
let done = 0;
async function worker(queue) {
  for (;;) {
    const t = queue.shift(); if (t === undefined) return;
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(decodeURIComponent(t))}/monthly/${stamp(start)}/${stamp(end)}`;
    let views = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) { views = ((await r.json()).items || []).reduce((s, it) => s + it.views, 0); break; }
      if (r.status === 404) break;
      await sleep(3000 * attempt);
    }
    (data[t] = data[t] || {}).views = views;
    if (++done % 200 === 0) { writeFileSync(CACHE, JSON.stringify({ titles: data })); console.log(`pageviews ${done}/${needViews.length}`); }
    await sleep(1050);                                            // 3 workers -> ~170 requests/min
  }
}
const queue = needViews.slice();
await Promise.all([worker(queue), worker(queue), worker(queue)]);

// --- score: mean of the z-scores of log10(views) and log10(sitelinks) over all articles ---
const lv = (t) => Math.log10(1 + (data[t].views || 0)); const ls = (t) => Math.log10(1 + (data[t].sitelinks || 0));
const stat = (f) => { const xs = titles.map(f); const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1; return { m, sd }; };
const sv = stat(lv), ss = stat(ls);
for (const t of titles) data[t].score = Math.round(((lv(t) - sv.m) / sv.sd + (ls(t) - ss.m) / ss.sd) / 2 * 1000) / 1000;

// --- quantile mapping on the curated events: keep the curated tier counts, reassign by score ---
const curated = events.filter((x) => /^0[1-8]-/.test(x.file));
const counts = new Array(8).fill(0); for (const x of curated) counts[x.e.tier]++;
const ranked = curated.slice().sort((a, b) => data[keyOf(b.e.link)].score - data[keyOf(a.e.link)].score);
const thresholds = []; let idx = 0;
for (let tier = 0; tier < 8; tier++) {
  for (let k = 0; k < counts[tier] && idx < ranked.length; k++, idx++) ranked[idx].suggested = tier;
  thresholds.push(idx > 0 ? data[keyOf(ranked[Math.min(idx, ranked.length) - 1].e.link)].score : Infinity);   // lowest score still in this tier
}
mkdirSync(join(ROOT, 'scripts/cache'), { recursive: true });
writeFileSync(CACHE, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), thresholds, titles: data }));

const rows = curated.map((x) => ({ title: x.e.title, file: x.file, tier: x.e.tier, suggested: x.suggested, d: data[keyOf(x.e.link)] }));
const up = rows.filter((r) => r.tier - r.suggested >= 2).sort((a, b) => (b.tier - b.suggested) - (a.tier - a.suggested) || b.d.score - a.d.score);
const down = rows.filter((r) => r.suggested - r.tier >= 2).sort((a, b) => (b.suggested - b.tier) - (a.suggested - a.tier) || a.d.score - b.d.score);
const fmt = (n) => Number(n).toLocaleString('en-US');
const table = (list) => ['| Event | File | Tier | Data says | Pageviews (12 mo) | Sitelinks |', '|---|---|---|---|---|---|']
  .concat(list.slice(0, 60).map((r) => `| ${r.title.replace(/\|/g, '/')} | ${r.file.replace('.js', '')} | ${r.tier} | ${r.suggested} | ${fmt(r.d.views)} | ${r.d.sitelinks} |`)).join('\n');
const agree = rows.filter((r) => Math.abs(r.tier - r.suggested) <= 1).length;
const md = `# Tier audit

Generated by \`scripts/score-significance.mjs\` on ${new Date().toISOString().slice(0, 10)}.

Every curated event is scored from its English Wikipedia article: the mean of the z-scores of log10(12-month
pageviews) and log10(Wikidata sitelinks). Scores are mapped to tiers by keeping the curated tier counts and
re-dealing the tiers in score order, so the comparison is about *which* events sit in a tier, not how many.
${agree} of ${rows.length} curated events (${Math.round(agree / rows.length * 100)}%) are within one tier of what the data suggests.

The signal is imperfect on purpose-blind cases: an event linked to a broad article (a person, a country, a
religion) inherits that article's traffic, and recent events draw more readers than ancient ones. Treat the
lists below as prompts for editorial review, not as corrections. Hand-assigned tiers are left unchanged.

## Possibly under-ranked (the data suggests at least two tiers more prominent)

${table(up)}

## Possibly over-ranked (the data suggests at least two tiers less prominent)

${table(down)}
`;
writeFileSync(join(ROOT, 'docs/TIER-AUDIT.md'), md);
console.log(`scored ${titles.length} articles; curated within one tier: ${agree}/${rows.length}; under-ranked ${up.length}, over-ranked ${down.length}`);
console.log('thresholds', thresholds.map((x) => (Number.isFinite(x) ? x.toFixed(2) : 'inf')).join(' '));
