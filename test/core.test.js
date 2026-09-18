'use strict';
// Tests for HT.core: the pure rules behind src/app.js (view limits, URL hash, slugs, regions, the overview
// scale, tier selection, "on this day" parsing and the panel's neighbour lists). "now" is always passed in.

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/time.js');
require('../src/tiers.js');
require('../src/core.js');
const T = globalThis.HT.time;
const C = globalThis.HT.core;

const NOW = T.ymd(2026, 9, 18);
const ROOT = C.rootView(NOW);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

// ---------------------------------------------------------------- views
test('root view starts at ROOT_START and leaves FUTURE_FRAC of its span past now', () => {
  assert.equal(ROOT.start, T.ROOT_START);
  const span = ROOT.end - ROOT.start;
  close((ROOT.end - NOW) / span, C.FUTURE_FRAC, 1e-12);
  assert.ok(C.atNow(ROOT, NOW));
});

test('endAtNow and maxEnd agree: a view built from endAtNow rests exactly on its limit', () => {
  for (const start of [-298050, -3499, 1900, 2020, 2026.5]) {
    const end = C.endAtNow(start, NOW);
    close(end, C.maxEnd(end - start, NOW), 1e-7);
    assert.ok(C.atNow({ start, end }, NOW), `not at now from ${start}`);
  }
  assert.ok(!C.atNow({ start: 1900, end: 2000 }, NOW));
});

test('clampView returns the root for non-finite input and for spans at least as wide as the root', () => {
  assert.deepEqual(C.clampView(NaN, 5, NOW), ROOT);
  assert.deepEqual(C.clampView(0, Infinity, NOW), ROOT);
  assert.deepEqual(C.clampView(-1e7, 1e7, NOW), ROOT);
  assert.deepEqual(C.clampView(ROOT.start, ROOT.end, NOW), ROOT);
});

test('clampView leaves an interior view untouched', () => {
  assert.deepEqual(C.clampView(1400, 1600, NOW), { start: 1400, end: 1600 });
});

test('clampView enforces the one-day minimum span around the same centre', () => {
  const v = C.clampView(1969.5, 1969.5 + 1e-6, NOW);
  close(v.end - v.start, C.MIN_SPAN, 1e-12);
  close((v.start + v.end) / 2, 1969.5 + 5e-7, 1e-9);
  const zero = C.clampView(1500, 1500, NOW);
  close(zero.end - zero.start, C.MIN_SPAN, 1e-12);
});

test('clampView shifts, rather than shrinks, a view that overhangs either end', () => {
  const left = C.clampView(T.ROOT_START - 500, T.ROOT_START + 500, NOW);
  assert.equal(left.start, T.ROOT_START);
  close(left.end - left.start, 1000, 1e-6);
  const right = C.clampView(2000, 2100, NOW);
  close(right.end - right.start, 100, 1e-6);
  close(right.end, C.maxEnd(100, NOW), 1e-9);
  assert.ok(right.end > NOW, 'a view may run past today');
  assert.ok(right.end - NOW <= 100 * C.FUTURE_FRAC + 1e-9, 'but only by its margin');
});

test('dragging against either end of time stops the view instead of zooming it', () => {
  const base = { start: T.ROOT_START + 100, end: T.ROOT_START + 1100 };
  for (const push of [50, 100, 101, 500, 5000]) {
    const v = C.clampView(base.start - push, base.end - push, NOW);
    close(v.end - v.start, 1000, 1e-6);
    assert.ok(v.start >= T.ROOT_START);
  }
  const recent = { start: 1990, end: 2020 };
  for (const push of [5, 10, 100]) {
    const v = C.clampView(recent.start + push, recent.end + push, NOW);
    close(v.end - v.start, 30, 1e-6);
    assert.ok(v.end <= C.maxEnd(30, NOW) + 1e-9);
  }
});

test('a view ending within an hour of its limit snaps onto it, so stale links still rest on now', () => {
  const end = C.endAtNow(2020, NOW) - C.MIN_SPAN / 48;
  const v = C.clampView(2020, end, NOW);
  assert.ok(C.atNow(v, NOW));
  const earlier = C.clampView(2020, NOW - 0.01, NOW);        // a few days short: left alone
  assert.ok(!C.atNow(earlier, NOW));
});

