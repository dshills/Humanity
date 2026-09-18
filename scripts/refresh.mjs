#!/usr/bin/env node
// Re-runs the importers whose sources change over time and reports what moved. Used by the monthly
// .github/workflows/refresh-data.yml, and runnable by hand:  node scripts/refresh.mjs [name ...]
//
// Each importer runs on its own. One that fails, or whose output lost more than a tenth of its events, has its
// files restored from git, so a source that is down or has changed shape can never shrink the timeline; the
// others still go through. The summary (markdown) goes to stdout and, with --summary <file>, to that file: the
// workflow uses it as the pull request body. Exit code 0 unless every importer failed; the workflow still
// fails its run at the end when any did, so a source that stays broken is noticed rather than silently skipped.
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_SHRINK = 0.1;
const TIMEOUT_MS = 20 * 60 * 1000;

// name, script, generated files, what it brings in
const IMPORTERS = [
  ['wikidata', 'scripts/import-wikidata.mjs', ['src/data/10-wikidata.js'], 'battles, rulers and sitting office-holders'],
  ['nobel', 'scripts/import-nobel.mjs', ['src/data/11-nobel.js'], 'Nobel Prizes'],
  ['gcat', 'scripts/import-gcat.mjs', ['src/data/12-launches.js'], 'orbital launches'],
  ['noaa', 'scripts/import-noaa.mjs', ['src/earth.js', 'src/data/09-hazards.js'], 'climate series and natural hazards'],
  ['ucdp', 'scripts/import-ucdp.mjs', ['src/data/13-conflicts.js'], 'armed conflicts since 1946'],
  ['context', 'scripts/import-context.mjs', ['src/context.js'], 'world population and the largest city'],
];

const args = process.argv.slice(2);
const summaryAt = args.indexOf('--summary');
const summaryFile = summaryAt >= 0 ? args[summaryAt + 1] : '';
const only = args.filter((a, i) => !a.startsWith('--') && (summaryAt < 0 || i !== summaryAt + 1));
const unknown = only.filter((n) => !IMPORTERS.some((imp) => imp[0] === n));
if (unknown.length) { console.error(`unknown importer: ${unknown.join(', ')} (known: ${IMPORTERS.map((i) => i[0]).join(', ')})`); process.exit(2); }

const read = (f) => (existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8') : '');
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
const restore = (files) => git('checkout', '--', ...files);

// The generated files are browser scripts. Rather than pattern-match their text, load them the way the page
// does, in a sandbox with HT.time in place, and read what they define. A file that does not evaluate throws,
// which the caller treats like any other failed import.
const TIME_JS = read('src/time.js');
function load(texts) {
  const box = vm.createContext({});
  vm.runInContext(TIME_JS, box, { filename: 'src/time.js' });
  for (const text of texts) if (text) vm.runInContext(text, box, { filename: 'generated.js' });
  return box.HT;
}
const eventsIn = (texts) => (load(texts).events || []);

// group -> holder's name, for the events flagged `ongoing` (the sitting holder of each office).
function sitting(events) {
  const out = new Map();
  for (const e of events) if (e.ongoing === true && e.group) out.set(e.group, String(e.title).replace(/, [^,]*$/, '').replace(/ \(\d+\)$/, ''));
  return out;
}

const rows = [];
const notes = [];
let ran = 0;
let failed = 0;
for (const [name, script, files, what] of IMPORTERS) {
  if (only.length && !only.includes(name)) continue;
  ran++;
  const before = files.map(read);
  const started = Date.now();
  const res = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  const secs = Math.round((Date.now() - started) / 1000);
  const tail = `${res.stdout || ''}\n${res.stderr || ''}`.trim().split('\n').slice(-3).join(' / ').slice(0, 300);
  if (res.status !== 0) {
    restore(files);
    failed++;
    rows.push(`| ${name} | failed after ${secs} s, files restored | ${what} |`);
    notes.push(`**${name}** failed (${res.error ? res.error.message : `exit ${res.status}`}): \`${tail.replace(/`/g, "'")}\``);
    continue;
  }
  const after = files.map(read);
  let oldEvents; let newEvents;
  try {
    oldEvents = eventsIn(before);
    newEvents = eventsIn(after);
  } catch (err) {
    restore(files);
    failed++;
    rows.push(`| ${name} | rejected: the new file does not load, files restored | ${what} |`);
    notes.push(`**${name}** wrote a file that fails to evaluate: \`${String(err.message).slice(0, 200).replace(/`/g, "'")}\``);
    continue;
  }
  const was = oldEvents.length;
  const now = newEvents.length;
  const bytesWas = before.reduce((n, t) => n + t.length, 0);
  const bytesNow = after.reduce((n, t) => n + t.length, 0);
  if (was === 0 && bytesWas > 0 && bytesNow < bytesWas * 0.5) {           // series files (no events): judge by size
    restore(files);
    failed++;
    rows.push(`| ${name} | rejected: output halved (${bytesWas} → ${bytesNow} bytes), files restored | ${what} |`);
    notes.push(`**${name}** wrote less than half of what was there before, which is treated as a broken source.`);
    continue;
  }
  if (was > 0 && now < was * (1 - MAX_SHRINK)) {
    restore(files);
    failed++;
    rows.push(`| ${name} | rejected: ${was} → ${now} events, files restored | ${what} |`);
    notes.push(`**${name}** produced ${now} events where there were ${was}; a drop of more than ${MAX_SHRINK * 100}% is treated as a broken source, not news.`);
    continue;
  }
  const changed = after.some((t, i) => t !== before[i]);
  rows.push(`| ${name} | ${changed ? `updated${was || now ? `: ${was} → ${now} events` : ''}` : 'no change'} (${secs} s) | ${what} |`);
  if (name === 'wikidata' && changed) {
    const a = sitting(oldEvents);
    const b = sitting(newEvents);
    const moves = [];
    for (const [office, holder] of b) if (a.get(office) !== holder) moves.push(`- ${office}: ${a.get(office) || 'nobody'} → **${holder}**`);
    for (const office of a.keys()) if (!b.has(office)) moves.push(`- ${office}: ${a.get(office)} → nobody marked as sitting`);
    if (moves.length) notes.push(`Sitting office-holders that changed:\n${moves.join('\n')}`);
  }
}

const stat = git('diff', '--stat', '--', ...new Set(IMPORTERS.flatMap((i) => i[2]))).stdout.trim();
const summary = [
  '## Data refresh',
  '',
  'Re-ran the importers whose sources change over time. Importers that failed or lost more than a tenth of their events were rolled back, so nothing here can shrink the timeline.',
  '',
  '| Importer | Result | Brings in |',
  '|---|---|---|',
  ...rows,
  '',
  ...notes.flatMap((n) => [n, '']),
  stat ? `\`\`\`\n${stat}\n\`\`\`` : 'No files changed.',
  '',
  'Check the sitting office-holders and skim the diff for anything that reads like vandalism before merging: Wikidata is edited by anyone.',
  '',
].join('\n');
console.log(summary);
if (summaryFile) writeFileSync(summaryFile, summary);
// In Actions, tell the workflow how many importers were rolled back so it can fail loudly after proposing the rest.
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `failed=${failed}\n`);
process.exit(ran > 0 && failed === ran ? 1 : 0);
