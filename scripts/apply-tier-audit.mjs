#!/usr/bin/env node
// Applies the significance audit to the hand-curated events (src/data/01..08), with the corrections the raw
// signal needs:
//   - score = 0.7 z(log sitelinks) + 0.3 z(log pageviews): sitelinks count language editions, English pageviews
//     over-reward anglophone and recent subjects
//   - events from 1800 on lose 0.5 score (about one tier): recent topics are over-covered everywhere
//   - tiers 0 to 2 are editorial (they define the big-picture views): nothing is promoted into them or demoted out of them by data
//   - only disagreements of two tiers or more are applied, one tier per run, within 3..7
// Tier counts are preserved by re-dealing tiers in score order (quantile mapping) among the unprotected events.
// Run after scripts/score-significance.mjs:  node scripts/apply-tier-audit.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const DRY = process.argv.includes('--dry');
const PREFIX = 'https://en.wikipedia.org/wiki/';
const SIG = JSON.parse(readFileSync(join(ROOT, 'scripts/cache/significance.json'), 'utf8'));

require(join(ROOT, 'src/time.js')); require(join(ROOT, 'src/tiers.js'));
const files = readdirSync(join(ROOT, 'src/data')).filter((f) => /^0[1-8]-/.test(f)).sort();
const events = [];
for (const f of files) { const before = (globalThis.HT.events || []).length; require(join(ROOT, 'src/data', f)); for (const e of globalThis.HT.events.slice(before)) events.push({ e, f }); }

const rows = Object.values(SIG.titles);
const stat = (fn) => { const xs = rows.map(fn); const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1; return { m, sd }; };
const sv = stat((d) => Math.log10(1 + (d.views || 0))), ss = stat((d) => Math.log10(1 + (d.sitelinks || 0)));
for (const x of events) {
  const d = x.e.link && x.e.link.startsWith(PREFIX) ? SIG.titles[x.e.link.slice(PREFIX.length)] : null;
  x.score = d ? 0.3 * (Math.log10(1 + (d.views || 0)) - sv.m) / sv.sd + 0.7 * (Math.log10(1 + (d.sitelinks || 0)) - ss.m) / ss.sd - (x.e.t >= 1800 ? 0.5 : 0) : null;
}
// Quantile mapping among unprotected, scored events (tiers 3..7), keeping their tier counts.
const pool = events.filter((x) => x.e.tier >= 3 && x.score !== null);
const counts = new Array(8).fill(0); for (const x of pool) counts[x.e.tier]++;
const ranked = pool.slice().sort((a, b) => b.score - a.score);
let idx = 0;
for (let tier = 3; tier < 8; tier++) for (let k = 0; k < counts[tier] && idx < ranked.length; k++, idx++) ranked[idx].suggested = tier;
// The signal measures article popularity, not historical weight, so it is applied as a nudge, with limits by age:
//   - one tier per run, toward the suggestion, and only where the disagreement is two tiers or more
//   - old events cannot sink into short-span tiers (a 40,000-year-old find at tier 7 would be unreachable)
//   - recent events cannot rise into long-span tiers (YouTube does not belong on a 5,000-year view)
const NOW = globalThis.HT.time.now();
const maxTier = (t) => { const age = NOW - t; return age > 10000 ? 4 : age > 2000 ? 5 : age > 500 ? 6 : 7; };
const minTier = (t) => { const age = NOW - t; return age < 50 ? 5 : age < 150 ? 4 : 3; };
for (const x of pool) {
  x.raw = x.suggested;
  const capped = Math.min(maxTier(x.e.t), Math.max(minTier(x.e.t), x.raw));
  x.suggested = Math.abs(x.raw - x.e.tier) >= 2 && capped !== x.e.tier ? x.e.tier + Math.sign(capped - x.e.tier) : x.e.tier;
}
const moves = pool.filter((x) => x.suggested !== x.e.tier);
console.log(`${events.length} curated events; ${pool.length} eligible (tiers 3-7 with a score); ${moves.length} one-tier nudges`);

// Rewrite `tier: N` inside the object literal that holds each title.
const texts = new Map(files.map((f) => [f, readFileSync(join(ROOT, 'src/data', f), 'utf8')]));
let applied = 0; const failed = [];
for (const x of moves) {
  let src = texts.get(x.f);
  const variants = [`'${x.e.title.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`, JSON.stringify(x.e.title)];
  let at = -1; for (const v of variants) { at = src.indexOf('title: ' + v); if (at >= 0) break; }
  if (at < 0) { failed.push(x.e.title); continue; }
  const open = src.lastIndexOf('{', at);
  // The object ends at the first "}" that is followed by a comma/newline/paren outside of the strings we know about;
  // tier always sits on the same or the next two lines as the title in these files, so search a bounded window.
  const windowEnd = Math.min(src.length, at + 900);
  const before = src.slice(open, at); const after = src.slice(at, windowEnd);
  const re = /tier:\s*(\d)/;
  let pos = -1; let m = re.exec(before);
  if (m) pos = open + m.index; else { m = re.exec(after); if (m) pos = at + m.index; }
  if (pos < 0 || !m || Number(m[1]) !== x.e.tier) { failed.push(x.e.title); continue; }
  src = src.slice(0, pos) + m[0].replace(/\d$/, String(x.suggested)) + src.slice(pos + m[0].length);
  texts.set(x.f, src); applied++;
}
if (!DRY) for (const [f, src] of texts) writeFileSync(join(ROOT, 'src/data', f), src);
const up = moves.filter((x) => x.suggested < x.e.tier).sort((a, b) => (b.e.tier - b.suggested) - (a.e.tier - a.suggested) || b.score - a.score);
const down = moves.filter((x) => x.suggested > x.e.tier).sort((a, b) => (b.suggested - b.e.tier) - (a.suggested - a.e.tier) || a.score - b.score);
const line = (x) => `${x.e.tier}->${x.suggested}  ${x.e.title}`;
console.log(`${DRY ? 'would apply' : 'applied'} ${applied}; could not locate ${failed.length}${failed.length ? ': ' + failed.slice(0, 5).join(' | ') : ''}`);
console.log(`promoted ${up.length}, demoted ${down.length}`);
console.log('--- promoted (first 25)\n' + up.slice(0, 25).map(line).join('\n'));
console.log('--- demoted (first 25)\n' + down.slice(0, 25).map(line).join('\n'));
writeFileSync(join(ROOT, 'scripts/cache/tier-moves.json'), JSON.stringify(moves.map((x) => ({ title: x.e.title, file: x.f, from: x.e.tier, to: x.suggested, score: Math.round(x.score * 1000) / 1000 })), null, 1));