test('sameView and contains work at URL precision', () => {
  assert.ok(C.sameView({ start: 1, end: 2 }, { start: 1 + 1e-10, end: 2 - 1e-10 }));
  assert.ok(!C.sameView({ start: 1, end: 2 }, { start: 1.000001, end: 2 }));
  assert.ok(!C.sameView(null, { start: 1, end: 2 }));
  assert.ok(C.contains({ start: 0, end: 10 }, { start: 0, end: 10 }));
  assert.ok(!C.contains({ start: 0, end: 10 }, { start: -0.001, end: 5 }));
});

test('fitInside slides a narrower window inside its parent and leaves wider ones alone', () => {
  const outer = { start: 1000, end: 2000 };
  assert.deepEqual(C.fitInside({ start: 900, end: 1150 }, outer), { start: 1000, end: 1250 });
  assert.deepEqual(C.fitInside({ start: 1900, end: 2150 }, outer), { start: 1750, end: 2000 });
  assert.deepEqual(C.fitInside({ start: 1200, end: 1300 }, outer), { start: 1200, end: 1300 });
  const wide = { start: 0, end: 5000 };
  assert.equal(C.fitInside(wide, outer), wide);
});

test('eventWindow: ranged events get 15% padding, points a tenth of the tier span capped by age', () => {
  assert.deepEqual(C.eventWindow({ t: 1000, end: 1100 }, NOW, 1000), { start: 985, end: 1115 });
  const ancient = C.eventWindow({ t: -5000, tier: 3 }, NOW, 1000);      // 1000 / 10 = 100 years
  close(ancient.end - ancient.start, 100);
  const recent = C.eventWindow({ t: 1969.55, tier: 2 }, NOW, 5000);      // capped at max(10, age * 0.08)
  close(recent.end - recent.start, 10);
  const day = C.eventWindow({ t: 2000, tier: 7 }, NOW, 0.001);
  close(day.end - day.start, C.MIN_SPAN, 1e-12);
});

test('eventWindow keeps an on-this-day event on a view narrow enough to show it', () => {
  const w = C.eventWindow({ t: 1969.55, tier: 7, otd: true }, NOW, 10);
  assert.ok(w.end - w.start <= C.OTD_MAX_SPAN);
  close((w.start + w.end) / 2, 1969.55);
});

// ---------------------------------------------------------------- hash
test('encodeHash trims numbers, writes the now token, and appends theme and event only when set', () => {
  assert.equal(C.encodeHash({ start: 1400, end: 1600 }, NOW, 'auto', ''), '#s=1400&e=1600');
  assert.equal(C.encodeHash({ start: 1400.5, end: 1600.123456789123 }, NOW, 'nvg', ''), '#s=1400.5&e=1600.123456789&m=nvg');
  assert.equal(C.encodeHash(ROOT, NOW, 'auto', ''), '#s=-298050&e=now');
  assert.equal(C.encodeHash({ start: 1960, end: 1975 }, NOW, 'ops', 'apollo-11-lands-on-the-moon'),
    '#s=1960&e=1975&m=ops&ev=apollo-11-lands-on-the-moon');
});

test('parseHash round-trips views, including the now token with a later now', () => {
  for (const v of [{ start: 1400, end: 1600 }, { start: -72992.464313727, end: -50000.5 }, ROOT, C.clampView(2020, 2100, NOW)]) {
    const h = C.parseHash(C.encodeHash(v, NOW, 'auto', ''), NOW);
    assert.ok(C.sameView(h.view, v), JSON.stringify([v, h.view]));
  }
  const later = NOW + 0.3;                                                 // the link is opened months afterwards
  const h = C.parseHash('#s=-298050&e=now', later);
  assert.deepEqual(h.view, C.rootView(later));
  assert.ok(C.atNow(C.parseHash('#s=2020&e=now', later).view, later));
});

