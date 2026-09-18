'use strict';
// Contract tests for the event data (CONTRACT.md sections 2, 3 and 6).
//
// Loads HT.time and HT.tiers, then every src/data/*.js file in filename order (the build order),
// and checks the resulting globalThis.HT.events against the rules of section 6. Every event is
// attributed to the file that pushed it (HT.events length before/after each require), so a failure
// names the offending title AND its file/position.
//
// Global checks (duplicate titles, total count, representative windows) are skipped when
// DATA_PARTIAL is set, so a single data file can be validated while the others are still being
// written:   DATA_PARTIAL=1 node --test test/data.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../src/time.js');
require('../src/tiers.js');

const HT = globalThis.HT;
const { ROOT_START, bce, ce, now } = HT.time;
const { CATEGORIES, tierForSpan } = HT.tiers;

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const ALLOWED_KEYS = ['t', 'end', 'title', 'detail', 'tier', 'category', 'link', 'lat', 'lon', 'group'];
const MAX_TIER = 7;
const TITLE_MAX = 80;
const DETAIL_MIN = 20;
const DETAIL_MAX = 300;
const MIN_TOTAL = 300;
const MAX_LISTED = 25; // offenders listed per failure before "... and N more"

const PARTIAL = Boolean(process.env.DATA_PARTIAL);
const SKIP_GLOBAL = PARTIAL ? 'DATA_PARTIAL is set: global data checks skipped' : false;

// ---------------------------------------------------------------------------------------------
// Load src/data/*.js in build order, attributing every pushed event to its file.
// ---------------------------------------------------------------------------------------------

const dataFiles = fs.existsSync(DATA_DIR)
  ? fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.js') && !f.startsWith('.')).sort()
  : [];
const SKIP_NO_FILES = dataFiles.length === 0 ? 'src/data/ has no .js files' : false;

const loadErrors = []; // [{ file, error }]
const perFile = [];    // [{ file, first, added }]  first = index in HT.events of the file's first event
const fileOf = [];     // fileOf[i] = name of the data file that pushed HT.events[i]
const replacedBy = []; // data files after which HT.events was no longer the same array
let sharedArray = Array.isArray(HT.events) ? HT.events : null;

for (const file of dataFiles) {
  const before = Array.isArray(HT.events) ? HT.events.length : 0;
  try {
    require(path.join(DATA_DIR, file));
  } catch (error) {
    loadErrors.push({ file, error });
  }
  const after = Array.isArray(HT.events) ? HT.events.length : 0;
  for (let i = before; i < after; i++) fileOf[i] = file;
  perFile.push({ file, first: before, added: after - before });
  if (sharedArray !== null && HT.events !== sharedArray) replacedBy.push(file);
  if (Array.isArray(HT.events)) sharedArray = HT.events;
}

const EVENTS = Array.isArray(HT.events) ? HT.events : [];
const NOW = now();

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Value plus its runtime type, e.g. "1969" (string); undefined shows plainly.
function typed(v) {
  return v === undefined ? 'undefined' : `${show(v)} (${typeof v})`;
}

function show(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v);
  } catch (e) {
    return String(v);
  }
}

// "src/data/03-antiquity.js#12" (1-based position within the file) or "HT.events[i]".
function loc(i) {
  const p = perFile.find((f) => i >= f.first && i < f.first + f.added);
  return p ? `src/data/${p.file}#${i - p.first + 1}` : `HT.events[${i}] (file unknown)`;
}

function describeEvent(i) {
  const ev = EVENTS[i];
  const title = isObj(ev) && typeof ev.title === 'string' ? JSON.stringify(ev.title) : '<untitled>';
  return `${title} (${loc(i)})`;
}

// Runs `check(ev)` on every plain-object event; a returned string is a violation message.
function collect(check) {
  const bad = [];
  EVENTS.forEach((ev, i) => {
    if (!isObj(ev)) return; // reported by the "plain object" test
    const why = check(ev);
    if (why) bad.push(`${describeEvent(i)}: ${why}`);
  });
  return bad;
}

