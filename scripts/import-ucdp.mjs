#!/usr/bin/env node
// Imports wars from the UCDP/PRIO Armed Conflict Dataset (CC BY 4.0) into src/data/13-conflicts.js.
// A conflict is kept when it reached war intensity (1,000 or more battle-related deaths in a calendar year) at
// least once; its conflict-year rows are merged into one ranged event. Conflicts that a curated war event already
// covers (same place, start within two years) are skipped.
// Cite: Davies, Pettersson & Öberg (2026), Journal of Peace Research; Gleditsch et al. (2002).
// Run: node scripts/import-ucdp.mjs   (network at import time only; the ZIP is read with node:zlib, no external tools)
import { writeFileSync, readdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const URL_ZIP = 'https://ucdp.uu.se/downloads/ucdpprio/ucdp-prio-acd-261-csv.zip';
const UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity; import script)';
const NL = String.fromCharCode(10);
const esc = (s) => String(s).split('\\').join('\\\\').split("'").join("\\'").split(NL).join(' ').split('<').join('\\x3c');
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
// RFC 4180 parser over the whole text: quoted fields may contain commas, doubled quotes and line breaks.
function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\r') { /* swallow; the \n ends the record */ }
    else if (c === NL) { row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const r = await fetch(URL_ZIP, { headers: { 'User-Agent': UA } });
if (!r.ok) throw new Error(r.status + ' ' + URL_ZIP);
// Minimal ZIP reader: end-of-central-directory -> first central header -> local header -> stored or deflated data.
function unzipFirst(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a ZIP file');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('bad ZIP central directory');
  const method = buf.readUInt16LE(cd + 10);
  const compSize = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('bad ZIP local header');
  const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error('unsupported ZIP compression method ' + method);
}
const csv = unzipFirst(Buffer.from(await r.arrayBuffer())).toString('utf8');
const table = parseCsv(csv.replace(/^\uFEFF/, ''));
const H = table[0];
const rows = table.slice(1).map((f) => { const o = {}; H.forEach((h, i) => { o[h] = f[i]; }); return o; });
const short = table.slice(1).filter((f) => f.length !== H.length).length;
if (short) throw new Error(`${short} CSV records do not have ${H.length} fields`);
const maxYear = Math.max(...rows.map((x) => Number(x.year)).filter(Number.isFinite));

const byId = new Map();
for (const x of rows) {
  let c = byId.get(x.conflict_id);
  if (!c) { c = { id: x.conflict_id, location: x.location, sideA: x.side_a, sideB: new Set(), territory: x.territory_name, type: Number(x.type_of_conflict), start: x.start_date, warYears: 0, first: Number(x.year), last: Number(x.year), end: null }; byId.set(x.conflict_id, c); }
  x.side_b.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => c.sideB.add(s));
  if (x.start_date && x.start_date < c.start) c.start = x.start_date;
  if (Number(x.intensity_level) === 2) c.warYears++;
  c.first = Math.min(c.first, Number(x.year)); c.last = Math.max(c.last, Number(x.year));
  if (Number(x.year) === c.last) c.end = x.ep_end === '1' && x.ep_end_date ? x.ep_end_date : null;
}