test('parseHash reports theme and event even when the view is unusable, and nothing for an empty hash', () => {
  assert.deepEqual(C.parseHash('', NOW), { view: null, theme: '', ev: '' });
  assert.deepEqual(C.parseHash('#', NOW), { view: null, theme: '', ev: '' });
  const h = C.parseHash('#m=crt&ev=some-event', NOW);
  assert.equal(h.view, null); assert.equal(h.theme, 'crt'); assert.equal(h.ev, 'some-event');
  assert.equal(C.parseHash('#s=5&e=1', NOW).view, null);
  assert.equal(C.parseHash('#s=abc&e=now', NOW).view, null);
  assert.equal(C.parseHash('#s=1&e=%3Cscript%3E', NOW).view, null);
});

test('parseHash clamps what it reads', () => {
  assert.deepEqual(C.parseHash('#s=-9999999&e=9999999', NOW).view, ROOT);
  const v = C.parseHash('#s=2020&e=2040', NOW).view;
  assert.ok(C.atNow(v, NOW));
});

// ---------------------------------------------------------------- slugs
test('slugify lowercases, strips accents and punctuation, and never ends in a dash', () => {
  assert.equal(C.slugify('Apollo 11 lands on the Moon'), 'apollo-11-lands-on-the-moon');
  assert.equal(C.slugify('Pachacútec, Sapa Inca'), 'pachacutec-sapa-inca');
  assert.equal(C.slugify('  “Quoted” — title!  '), 'quoted-title');
  assert.equal(C.slugify(''), 'event');
  assert.equal(C.slugify('!!!'), 'event');
  const long = C.slugify('A cease fire is announced between Honduras and El Salvador, six days after');
  assert.ok(long.length <= 64);
  assert.ok(!/-$/.test(long) && !/^-/.test(long));
});

test('slugs of the bundled titles are unique enough to need no suffix more than rarely', () => {
  for (const f of require('node:fs').readdirSync(require('node:path').join(__dirname, '../src/data')).sort()) require('../src/data/' + f);
  const seen = new Map();
  for (const e of globalThis.HT.events) seen.set(C.slugify(e.title), (seen.get(C.slugify(e.title)) || 0) + 1);
  const clashes = [...seen.values()].filter((n) => n > 1).length;
  assert.ok(clashes <= globalThis.HT.events.length * 0.01, `${clashes} slug clashes`);
});

// ---------------------------------------------------------------- regions
test('regionOf places well-known cities', () => {
  const cases = [
    ['Rome', 41.9, 12.5, 'europe'], ['London', 51.5, -0.1, 'europe'], ['Moscow', 55.8, 37.6, 'europe'],
    ['Jerusalem', 31.8, 35.2, 'asia'], ['Baghdad', 33.3, 44.4, 'asia'], ['Mecca', 21.4, 39.8, 'asia'],
    ['Beijing', 39.9, 116.4, 'asia'], ['Delhi', 28.6, 77.2, 'asia'], ['Tokyo', 35.7, 139.7, 'asia'],
    ['Cairo', 30.0, 31.2, 'africa'], ['Timbuktu', 16.8, -3.0, 'africa'], ['Cape Town', -33.9, 18.4, 'africa'],
    ['New York', 40.7, -74.0, 'namerica'], ['Tenochtitlan', 19.4, -99.1, 'namerica'],
    ['Cusco', -13.5, -72.0, 'samerica'], ['Rio', -22.9, -43.2, 'samerica'],
    ['Sydney', -33.9, 151.2, 'oceania'], ['Honolulu', 21.3, -157.9, 'oceania'], ['Port Moresby', -9.4, 147.2, 'oceania'],
  ];
  for (const [name, lat, lon, want] of cases) assert.equal(C.regionOf(lat, lon), want, name);
  assert.equal(C.regionOf(-75, 0), '', 'Antarctica has no region');
  assert.equal(C.regionOf(0, -30), '', 'nor does the mid-Atlantic');
});