function listing(items, indent) {
  const shown = items.slice(0, MAX_LISTED);
  if (items.length > MAX_LISTED) shown.push(`... and ${items.length - MAX_LISTED} more`);
  return shown.join('\n' + (indent === undefined ? '  ' : indent));
}

function assertNone(bad, rule) {
  if (bad.length === 0) return;
  assert.fail(`${bad.length} event(s) violate "${rule}":\n  ${listing(bad)}`);
}

// ---------------------------------------------------------------------------------------------
// Loading (section 6 wrapper: HT.events = HT.events || []; HT.events.push(...))
// ---------------------------------------------------------------------------------------------

describe('data files load (section 6)', () => {
  test('every src/data/*.js file loads without throwing', () => {
    const msgs = loadErrors.map(({ file, error }) => `src/data/${file}: ${(error && error.stack) || error}`);
    assert.equal(loadErrors.length, 0,
      `${loadErrors.length} data file(s) threw while loading:\n  ${msgs.join('\n  ')}`);
  });

  test('data files append to one shared HT.events array and never replace it', { skip: SKIP_NO_FILES }, () => {
    assert.ok(Array.isArray(HT.events),
      `HT.events is ${show(HT.events)} after loading ${dataFiles.length} data file(s); expected an array`);
    assert.equal(replacedBy.length, 0,
      `these data files replaced HT.events instead of pushing onto it: ${replacedBy.map((f) => `src/data/${f}`).join(', ')}`);
  });

  test('each data file pushes at least one event', { skip: SKIP_NO_FILES }, () => {
    const empty = perFile.filter((p) => p.added === 0).map((p) => `src/data/${p.file}`);
    assert.equal(empty.length, 0, `data file(s) that added no events: ${empty.join(', ')}`);
  });
});

// ---------------------------------------------------------------------------------------------
// Per-event rules
// ---------------------------------------------------------------------------------------------

describe('per-event rules (sections 2, 3, 6)', () => {
  test('every entry of HT.events is a plain object', () => {
    const bad = [];
    EVENTS.forEach((ev, i) => {
      if (!isObj(ev)) bad.push(`${loc(i)}: entry is ${show(ev)}; expected an event object`);
    });
    assertNone(bad, 'event is a plain object');
  });

  test('t is a finite number within [ROOT_START, now()]', () => {
    assertNone(collect((ev) => {
      if (typeof ev.t !== 'number' || !Number.isFinite(ev.t)) {
        return `t is ${typed(ev.t)}; expected a finite number`;
      }
      if (ev.t < ROOT_START) return `t = ${show(ev.t)} is before ROOT_START (${show(ROOT_START)})`;
      if (ev.t > NOW) return `t = ${show(ev.t)} is after now() (${show(NOW)})`;
      return null;
    }), 't in [ROOT_START, now()]');
  });

  test('end, when present, is a finite number > t and <= now()', () => {
    assertNone(collect((ev) => {
      if (!Object.prototype.hasOwnProperty.call(ev, 'end')) return null;
      if (typeof ev.end !== 'number' || !Number.isFinite(ev.end)) {
        return `end is ${typed(ev.end)}; omit it for point events or give a finite number`;
      }
      if (!(ev.end > ev.t)) return `end = ${show(ev.end)} is not after t = ${show(ev.t)}`;
      if (ev.end > NOW) return `end = ${show(ev.end)} is after now() (${show(NOW)})`;
      return null;
    }), 'end > t and end <= now()');
  });

  test('tier is an integer 0..7', () => {
    assertNone(collect((ev) => (
      Number.isInteger(ev.tier) && ev.tier >= 0 && ev.tier <= MAX_TIER
        ? null
        : `tier is ${typed(ev.tier)}; expected an integer 0..${MAX_TIER}`
    )), 'tier integer 0..7');
  });

  test('category is one of CATEGORIES', () => {
    assertNone(collect((ev) => (
      CATEGORIES.includes(ev.category)
        ? null
        : `category is ${show(ev.category)}; expected one of: ${CATEGORIES.join(', ')}`
    )), 'category in CATEGORIES');
  });

  test('title is a string of 1-80 characters with no trailing period', () => {
    assertNone(collect((ev) => {
      if (typeof ev.title !== 'string') return `title is ${typed(ev.title)}; expected a string`;
      if (ev.title.trim().length === 0) return 'title is empty';
      if (ev.title.length > TITLE_MAX) return `title is ${ev.title.length} chars (max ${TITLE_MAX})`;
      if (/\.\s*$/.test(ev.title)) return 'title ends with a period';
      return null;
    }), 'title 1-80 chars, no trailing period');
  });

  test('detail is a string of 20-300 characters', () => {
    assertNone(collect((ev) => {
      if (typeof ev.detail !== 'string') return `detail is ${typed(ev.detail)}; expected a string`;
      if (ev.detail.trim().length < DETAIL_MIN) return `detail is ${ev.detail.trim().length} chars (min ${DETAIL_MIN})`;
      if (ev.detail.length > DETAIL_MAX) return `detail is ${ev.detail.length} chars (max ${DETAIL_MAX})`;
      return null;
    }), 'detail 20-300 chars');
  });

  test('no keys other than t, end, title, detail, tier, category', () => {
    assertNone(collect((ev) => {
      const extra = Object.keys(ev).filter((k) => !ALLOWED_KEYS.includes(k));
      if (extra.length === 0) return null;
      const note = extra.includes('id') ? ' (id is derived by the app from the index; do not author it)' : '';
      return `unknown key(s): ${extra.join(', ')}${note}`;
    }), 'only t, end, title, detail, tier, category');
  });
});