// Curated wars already on the timeline.
require(join(ROOT, 'src/time.js')); require(join(ROOT, 'src/tiers.js'));
for (const f of readdirSync(join(ROOT, 'src/data')).sort()) if (!f.startsWith('13-')) require(join(ROOT, 'src/data', f));
const wars = globalThis.HT.events.filter((e) => e.category === 'war').map((e) => ({ y: e.t, title: e.title.toLowerCase() }));
const covered = (c, y) => {
  const words = c.location.replace(/\(.*?\)/g, ' ').split(/[^A-Za-z]+/).filter((w) => w.length >= 4).map((w) => w.toLowerCase());
  const terr = (c.territory || '').split(/[^A-Za-z]+/).filter((w) => w.length >= 4).map((w) => w.toLowerCase());
  return wars.some((w) => Math.abs(w.y - y) <= 2 && words.concat(terr).some((k) => w.title.includes(k)));
};
const gov = (s) => s.replace(/^Government of /, '');
const out = [];
for (const c of byId.values()) {
  if (c.warYears === 0 || !/^\d{4}-\d\d-\d\d$/.test(c.start)) continue;
  const [y, m, d] = c.start.split('-').map(Number);
  if (covered(c, y)) continue;
  const ongoing = c.last === maxYear && !c.end;
  const endDate = c.end && /^\d{4}-\d\d-\d\d$/.test(c.end) ? c.end : `${c.last}-12-31`;
  const [ey, em, ed] = endDate.split('-').map(Number);
  const sides = [...c.sideB];
  const interstate = c.type === 2;
  // Type 1 is extrasystemic (a colonial or imperial war): name the territory and the power it fought.
  const title = interstate ? `${gov(c.sideA)} – ${sides.map(gov).slice(0, 2).join(', ')} war`
    : c.type === 1 && c.territory ? `${c.territory}: war of independence against ${gov(c.sideA)}`
    : `${c.location}: ${c.territory ? c.territory + ' conflict' : 'civil war'}`;
  let detail = `${c.sideA} against ${sides.slice(0, 3).join(', ')}${sides.length > 3 ? ' and others' : ''}${c.territory ? ' over ' + c.territory : interstate ? '' : ' over control of the government'}. `;
  detail += `UCDP records ${c.warYears} year${c.warYears > 1 ? 's' : ''} at war intensity (1,000 or more battle-related deaths) between ${c.first} and ${c.last}${ongoing ? '; ongoing' : ''}.`;
  out.push({ y, m, d, ey, em, ed, title: clip(title, 80), detail: clip(detail, 300), tier: c.warYears >= 10 ? 4 : c.warYears >= 3 ? 5 : 6, id: c.id, start: c.start });
}
out.sort((a, b) => a.start.localeCompare(b.start));
const seen = new Set(globalThis.HT.events.map((e) => e.title.toLowerCase()));
for (const e of out) { let t = e.title; if (seen.has(t.toLowerCase())) t = clip(e.title, 73) + ` (${e.y})`; let k = 2; while (seen.has(t.toLowerCase())) t = clip(e.title, 70) + ` (${e.y}, ${k++})`; e.title = t; seen.add(t.toLowerCase()); }
const today = new Date();
const lines2 = out.map((e) => {
  const endAfterToday = new Date(Date.UTC(e.ey, e.em - 1, e.ed)) > today;
  const end = endAfterToday ? `ymd(${today.getUTCFullYear()}, ${today.getUTCMonth() + 1}, 1)` : `ymd(${e.ey}, ${e.em}, ${e.ed})`;
  const sameDay = e.ey === e.y && e.em === e.m && e.ed === e.d;
  return `    { t: ymd(${e.y}, ${e.m}, ${e.d}),${sameDay ? '' : ` end: ${end},`} title: '${esc(e.title)}', tier: ${e.tier}, category: 'war', detail: '${esc(e.detail)}', link: 'https://ucdp.uu.se/conflict/${e.id}' }`;
});
const file = `(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const { bce, ce, ymd, ya } = HT.time;
  HT.events = HT.events || [];
  // Generated by scripts/import-ucdp.mjs from the UCDP/PRIO Armed Conflict Dataset v26.1 (CC BY 4.0; Davies,
  // Pettersson & Öberg 2026; Gleditsch et al. 2002): conflicts since 1946 that reached war intensity, merged into
  // one ranged event each; those a curated war already covers are skipped.
  HT.events.push(
${lines2.join(',' + NL)}
  );
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync(join(ROOT, 'src/data/13-conflicts.js'), file);
console.log(`conflicts: ${byId.size}; at war intensity: ${[...byId.values()].filter((c) => c.warYears > 0).length}; written ${out.length}; ${Math.round(file.length / 1024)} KB`);
console.log(out.slice(0, 12).map((e) => `${e.y} ${e.title} [t${e.tier}]`).join(NL));