test('every region key has a label and at least one box that contains a point of that region', () => {
  const keys = C.REGIONS.map((r) => r[0]);
  assert.deepEqual(Object.keys(C.REGION_BOXES).sort(), keys.slice().sort());
  for (const k of keys) {
    const b = C.REGION_BOXES[k][0];
    assert.equal(C.regionOf((b[0] + b[1]) / 2, (b[2] + b[3]) / 2), k, `centre of the first ${k} box`);
  }
});

test('officeRegion places rulers by their office, including the lanes in the data', () => {
  assert.equal(C.officeRegion('pharaoh'), 'africa');
  assert.equal(C.officeRegion('emperor of Ethiopia'), 'africa');
  assert.equal(C.officeRegion('emperor of Japan'), 'asia');
  assert.equal(C.officeRegion('general secretary of the Chinese Communist Party'), 'asia');
  assert.equal(C.officeRegion('Ottoman sultan'), 'asia');
  assert.equal(C.officeRegion('president of the United States'), 'namerica');
  assert.equal(C.officeRegion('tlatoani'), 'namerica');
  assert.equal(C.officeRegion('Sapa Inca'), 'samerica');
  assert.equal(C.officeRegion('English and British monarch'), 'europe');
  assert.equal(C.officeRegion('pope'), 'europe');
  assert.equal(C.officeRegion(''), '');
  assert.equal(C.officeRegion(undefined), '');
  const groups = new Set(globalThis.HT.events.filter((e) => e.group).map((e) => e.group));
  for (const g of groups) assert.notEqual(C.officeRegion(g), '', g);
});

// ---------------------------------------------------------------- overview scale
test('the overview scale maps ROOT_START to 0, now to the full width, and is monotonic', () => {
  close(C.mmX(T.ROOT_START, 1000, NOW), 0, 1e-9);
  close(C.mmX(NOW, 1000, NOW), 1000, 1e-9);
  let prev = -1;
  for (const t of [-298050, -100000, -10000, 0, 1000, 1900, 2000, 2025, NOW]) {
    const x = C.mmX(t, 1000, NOW);
    assert.ok(x > prev, `not increasing at ${t}`);
    prev = x;
  }
  close(C.mmX(NOW + 50, 1000, NOW), 1000, 1e-9, 'the future margin collapses onto now');
});

test('mmT inverts mmX and clamps outside the strip', () => {
  for (const t of [-250000, -3000, 1500, 1990, 2026]) close(C.mmT(C.mmX(t, 800, NOW), 800, NOW), t, 1e-6);
  close(C.mmT(-50, 800, NOW), T.ROOT_START, 1e-6);
  close(C.mmT(900, 800, NOW), NOW, 1e-9);
});

test('a thousand years ago sits near the middle of the strip, not at its right edge', () => {
  const x = C.mmX(NOW - 1000, 1000, NOW);
  assert.ok(x > 400 && x < 600, String(x));
});

// ---------------------------------------------------------------- tiers
test('effectiveTier starts from the base tier and admits finer tiers only while the view is sparse', () => {
  const list = [];
  for (let i = 0; i < 20; i++) list.push({ t: 1000 + i, tier: 3 });
  for (let i = 0; i < 5; i++) list.push({ t: 1500 + i, tier: 5 });
  list.push({ t: 1500.5, tier: 7 });
  assert.equal(C.effectiveTier(list, { start: 900, end: 1100 }, 3, 7, 8, null), 3, 'dense: stays at base');
  assert.equal(C.effectiveTier(list, { start: 1490, end: 1510 }, 3, 7, 8, null), 7, 'sparse: opens all the way');
  assert.equal(C.effectiveTier(list, { start: 1490, end: 1510 }, 3, 7, 5, null), 5, 'stops once enough are in view');
  assert.equal(C.effectiveTier(list, { start: 3000, end: 3100 }, 2, 7, 8, null), 7, 'empty: runs out of tiers');
});

test('effectiveTier counts ranged events that overlap the view and honours the include filter', () => {
  const list = [{ t: 1000, end: 2000, tier: 2 }, { t: 1500, tier: 6 }];
  const v = { start: 1400, end: 1600 };
  assert.equal(C.effectiveTier(list, v, 2, 7, 1, null), 2);
  assert.equal(C.effectiveTier(list, v, 2, 7, 1, (ev) => !ev.end), 6, 'the range is filtered out, so the view is sparse');
});