// ---------------------------------------------------------------------------------------------
// Global rules (skipped under DATA_PARTIAL)
// ---------------------------------------------------------------------------------------------

describe('global rules (section 6)', () => {
  test('no duplicate titles across all files (case-insensitive)', { skip: SKIP_GLOBAL }, () => {
    const groups = new Map();
    EVENTS.forEach((ev, i) => {
      if (!isObj(ev) || typeof ev.title !== 'string') return;
      const key = ev.title.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });
    const dups = [...groups.entries()]
      .filter(([, idx]) => idx.length > 1)
      .map(([key, idx]) => `${JSON.stringify(key)} x${idx.length}: ${idx.map(describeEvent).join('; ')}`);
    assert.equal(dups.length, 0, `${dups.length} duplicated title(s) (case-insensitive):\n  ${listing(dups)}`);
  });

  test(`at least ${MIN_TOTAL} events in total`, { skip: SKIP_GLOBAL }, () => {
    const breakdown = perFile.map((p) => `src/data/${p.file}: ${p.added}`);
    assert.ok(EVENTS.length >= MIN_TOTAL,
      `only ${EVENTS.length} event(s) across ${dataFiles.length} data file(s); contract requires >= ${MIN_TOTAL}\n  ` +
      (breakdown.length ? breakdown.join('\n  ') : '(src/data/ has no .js files)'));
  });
});

// ---------------------------------------------------------------------------------------------
// Representative windows (section 6): visible = t within [start, end] AND tier <= tierForSpan(end - start)
// ---------------------------------------------------------------------------------------------

const WINDOWS = [
  { name: '(ROOT_START, now, 8)',    start: ROOT_START, end: NOW,      min: 8 },
  { name: '(bce(10000), now, 8)',    start: bce(10000), end: NOW,      min: 8 },
  { name: '(bce(3000), ce(500), 8)', start: bce(3000),  end: ce(500),  min: 8 },
  { name: '(ce(500), ce(1500), 8)',  start: ce(500),    end: ce(1500), min: 8 },
  { name: '(ce(1500), ce(1800), 8)', start: ce(1500),   end: ce(1800), min: 8 },
  { name: '(ce(1800), ce(1945), 8)', start: ce(1800),   end: ce(1945), min: 8 },
  { name: '(ce(1945), now, 8)',      start: ce(1945),   end: NOW,      min: 8 },
  { name: '(ce(1900), ce(1950), 8)', start: ce(1900),   end: ce(1950), min: 8 },
  { name: '(ce(1960), ce(1970), 6)', start: ce(1960),   end: ce(1970), min: 6 },
  { name: '(ce(2010), ce(2020), 6)', start: ce(2010),   end: ce(2020), min: 6 },
  { name: '(ce(1969), ce(1970), 4)', start: ce(1969),   end: ce(1970), min: 4 },
  { name: '(ce(1989), ce(1990), 4)', start: ce(1989),   end: ce(1990), min: 4 },
  { name: '(ce(2020), ce(2021), 4)', start: ce(2020),   end: ce(2021), min: 4 },
];