// ---------------------------------------------------------------- on this day
test('otdDays lists each calendar day once, centre first, and stays inside [1 CE, now]', () => {
  const july = C.otdDays(T.ymd(1969, 7, 1), T.ymd(1969, 7, 31), NOW);
  assert.equal(july.length, 31);
  assert.equal(new Set(july).size, 31);
  assert.ok(july.every((k) => /^07\/\d\d$/.test(k)));
  assert.ok(july[0] === '07/15' || july[0] === '07/16', 'the middle of the month loads first: ' + july[0]);
  assert.ok(['07/01', '07/31'].includes(july[30]), 'and the ends last: ' + july[30]);
  assert.deepEqual(C.otdDays(-500, -499.95, NOW), []);
  const edge = C.otdDays(NOW - 2 / 365, NOW + 0.05, NOW);
  assert.ok(edge.length >= 2 && edge.length <= 4, 'nothing past today: ' + edge.join(','));
});

test('otdDays spans a year boundary and includes Feb 29 only in leap years', () => {
  const ny = C.otdDays(T.ymd(1999, 12, 30), T.ymd(2000, 1, 2), NOW);
  for (const k of ['12/30', '12/31', '01/01', '01/02']) assert.ok(ny.includes(k), k);
  assert.ok(C.otdDays(T.ymd(2000, 2, 27), T.ymd(2000, 3, 2), NOW).includes('02/29'));
  assert.ok(!C.otdDays(T.ymd(1999, 2, 27), T.ymd(1999, 3, 2), NOW).includes('02/29'));
});

const FEED = {
  events: [
    { year: 1969, text: '  Apollo program:  Apollo 11\'s crew successfully makes the first human landing on the Moon. ',
      pages: [{ titles: { canonical: 'Apollo_program' } }, { titles: { canonical: 'Apollo_11' } }, { titles: { canonical: 'Apollo_11' } }, { titles: {} }] },
    { year: 70, text: 'Siege of Jerusalem: Titus storms the Fortress of Antonia.', pages: [{ titles: { canonical: 'Titus' } }, { titles: { canonical: 'Siege_of_Jerusalem_(70_CE)' } }] },
    { year: -50, text: 'Something from before the common era happens here.', pages: [] },
    { year: 'x', text: 'A row with a bad year is dropped entirely.', pages: [] },
    { year: 1999, text: 'short', pages: [] },
    null,
  ],
};

test('otdRows keeps year, tidy text and distinct article titles, and drops unusable rows', () => {
  const rows = C.otdRows(FEED);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], [1969, 'Apollo program: Apollo 11\'s crew successfully makes the first human landing on the Moon.', ['Apollo_program', 'Apollo_11']]);
  assert.deepEqual(C.otdRows(null), []);
  assert.deepEqual(C.otdRows({ events: 'nope' }), []);
  const many = { events: [{ year: 1900, text: 'An entry with a great many links in it.', pages: Array.from({ length: 12 }, (_, i) => ({ titles: { canonical: 'P' + i } })) }] };
  assert.equal(C.otdRows(many)[0][2].length, 6);
});

test('otdMainTitle prefers an article naming the year, then an event-like one, then the first', () => {
  assert.equal(C.otdMainTitle(['Jeff_Bezos', 'New_Shepard', '2021_in_spaceflight'], 2021), '2021_in_spaceflight');
  assert.equal(C.otdMainTitle(['Honduras', 'El_Salvador', 'Football_War'], 1969), 'Football_War');
  assert.equal(C.otdMainTitle(['Titus', 'Siege_of_Jerusalem_(70_CE)'], 70), 'Siege_of_Jerusalem_(70_CE)');
  assert.equal(C.otdMainTitle(['Isaac_Newton', 'Royal_Society'], 1703), 'Isaac_Newton');
  assert.equal(C.otdMainTitle([], 1900), '');
});

test('wikiUrl encodes titles but keeps slashes, colons and commas readable', () => {
  assert.equal(C.wikiUrl('Apollo_11'), 'https://en.wikipedia.org/wiki/Apollo_11');
  assert.equal(C.wikiUrl('Siege_of_Jerusalem_(70_CE)'), 'https://en.wikipedia.org/wiki/Siege_of_Jerusalem_(70_CE)');
  assert.equal(C.wikiUrl('AC/DC'), 'https://en.wikipedia.org/wiki/AC/DC');
  assert.equal(C.wikiUrl('Washington,_D.C.'), 'https://en.wikipedia.org/wiki/Washington,_D.C.');
  assert.match(C.wikiUrl('Dvořák?x=<y>'), /^https:\/\/en\.wikipedia\.org\/wiki\/Dvo%C5%99%C3%A1k%3Fx%3D%3Cy%3E$/);
});

test('clipWords cuts at a word, adds an ellipsis, and leaves short text alone bar its full stop', () => {
  assert.equal(C.clipWords('A short sentence.', 72), 'A short sentence');
  const long = C.clipWords('A cease fire is announced between Honduras and El Salvador, six days after the beginning of the war.', 72);
  assert.ok(long.length <= 72, String(long.length));
  assert.ok(long.endsWith('…'));
  assert.ok(!/[ ,;:.]…$/.test(long), long);
});

test('otdEvents builds point events on the right day, skips the future, non-leap Feb 29 and known entries', () => {
  const rows = C.otdRows(FEED);
  const evs = C.otdEvents('07/20', rows, NOW, 7, null);
  assert.equal(evs.length, 2);
  const apollo = evs[0];
  close(apollo.t, T.ymd(1969, 7, 20));
  assert.equal(apollo.otd, true); assert.equal(apollo.tier, 7); assert.equal(apollo.category, 'daily');
  assert.ok(apollo.title.length <= 72);
  assert.equal(apollo.detail, rows[0][1]);
  assert.equal(apollo.link, 'https://en.wikipedia.org/wiki/Apollo_program');
  assert.deepEqual(apollo.links, [{ title: 'Apollo 11', url: 'https://en.wikipedia.org/wiki/Apollo_11' }]);
  assert.equal(evs[1].link, 'https://en.wikipedia.org/wiki/Siege_of_Jerusalem_(70_CE)');

  const known = (titles) => titles.includes('Apollo_11');
  assert.equal(C.otdEvents('07/20', rows, NOW, 7, known).length, 1);
  assert.equal(C.otdEvents('12/25', [[2026, 'Something that has not happened yet at all.', []]], NOW, 7, null).length, 0);
  assert.equal(C.otdEvents('02/29', [[1900, 'Not a leap year, so this day never existed.', []], [2000, 'A leap year, so this one is kept in the list.', []]], NOW, 7, null).length, 1);
  assert.equal(C.otdEvents('01/01', [[1900, 'An entry that links to nothing at all in the feed.', []]], NOW, 7, null)[0].link, undefined);
});

// ---------------------------------------------------------------- panel
test('fmtGap reads in days, months or years, earlier or later', () => {
  assert.equal(C.fmtGap(0), 'the same day');
  assert.equal(C.fmtGap(1 / 365), 'the same day');
  assert.equal(C.fmtGap(17 / 365), '17 days later');
  assert.equal(C.fmtGap(-22 / 365), '22 days earlier');
  assert.equal(C.fmtGap(0.25), '3 months later');
  assert.equal(C.fmtGap(-1.5), '18 months earlier');
  assert.equal(C.fmtGap(3.2), '3 years later');
  assert.equal(C.fmtGap(-12000), '12,000 years earlier');
});

test('trimExtract keeps short text and cuts long text at a sentence end', () => {
  assert.equal(C.trimExtract('Short.'), 'Short.');
  assert.equal(C.trimExtract(null), '');
  const sentence = 'This is a sentence of moderate length about history. ';
  const out = C.trimExtract(sentence.repeat(20));
  assert.ok(out.length <= 560);
  assert.ok(out.endsWith('.'));
  const unbroken = C.trimExtract('word '.repeat(200));
  assert.ok(unbroken.length <= 561 && unbroken.endsWith('…'));
});