describe('representative windows (section 6)', () => {
  for (const w of WINDOWS) {
    test(`window ${w.name}: at least ${w.min} visible event(s)`, { skip: SKIP_GLOBAL }, () => {
      const span = w.end - w.start;
      const maxTier = tierForSpan(span);
      const inWindow = [];
      EVENTS.forEach((ev, i) => {
        if (isObj(ev) && typeof ev.t === 'number' && ev.t >= w.start && ev.t <= w.end) inWindow.push(i);
      });
      const visible = inWindow.filter((i) => Number.isInteger(EVENTS[i].tier) && EVENTS[i].tier <= maxTier);
      const visibleSet = new Set(visible);
      const hidden = inWindow.filter((i) => !visibleSet.has(i));
      const entry = (i) => `${describeEvent(i)} tier ${show(EVENTS[i].tier)}`;

      assert.ok(visible.length >= w.min,
        `window ${w.name}: ${visible.length} visible event(s), need >= ${w.min}\n` +
        `  span = ${show(span)} years -> tierForSpan = ${maxTier}, so an event is visible when tier <= ${maxTier}\n` +
        `  events with t in the window at any tier: ${inWindow.length} (${hidden.length} hidden because tier > ${maxTier})\n` +
        `  visible: ${visible.length ? listing(visible.map(entry), '           ') : '(none)'}\n` +
        `  hidden:  ${hidden.length ? listing(hidden.map(entry), '           ') : '(none)'}`);
    });
  }
});

describe('link (optional)', () => {
  test('is an https URL when present', () => {
    for (const e of globalThis.HT.events) {
      if (e.link === undefined) continue;
      assert.equal(typeof e.link, 'string', `link must be a string: ${e.title}`);
      assert.match(e.link, /^https:\/\/[^\s]+$/, `link must be an https URL without spaces: ${e.title}`);
    }
  });
});

describe('lat/lon (optional)', () => {
  test('are a valid coordinate pair when present', () => {
    for (const e of globalThis.HT.events) {
      if (e.lat === undefined && e.lon === undefined) continue;
      assert.ok(Number.isFinite(e.lat) && e.lat >= -90 && e.lat <= 90, `lat out of range: ${e.title}`);
      assert.ok(Number.isFinite(e.lon) && e.lon >= -180 && e.lon <= 180, `lon out of range: ${e.title}`);
    }
  });
});

describe('group (optional)', () => {
  test('is a short non-empty string when present', () => {
    for (const e of globalThis.HT.events) {
      if (e.group === undefined) continue;
      assert.ok(typeof e.group === 'string' && e.group.length > 0 && e.group.length <= 60, `bad group: ${e.title}`);
    }
  });
});

describe('museum objects', () => {
  test('every key names an existing event and every record is complete', () => {
    require('../src/objects.js');
    const objects = globalThis.HT.objects || {};
    const titles = new Set(globalThis.HT.events.map((e) => e.title));
    for (const [key, o] of Object.entries(objects)) {
      assert.ok(titles.has(key), `object keyed to a missing event: ${key}`);
      for (const f of ['museum', 'title', 'url', 'img', 'credit']) assert.ok(typeof o[f] === 'string' && o[f].length > 0, `${key}: missing ${f}`);
      assert.match(o.url, /^https:\/\//); assert.match(o.img, /^https:\/\//);
    }
  });
});