test('yearArticle follows Wikipedia\'s naming: bare years from 101, AD before, BC before that, nothing too early', () => {
  assert.equal(C.yearArticle(1969), '1969');
  assert.equal(C.yearArticle(101), '101');
  assert.equal(C.yearArticle(100), 'AD_100');
  assert.equal(C.yearArticle(1), 'AD_1');
  assert.equal(C.yearArticle(-44), '44_BC');
  assert.equal(C.yearArticle(-800), '800_BC');
  assert.equal(C.yearArticle(-801), '');
  assert.equal(C.yearArticle(0), '');
  assert.equal(C.yearArticle(NaN), '');
});

const LIST = [
  { t: 1000, tier: 3, category: 'science' },            // 0
  { t: 1010, tier: 7, category: 'earth' },              // 1  too fine to be a neighbour of a tier-3 event
  { t: 1020, tier: 4, category: 'war' },                // 2
  { t: 1030, tier: 3, category: 'science' },            // 3  <- the open event in most tests
  { t: 1031, tier: 3, category: 'politics', group: 'pope' },   // 4  rulers are never neighbours
  { t: 1032, tier: 7, category: 'daily', otd: true },   // 5  nor are on-this-day entries
  { t: 1040, tier: 2, category: 'art' },                // 6
  { t: 1050, tier: 4, category: 'science' },            // 7
  { t: 1060, tier: 4, category: 'science' },            // 8
  { t: 900, tier: 3, category: 'science' },             // 9
  { t: 1100, tier: 3, category: 'politics', group: 'pope' },   // 10
  { t: 950, tier: 3, category: 'politics', group: 'pope' },    // 11
];

test('pickNearby returns two before and two after in time order, of comparable tier only', () => {
  assert.deepEqual(C.pickNearby(LIST, 3, null), [0, 2, 6, 7]);
  assert.deepEqual(C.pickNearby(LIST, 9, null), [0, 2], 'nothing earlier than the first event');
  assert.deepEqual(C.pickNearby(LIST, 99, null), []);
});

test('pickNearby honours the filter and widens the tier cap for fine-grained events', () => {
  assert.deepEqual(C.pickNearby(LIST, 3, (ev) => ev.category !== 'war'), [9, 0, 6, 7]);
  assert.ok(C.pickNearby(LIST, 1, null).length === 4);
  const fine = [{ t: 1, tier: 7 }, { t: 2, tier: 7 }, { t: 3, tier: 7 }];
  assert.deepEqual(C.pickNearby(fine, 1, null), [0, 2], 'a tier-7 event may have tier-7 neighbours');
});

test('pickNearby gives a ruler the previous and next holder of the same office', () => {
  assert.deepEqual(C.pickNearby(LIST, 4, null), [11, 10]);
  assert.deepEqual(C.pickNearby(LIST, 11, null), [4], 'the first holder has only a successor');
});

test('pickRelated returns the three nearest of the same category in time order, excluding given indices', () => {
  assert.deepEqual(C.pickRelated(LIST, 3, [], null), [0, 7, 8]);
  assert.deepEqual(C.pickRelated(LIST, 3, [0, 7], null), [9, 8]);
  assert.deepEqual(C.pickRelated(LIST, 4, [], null), [], 'rulers have no related list');
  assert.deepEqual(C.pickRelated(LIST, 5, [], null), [], 'nor do on-this-day entries');
});

test('pickRelated prefers the same region: a distant same-region event beats a nearer foreign one', () => {
  const regions = { 0: 'asia', 3: 'europe', 7: 'asia', 8: 'asia', 9: 'europe' };
  const at = (i) => regions[i] || '';
  const picked = C.pickRelated(LIST, 3, [], at);
  assert.ok(picked.includes(9), 'the European event 130 years away is kept');
  assert.equal(picked.length, 3);
  assert.equal(picked.indexOf(9), 0, 'and the list is still in time order');
});
