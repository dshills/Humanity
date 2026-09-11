'use strict';
// test/ticks.test.js — HT.ticks.computeTicks, written against CONTRACT.md §4
// (tick contract) and §2 (HT.time helpers). time.js is loaded first because
// ticks.js reads HT.time at call time.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../src/time.js');
require('../src/ticks.js');

const HT = globalThis.HT;
const T = HT.time;
const computeTicks = (...args) => HT.ticks.computeTicks(...args);

// ---------------------------------------------------------------------------
// Contract constants and helpers
// ---------------------------------------------------------------------------

const PRESENT = 1950; // CONTRACT §2: "years ago" reference year
const NOW = T.now();

const REGIMES = ['ago', 'year', 'month', 'day'];
const UNITS = ['years', 'months', 'days'];
const UNIT_FOR_REGIME = { ago: 'years', year: 'years', month: 'months', day: 'days' };

// Ladder (CONTRACT §4): years 1,2,5 × 10^n; months 1,2,3,6; days 1,2,7,14.
const YEAR_LADDER = (() => {
  const out = [];
  for (let n = 1; n <= 1e7; n *= 10) out.push(1 * n, 2 * n, 5 * n);
  return out;
})();
const LADDERS = { years: YEAR_LADDER, months: [1, 2, 3, 6], days: [1, 2, 7, 14] };

// Nominal length of one unit in years (only used to reason about step
// selection in cases chosen with a comfortable margin).
const UNIT_YEARS = { years: 1, months: 1 / 12, days: 1 / 365.25 };

const DEFAULT_TARGET = 110;
const DEFAULT_GAP = 12;
const defaultLabelWidth = (label) => label.length * 7;

const pxOf = (t, start, end, w) => ((t - start) / (end - start)) * w;
const nominalPx = (step, unit, span, w) => ((step * UNIT_YEARS[unit]) / span) * w;

function expectedStep(unit, span, w, target = DEFAULT_TARGET) {
  return LADDERS[unit].find((s) => nominalPx(s, unit, span, w) >= target);
}

function prevLadderStep(unit, step) {
  const L = LADDERS[unit];
  const i = L.indexOf(step);
  return i > 0 ? L[i - 1] : null;
}

// CONTRACT §4: 5 subdivisions when the step's leading digit is 1 or 5, 4 when
// it is 2; months/days always 4. Minors strictly between two consecutive
// majors therefore number (subdivisions - 1).
function subdivisionsFor(res) {
  if (res.unit !== 'years') return 4;
  return String(res.step)[0] === '2' ? 4 : 5;
}

// toParts nudged forward by ~3 seconds so a tick that sits exactly on a
// midnight boundary can never be read back as the previous day by float noise.
const partsOf = (t) => T.toParts(t + 1e-7);

const labeledLabels = (res) => res.major.filter((m) => m.labeled).map((m) => m.label);
const labelsOf = (res) => res.major.map((m) => m.label);

function interior(res, start, end) {
  const eps = Math.max(Math.abs(start), Math.abs(end), 1) * 1e-9;
  return res.major.filter((m) => m.t > start + eps && m.t < end - eps);
}

function assertSubsequence(actual, expected, msg) {
  let i = 0;
  for (const a of actual) if (i < expected.length && a === expected[i]) i++;
  assert.equal(
    i,
    expected.length,
    `${msg}: expected ${JSON.stringify(expected)} in order inside ${JSON.stringify(actual)}`
  );
}

function view(start, end, w) {
  return `[${start}, ${end}] @${w}px`;
}

// Between every pair of consecutive majors there are exactly (sub - 1) minors,
// evenly spaced in t (CONTRACT §4). The single interval that starts at the
// epoch tick (t = 1 -> fromHistYear(step)) in the year regime is step-1 years
// long, so "evenly spaced" and "nice historical years" disagree there; for that
// one gap only the count is enforced.
function assertMinorsBetween(res, start, end, sub, where) {
  const eps = Math.max(Math.abs(start), Math.abs(end), 1) * 1e-9;
  for (let i = 0; i + 1 < res.major.length; i++) {
    const a = res.major[i].t;
    const b = res.major[i + 1].t;
    const between = res.minor.filter((x) => x > a + eps && x < b - eps);
    assert.equal(
      between.length,
      sub - 1,
      `${sub - 1} minors between majors ${res.major[i].label} (${a}) and ${res.major[i + 1].label} (${b})${where}`
    );
    const afterEpoch = res.regime === 'year' && res.step >= 2 && a === 1;
    if (afterEpoch) continue;
    const tol = 1e-8 * Math.max(1, Math.abs(a));
    between.forEach((x, k) => {
      const want = a + ((k + 1) * (b - a)) / sub;
      assert.ok(Math.abs(x - want) < tol, `minor ${x} evenly spaced (expected ${want})${where}`);
    });
  }
}

// Every structural rule from CONTRACT §4 that holds for any view.
function assertInvariants(res, start, end, w, opts = {}, ctx = '') {
  const span = end - start;
  const eps = Math.max(Math.abs(start), Math.abs(end), 1) * 1e-9;
  const where = ` [${ctx || view(start, end, w)}]`;

  assert.ok(res && typeof res === 'object', `result is an object${where}`);
  assert.ok(REGIMES.includes(res.regime), `regime "${res.regime}" is one of ${REGIMES}${where}`);
  assert.equal(res.regime, T.regimeForSpan(span), `regime equals HT.time.regimeForSpan(span)${where}`);
  assert.ok(UNITS.includes(res.unit), `unit "${res.unit}" is one of ${UNITS}${where}`);
  assert.equal(res.unit, UNIT_FOR_REGIME[res.regime], `unit matches regime${where}`);
  assert.equal(typeof res.step, 'number', `step is a number${where}`);
  assert.ok(res.step > 0, `step is positive${where}`);
  assert.ok(LADDERS[res.unit].includes(res.step), `step ${res.step} is on the ${res.unit} ladder${where}`);
  assert.ok(Array.isArray(res.major), `major is an array${where}`);
  assert.ok(Array.isArray(res.minor), `minor is an array${where}`);

  // --- majors -------------------------------------------------------------
  let prev = -Infinity;
  for (const m of res.major) {
    assert.equal(typeof m.t, 'number', `major.t is a number${where}`);
    assert.ok(Number.isFinite(m.t), `major.t is finite${where}`);
    assert.equal(typeof m.label, 'string', `major.label is a string${where}`);
    assert.ok(m.label.length > 0, `major.label is non-empty${where}`);
    assert.equal(typeof m.labeled, 'boolean', `major.labeled is a boolean${where}`);
    assert.ok(m.t > prev, `majors sorted strictly ascending (${prev} -> ${m.t})${where}`);
    prev = m.t;
    assert.ok(m.t >= start - eps && m.t <= end + eps, `major ${m.t} lies inside the view${where}`);
    assert.equal(m.label, T.formatDate(m.t, span), `label is formatDate(t, span) for t=${m.t}${where}`);

    if (res.regime === 'ago') {
      const k = (PRESENT - m.t) / res.step;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `ago tick t=${m.t} is PRESENT - k*step${where}`);
    } else if (res.regime === 'year') {
      if (res.step === 1) {
        assert.ok(Number.isInteger(m.t), `step-1 tick t=${m.t} is an integer${where}`);
      } else {
        const h = T.histYear(m.t);
        assert.ok(
          m.t === 1 || (h % res.step === 0 && m.t === T.fromHistYear(h)),
          `year tick t=${m.t} is the epoch or fromHistYear(multiple of ${res.step})${where}`
        );
      }
    } else if (res.regime === 'month') {
      const p = partsOf(m.t);
      assert.equal(p.day, 1, `month tick t=${m.t} is on the 1st${where}`);
      assert.equal((p.month - 1) % res.step, 0, `month tick month=${p.month} matches step ${res.step}${where}`);
      assert.equal(p.hour, 0, `month tick at midnight (hour)${where}`);
      assert.equal(p.minute, 0, `month tick at midnight (minute)${where}`);
    } else {
      const p = partsOf(m.t);
      assert.equal((p.day - 1) % res.step, 0, `day tick day=${p.day} is 1 + k*${res.step}${where}`);
      assert.equal(p.hour, 0, `day tick at midnight (hour)${where}`);
      assert.equal(p.minute, 0, `day tick at midnight (minute)${where}`);
    }
  }
  if (res.major.length > 0) {
    assert.equal(res.major[0].labeled, true, `first major is always labeled${where}`);
  }

  // --- minors -------------------------------------------------------------
  prev = -Infinity;
  for (const x of res.minor) {
    assert.equal(typeof x, 'number', `minor is a number${where}`);
    assert.ok(Number.isFinite(x), `minor is finite${where}`);
    assert.ok(x > prev, `minors sorted strictly ascending (${prev} -> ${x})${where}`);
    prev = x;
    assert.ok(x >= start - eps && x <= end + eps, `minor ${x} lies inside the view${where}`);
    for (const m of res.major) {
      assert.ok(Math.abs(x - m.t) > eps, `minor ${x} coincides with major ${m.t}${where}`);
    }
  }
  assertMinorsBetween(res, start, end, subdivisionsFor(res), where);

  // --- overlap thinning ---------------------------------------------------
  const lw = opts.labelWidth || defaultLabelWidth;
  const gap = opts.labelGap === undefined ? DEFAULT_GAP : opts.labelGap;
  let prevRight = -Infinity;
  for (const m of res.major) {
    if (!m.labeled) continue;
    const c = pxOf(m.t, start, end, w);
    const half = lw(m.label) / 2;
    assert.ok(
      c - half >= prevRight + gap - 1e-6,
      `labeled label "${m.label}" (left ${c - half}px) clears previous right edge ${prevRight}px + gap ${gap}${where}`
    );
    prevRight = c + half;
  }
}

// ---------------------------------------------------------------------------
// Case tables
// ---------------------------------------------------------------------------

// Regime / unit / step by span (boundaries from CONTRACT §2 table).
const BOUNDARY_CASES = [
  { name: 'root span (~300,000 y) -> ago', start: T.ROOT_START, end: NOW, w: 1400, regime: 'ago', unit: 'years', step: 50000 },
  { name: 'span 20,001 -> ago', start: T.ce(2000) - 20001, end: T.ce(2000), w: 1200, regime: 'ago', unit: 'years', step: 2000 },
  { name: 'span 20,000 -> year', start: T.ce(2000) - 20000, end: T.ce(2000), w: 1200, regime: 'year', unit: 'years', step: 2000 },
  { name: 'span 5,025 (3000 BCE..2026) -> year', start: T.bce(3000), end: T.ce(2026), w: 1200, regime: 'year', unit: 'years', step: 500 },
  { name: 'span 2 y + 1 day -> year', start: T.ce(1969), end: T.ce(1971, 1, 2), w: 1200, regime: 'year', unit: 'years', step: 1 },
  { name: 'span 2 y -> month', start: T.ce(1969), end: T.ce(1971), w: 1200, regime: 'month', unit: 'months', step: 3 },
  { name: 'span 1 y -> month', start: T.ce(1969), end: T.ce(1970), w: 1200, regime: 'month', unit: 'months', step: 2 },
  { name: 'span 0.26 y -> month', start: T.ce(1969), end: T.ce(1969) + 0.26, w: 1200, regime: 'month', unit: 'months', step: 1 },
  { name: 'span 0.25 y -> day', start: T.ce(1969), end: T.ce(1969) + 0.25, w: 1200, regime: 'day', unit: 'days', step: 14 },
  { name: 'span 30 days -> day', start: T.ce(1969, 7, 1), end: T.ce(1969, 7, 31), w: 1200, regime: 'day', unit: 'days', step: 7 },
];

// Step selection: smallest ladder interval whose spacing >= targetPx.
// Every case is chosen so that the answer is the same whether the
// implementation measures month/day spacing nominally or by calendar length.
const STEP_CASES = [
  { name: 'root @1400', start: T.ROOT_START, end: NOW, w: 1400, unit: 'years', step: 50000 },
  { name: 'root @375', start: T.ROOT_START, end: NOW, w: 375, unit: 'years', step: 100000 },
  { name: 'root @3000', start: T.ROOT_START, end: NOW, w: 3000, unit: 'years', step: 20000 },
  { name: '3000 BCE..2026 @1200', start: T.bce(3000), end: T.ce(2026), w: 1200, unit: 'years', step: 500 },
  { name: '3000 BCE..2026 @1000', start: T.bce(3000), end: T.ce(2026), w: 1000, unit: 'years', step: 1000 },
  { name: '3000 BCE..2026 @1200 targetPx=200', start: T.bce(3000), end: T.ce(2026), w: 1200, opts: { targetPx: 200 }, unit: 'years', step: 1000 },
  { name: '8000 BCE..2000 @1400', start: T.bce(8000), end: T.ce(2000), w: 1400, unit: 'years', step: 1000 },
  { name: '1000..2000 @1400', start: T.ce(1000), end: T.ce(2000), w: 1400, unit: 'years', step: 100 },
  { name: '1500..2000 @1200', start: T.ce(1500), end: T.ce(2000), w: 1200, unit: 'years', step: 50 },
  { name: '1800..2000 @1200', start: T.ce(1800), end: T.ce(2000), w: 1200, unit: 'years', step: 20 },
  { name: '1920..2020 @1200', start: T.ce(1920), end: T.ce(2020), w: 1200, unit: 'years', step: 10 },
  { name: '1920..2020 @320', start: T.ce(1920), end: T.ce(2020), w: 320, unit: 'years', step: 50 },
  { name: '1920..2020 @1200 targetPx=50', start: T.ce(1920), end: T.ce(2020), w: 1200, opts: { targetPx: 50 }, unit: 'years', step: 5 },
  { name: '1920..2020 @1200 targetPx=160', start: T.ce(1920), end: T.ce(2020), w: 1200, opts: { targetPx: 160 }, unit: 'years', step: 20 },
  { name: '1970..2020 @1200', start: T.ce(1970), end: T.ce(2020), w: 1200, unit: 'years', step: 5 },
  { name: '2000..2020 @1200', start: T.ce(2000), end: T.ce(2020), w: 1200, unit: 'years', step: 2 },
  { name: '2010..2020 @1200', start: T.ce(2010), end: T.ce(2020), w: 1200, unit: 'years', step: 1 },
  { name: 'Jan 1969..Jan 1970 @1200', start: T.ce(1969), end: T.ce(1970), w: 1200, unit: 'months', step: 2 },
  { name: 'Jan 1969..Jul 1969 @1200', start: T.ce(1969), end: T.ce(1969, 7, 1), w: 1200, unit: 'months', step: 1 },
  { name: 'Jan 1969..Jan 1971 @1200', start: T.ce(1969), end: T.ce(1971), w: 1200, unit: 'months', step: 3 },
  { name: 'Jan 1969..Jan 1970 @320', start: T.ce(1969), end: T.ce(1970), w: 320, unit: 'months', step: 6 },
  { name: 'Jan 1969..Jan 1970 @1200 targetPx=80', start: T.ce(1969), end: T.ce(1970), w: 1200, opts: { targetPx: 80 }, unit: 'months', step: 1 },
  { name: 'Jul 1..Jul 31 1969 @1200', start: T.ce(1969, 7, 1), end: T.ce(1969, 7, 31), w: 1200, unit: 'days', step: 7 },
  { name: 'Jul 1..Jul 19 1969 @1200', start: T.ce(1969, 7, 1), end: T.ce(1969, 7, 19), w: 1200, unit: 'days', step: 2 },
  { name: 'Jul 1..Jul 8 1969 @1200', start: T.ce(1969, 7, 1), end: T.ce(1969, 7, 8), w: 1200, unit: 'days', step: 1 },
  { name: 'Jul 1..Sep 29 1969 @1200', start: T.ce(1969, 7, 1), end: T.ce(1969, 9, 29), w: 1200, unit: 'days', step: 14 },
  { name: 'Jul 1..Jul 31 1969 @320', start: T.ce(1969, 7, 1), end: T.ce(1969, 7, 31), w: 320, unit: 'days', step: 14 },
];

// Non-empty majors across the whole zoom range at phone and ultra-wide widths.
// Spans <= 10 years are centred on 2020-01-01 so a tick is strictly interior;
// longer spans end at 2020-01-01 so at least one "years ago" tick (k >= 1)
// falls strictly inside the view.
const SPAN_CASES = [
  ['1 day', 1 / 365.25],
  ['30 days', 30 / 365.25],
  ['1 year', 1],
  ['10 years', 10],
  ['100 years', 100],
  ['1,000 years', 1000],
  ['10,000 years', 10000],
  ['100,000 years', 100000],
  ['301,950 years', 301950],
].map(([name, span]) => {
  const anchor = T.ce(2020);
  return span <= 10
    ? { name, start: anchor - span / 2, end: anchor + span / 2 }
    : { name, start: anchor - span, end: anchor };
});
const SPAN_WIDTHS = [320, 4000];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HT.ticks module', () => {
  it('is registered on globalThis.HT with a computeTicks function', () => {
    assert.ok(HT, 'globalThis.HT exists');
    assert.ok(HT.ticks, 'HT.ticks exists');
    assert.equal(typeof HT.ticks.computeTicks, 'function');
  });

  it('returns the contract shape { regime, unit, step, major, minor }', () => {
    const res = computeTicks(T.ROOT_START, NOW, 1400);
    for (const key of ['regime', 'unit', 'step', 'major', 'minor']) {
      assert.ok(Object.prototype.hasOwnProperty.call(res, key), `has "${key}"`);
    }
    assert.ok(REGIMES.includes(res.regime));
    assert.ok(UNITS.includes(res.unit));
    assert.equal(typeof res.step, 'number');
    assert.ok(Array.isArray(res.major));
    assert.ok(Array.isArray(res.minor));
    assert.ok(res.major.length > 0);
    for (const m of res.major) {
      assert.deepEqual(Object.keys(m).sort(), ['label', 'labeled', 't'].sort());
    }
  });
});

describe('regime and unit selection by span', () => {
  for (const c of BOUNDARY_CASES) {
    it(c.name, () => {
      const span = c.end - c.start;
      const res = computeTicks(c.start, c.end, c.w);
      assert.equal(res.regime, c.regime, `regime for span ${span}`);
      assert.equal(res.regime, T.regimeForSpan(span), 'regime agrees with HT.time.regimeForSpan');
      assert.equal(res.unit, c.unit, `unit for span ${span}`);
      if (c.step !== undefined) assert.equal(res.step, c.step, `step for span ${span}`);
      assertInvariants(res, c.start, c.end, c.w, {}, c.name);
    });
  }

  it('unit is years in the ago and year regimes, months in month, days in day', () => {
    for (const c of [...BOUNDARY_CASES, ...STEP_CASES]) {
      const res = computeTicks(c.start, c.end, c.w, c.opts);
      assert.equal(res.unit, UNIT_FOR_REGIME[res.regime], `${c.name}: unit for regime ${res.regime}`);
    }
  });
});

describe('root view ("ago" regime)', () => {
  const start = T.ROOT_START;
  const end = NOW;

  it('at 1400px uses the ago regime, years unit and a 50,000-year step', () => {
    const res = computeTicks(start, end, 1400);
    assert.equal(res.regime, 'ago');
    assert.equal(res.unit, 'years');
    assert.equal(res.step, 50000);
    assertInvariants(res, start, end, 1400, {}, 'root @1400');
  });

  it('places every major at t = 1950 - k*step with a formatAgo label', () => {
    const res = computeTicks(start, end, 1400);
    assert.ok(res.major.length >= 5, 'at least 5 majors (300,000 .. 50,000 years ago)');
    for (const m of res.major) {
      const k = (PRESENT - m.t) / res.step;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `t=${m.t} is 1950 - k*${res.step}`);
      assert.equal(m.label, T.formatAgo(m.t));
      assert.match(m.label, /^\d{1,3}(,\d{3})* years ago$/);
    }
  });

  it('labels read 250,000 / 200,000 / 150,000 / 100,000 / 50,000 years ago, in order', () => {
    const res = computeTicks(start, end, 1400);
    assertSubsequence(
      labeledLabels(res),
      ['250,000 years ago', '200,000 years ago', '150,000 years ago', '100,000 years ago', '50,000 years ago'],
      'root labels'
    );
    const quarterMillion = res.major.find((m) => m.label === '250,000 years ago');
    assert.ok(quarterMillion, '250,000 years ago tick exists');
    assert.equal(quarterMillion.t, PRESENT - 5 * 50000);
    assert.equal(quarterMillion.labeled, true);
  });

  it('at 1400px no label needs thinning', () => {
    const res = computeTicks(start, end, 1400);
    assert.ok(res.major.every((m) => m.labeled === true), 'every root major is labeled at 1400px');
  });

  it('minor ticks at 1400px sit at 10,000-year multiples (5 subdivisions of 50,000)', () => {
    const res = computeTicks(start, end, 1400);
    assert.ok(res.minor.length >= 4 * (res.major.length - 1));
    for (const x of res.minor) {
      const k = (PRESENT - x) / 10000;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `minor ${x} is 1950 - k*10000`);
    }
  });

  it('at 375px steps up to 100,000 years and thins every other label', () => {
    const res = computeTicks(start, end, 375);
    assert.equal(res.regime, 'ago');
    assert.equal(res.step, 100000);
    assert.ok(res.major.length >= 3);
    // 17-char labels are 119px wide on a 125px pitch -> the second must drop.
    assert.deepEqual(
      res.major.slice(0, 3).map((m) => m.labeled),
      [true, false, true]
    );
    assertInvariants(res, start, end, 375, {}, 'root @375');
  });

  it('resizing from 1400px to 375px reduces the number of major ticks', () => {
    const wide = computeTicks(start, end, 1400);
    const narrow = computeTicks(start, end, 375);
    assert.ok(wide.major.length > narrow.major.length, `${wide.major.length} > ${narrow.major.length}`);
  });
});

describe('"year" regime positions and labels', () => {
  it('step 1000 over 3000 BCE..2026 CE at 1200px labels exactly 3000 BCE .. 2000', () => {
    const start = T.bce(3000);
    const end = T.ce(2026);
    // The default targetPx (110) would pick 500 at 1200px (119px pitch);
    // targetPx 200 forces the contract's step-1000 example at this width.
    const res = computeTicks(start, end, 1200, { targetPx: 200 });
    assert.equal(res.regime, 'year');
    assert.equal(res.unit, 'years');
    assert.equal(res.step, 1000);
    assert.deepEqual(labeledLabels(res), ['3000 BCE', '2000 BCE', '1000 BCE', '1 CE', '1000', '2000']);
    assert.deepEqual(
      res.major.map((m) => m.t),
      [T.bce(3000), T.bce(2000), T.bce(1000), 1, T.ce(1000), T.ce(2000)]
    );
    assertInvariants(res, start, end, 1200, { targetPx: 200 }, 'step 1000 @1200 targetPx 200');
  });

  it('step 1000 over 3000 BCE..2026 CE at 1000px (default opts) gives the same labels', () => {
    const start = T.bce(3000);
    const end = T.ce(2026);
    const res = computeTicks(start, end, 1000);
    assert.equal(res.step, 1000);
    assert.deepEqual(labeledLabels(res), ['3000 BCE', '2000 BCE', '1000 BCE', '1 CE', '1000', '2000']);
    assertInvariants(res, start, end, 1000, {}, 'step 1000 @1000');
  });

  it('the epoch tick at t = 1 (1 CE) stands in for historical year 0', () => {
    const res = computeTicks(T.bce(3000), T.ce(2026), 1000);
    const epoch = res.major.find((m) => m.t === 1);
    assert.ok(epoch, 'has a major at t = 1');
    assert.equal(epoch.label, '1 CE');
    assert.ok(!res.major.some((m) => m.t === 0), 'no major at t = 0 when step >= 2');
  });

  it('step 10 over 50 BCE..50 CE lands on multiples of 10 via fromHistYear plus the epoch', () => {
    const start = T.bce(50);
    const end = T.ce(50);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.regime, 'year');
    assert.equal(res.step, 10);
    assert.deepEqual(
      interior(res, start, end).map((m) => m.label),
      ['40 BCE', '30 BCE', '20 BCE', '10 BCE', '1 CE', '10 CE', '20 CE', '30 CE', '40 CE']
    );
    assert.deepEqual(
      interior(res, start, end).map((m) => m.t),
      [T.fromHistYear(-40), T.fromHistYear(-30), T.fromHistYear(-20), T.fromHistYear(-10), 1, 10, 20, 30, 40]
    );
    for (const m of res.major) {
      assert.equal(m.labeled, true, `${m.label} labeled (42px labels on a 121px pitch never overlap)`);
    }
    assertInvariants(res, start, end, 1200, {}, 'step 10 across the epoch');
  });

  it('step 1 uses every integer t with formatYear labels including 1 BCE and 1 CE', () => {
    const start = T.bce(3); // t = -2
    const end = T.ce(4); // t = 4
    const res = computeTicks(start, end, 1200);
    assert.equal(res.regime, 'year');
    assert.equal(res.unit, 'years');
    assert.equal(res.step, 1);
    for (const m of res.major) {
      assert.ok(Number.isInteger(m.t), `t=${m.t} is an integer`);
      assert.equal(m.label, T.formatYear(m.t));
      assert.equal(m.labeled, true);
    }
    assert.deepEqual(
      interior(res, start, end).map((m) => m.label),
      ['2 BCE', '1 BCE', '1 CE', '2 CE', '3 CE']
    );
    const oneBce = res.major.find((m) => m.label === '1 BCE');
    const oneCe = res.major.find((m) => m.label === '1 CE');
    assert.ok(oneBce && oneCe, 'both 1 BCE and 1 CE are present');
    assert.equal(oneBce.t, 0);
    assert.equal(oneCe.t, 1);
    assertInvariants(res, start, end, 1200, {}, 'step 1 across the epoch');
  });

  it('step 1 over 1960..1970 labels plain CE years', () => {
    const start = T.ce(1960);
    const end = T.ce(1970);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.step, 1);
    assert.deepEqual(
      interior(res, start, end).map((m) => m.label),
      ['1961', '1962', '1963', '1964', '1965', '1966', '1967', '1968', '1969']
    );
    assertInvariants(res, start, end, 1200, {}, 'step 1 1960..1970');
  });

  it('step >= 2 majors are fromHistYear(multiple of step) or the epoch, for every year-regime case', () => {
    for (const c of [...BOUNDARY_CASES, ...STEP_CASES]) {
      const res = computeTicks(c.start, c.end, c.w, c.opts);
      if (res.regime !== 'year' || res.step < 2) continue;
      for (const m of res.major) {
        const h = T.histYear(m.t);
        assert.ok(
          m.t === 1 || (h % res.step === 0 && m.t === T.fromHistYear(h)),
          `${c.name}: t=${m.t} (hist ${h}) is a multiple of ${res.step} or the epoch`
        );
      }
    }
  });
});

describe('step selection', () => {
  for (const c of STEP_CASES) {
    it(`${c.name} -> ${c.step} ${c.unit}`, () => {
      const span = c.end - c.start;
      const opts = c.opts || {};
      const target = opts.targetPx === undefined ? DEFAULT_TARGET : opts.targetPx;
      const res = computeTicks(c.start, c.end, c.w, c.opts);

      assert.equal(res.unit, c.unit);
      assert.equal(res.step, c.step);
      assert.equal(res.step, expectedStep(c.unit, span, c.w, target), 'matches the independently computed ladder choice');

      // The chosen step's spacing meets targetPx ...
      assert.ok(
        nominalPx(res.step, res.unit, span, c.w) >= target,
        `spacing ${nominalPx(res.step, res.unit, span, c.w)}px >= targetPx ${target}`
      );
      // ... and the next-smaller ladder step would not.
      const smaller = prevLadderStep(res.unit, res.step);
      if (smaller !== null) {
        assert.ok(
          nominalPx(smaller, res.unit, span, c.w) < target,
          `next-smaller step ${smaller} would give ${nominalPx(smaller, res.unit, span, c.w)}px < ${target}`
        );
      }
      assertInvariants(res, c.start, c.end, c.w, opts, c.name);
    });
  }

  it('a larger targetPx never picks a smaller step, a smaller targetPx never picks a larger one', () => {
    const start = T.ce(1920);
    const end = T.ce(2020);
    const steps = [40, 80, 110, 160, 240, 400].map((targetPx) => computeTicks(start, end, 1200, { targetPx }).step);
    for (let i = 1; i < steps.length; i++) {
      assert.ok(steps[i] >= steps[i - 1], `steps are monotone in targetPx: ${steps}`);
    }
    assert.ok(steps[0] < steps[steps.length - 1], 'targetPx actually changes the step');
  });

  it('opts.targetPx changes the chosen step without changing the regime', () => {
    const start = T.bce(3000);
    const end = T.ce(2026);
    const a = computeTicks(start, end, 1200);
    const b = computeTicks(start, end, 1200, { targetPx: 200 });
    assert.equal(a.regime, b.regime);
    assert.equal(a.unit, b.unit);
    assert.equal(a.step, 500);
    assert.equal(b.step, 1000);
  });
});

describe('"month" regime', () => {
  it('Jan 1969..Jan 1970 at 1200px: 2-month step on the 1st of odd months', () => {
    const start = T.ce(1969);
    const end = T.ce(1970);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.regime, 'month');
    assert.equal(res.unit, 'months');
    assert.equal(res.step, 2);
    for (const m of res.major) {
      const p = partsOf(m.t);
      assert.equal(p.day, 1, `${m.label} is on the 1st`);
      assert.equal((p.month - 1) % 2, 0, `${m.label} month ${p.month} is on the step grid`);
      assert.ok(Math.abs(m.t - T.ymd(p.year, p.month, 1)) < 1e-6, `${m.label} equals ymd(y, m, 1)`);
    }
    const inside = interior(res, start, end);
    assert.deepEqual(inside.map((m) => [partsOf(m.t).year, partsOf(m.t).month]), [[1969, 3], [1969, 5], [1969, 7], [1969, 9], [1969, 11]]);
    assert.deepEqual(inside.map((m) => m.label), ['Mar 1969', 'May 1969', 'Jul 1969', 'Sep 1969', 'Nov 1969']);
    assert.ok(res.major.every((m) => m.labeled), '56px labels on a ~200px pitch are all labeled');
    assertInvariants(res, start, end, 1200, {}, 'months step 2');
  });

  it('Jan 1969..Jan 1971 at 1200px: 3-month step -> Jan/Apr/Jul/Oct', () => {
    const start = T.ce(1969);
    const end = T.ce(1971);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.regime, 'month');
    assert.equal(res.step, 3);
    assert.deepEqual(
      interior(res, start, end).map((m) => [partsOf(m.t).year, partsOf(m.t).month]),
      [[1969, 4], [1969, 7], [1969, 10], [1970, 1], [1970, 4], [1970, 7], [1970, 10]]
    );
    assert.deepEqual(
      interior(res, start, end).map((m) => m.label),
      ['Apr 1969', 'Jul 1969', 'Oct 1969', 'Jan 1970', 'Apr 1970', 'Jul 1970', 'Oct 1970']
    );
    assertInvariants(res, start, end, 1200, {}, 'months step 3');
  });

  it('Jan 1969..Jan 1970 at 320px: 6-month step -> only Jul 1969 strictly inside', () => {
    const start = T.ce(1969);
    const end = T.ce(1970);
    const res = computeTicks(start, end, 320);
    assert.equal(res.step, 6);
    assert.deepEqual(interior(res, start, end).map((m) => m.label), ['Jul 1969']);
    assertInvariants(res, start, end, 320, {}, 'months step 6');
  });

  it('every month-regime major is at midnight on the 1st', () => {
    for (const c of [...BOUNDARY_CASES, ...STEP_CASES]) {
      const res = computeTicks(c.start, c.end, c.w, c.opts);
      if (res.regime !== 'month') continue;
      for (const m of res.major) {
        const p = partsOf(m.t);
        assert.equal(p.day, 1, `${c.name}: ${m.label} day`);
        assert.equal(p.hour, 0, `${c.name}: ${m.label} hour`);
        assert.equal(p.minute, 0, `${c.name}: ${m.label} minute`);
      }
    }
  });
});

describe('"day" regime', () => {
  it('Jul 1..Jul 31 1969 at 1200px: 7-day step on days 1, 8, 15, 22, 29', () => {
    const start = T.ce(1969, 7, 1);
    const end = T.ce(1969, 7, 31);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.regime, 'day');
    assert.equal(res.unit, 'days');
    assert.equal(res.step, 7);
    const days = res.major.map((m) => partsOf(m.t).day);
    for (const d of days) assert.ok([1, 8, 15, 22, 29].includes(d), `day ${d} is 1 + k*7`);
    assert.deepEqual(interior(res, start, end).map((m) => partsOf(m.t).day), [8, 15, 22, 29]);
    assert.deepEqual(
      interior(res, start, end).map((m) => m.label),
      ['Jul 8, 1969', 'Jul 15, 1969', 'Jul 22, 1969', 'Jul 29, 1969']
    );
    assert.ok(res.major.every((m) => m.labeled), '84px labels on a 280px pitch are all labeled');
    assertInvariants(res, start, end, 1200, {}, 'days step 7');
  });

  it('the day sequence resets on the 1st of each month (Jul 20..Aug 20 1969)', () => {
    const start = T.ce(1969, 7, 20);
    const end = T.ce(1969, 8, 20);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.regime, 'day');
    assert.equal(res.step, 7);
    assert.deepEqual(
      interior(res, start, end).map((m) => [partsOf(m.t).month, partsOf(m.t).day]),
      [[7, 22], [7, 29], [8, 1], [8, 8], [8, 15]]
    );
    assertInvariants(res, start, end, 1200, {}, 'days step 7 across a month boundary');
  });

  it('the day sequence resets across February (Feb 1..Mar 15 1969)', () => {
    const start = T.ce(1969, 2, 1);
    const end = T.ce(1969, 3, 15);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.step, 7);
    assert.deepEqual(
      interior(res, start, end).map((m) => [partsOf(m.t).month, partsOf(m.t).day]),
      [[2, 8], [2, 15], [2, 22], [3, 1], [3, 8]]
    );
    assertInvariants(res, start, end, 1200, {}, 'days step 7 across February');
  });

  it('14-day step lands on days 1, 15, 29 of each month (Jul 1..Sep 29 1969)', () => {
    const start = T.ce(1969, 7, 1);
    const end = T.ce(1969, 9, 29);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.regime, 'day');
    assert.equal(res.step, 14);
    assert.deepEqual(
      interior(res, start, end).map((m) => [partsOf(m.t).month, partsOf(m.t).day]),
      [[7, 15], [7, 29], [8, 1], [8, 15], [8, 29], [9, 1], [9, 15]]
    );
    assertInvariants(res, start, end, 1200, {}, 'days step 14');
  });

  it('2-day step lands on odd days (Jul 1..Jul 19 1969)', () => {
    const start = T.ce(1969, 7, 1);
    const end = T.ce(1969, 7, 19);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.step, 2);
    assert.deepEqual(interior(res, start, end).map((m) => partsOf(m.t).day), [3, 5, 7, 9, 11, 13, 15, 17]);
    assertInvariants(res, start, end, 1200, {}, 'days step 2');
  });

  it('1-day step labels every day (Jul 1..Jul 8 1969)', () => {
    const start = T.ce(1969, 7, 1);
    const end = T.ce(1969, 7, 8);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.step, 1);
    assert.deepEqual(
      interior(res, start, end).map((m) => m.label),
      ['Jul 2, 1969', 'Jul 3, 1969', 'Jul 4, 1969', 'Jul 5, 1969', 'Jul 6, 1969', 'Jul 7, 1969']
    );
    assertInvariants(res, start, end, 1200, {}, 'days step 1');
  });

  it('every day-regime major is at midnight with day-of-month 1 + k*step', () => {
    for (const c of [...BOUNDARY_CASES, ...STEP_CASES]) {
      const res = computeTicks(c.start, c.end, c.w, c.opts);
      if (res.regime !== 'day') continue;
      for (const m of res.major) {
        const p = partsOf(m.t);
        assert.equal((p.day - 1) % res.step, 0, `${c.name}: ${m.label} day ${p.day} on the step grid`);
        assert.equal(p.hour, 0, `${c.name}: ${m.label} hour`);
        assert.equal(p.minute, 0, `${c.name}: ${m.label} minute`);
      }
    }
  });
});

describe('minor ticks', () => {
  const MINOR_CASES = [
    { name: 'ago step 50,000 (leading 5) -> 4 between', start: T.ROOT_START, end: NOW, w: 1400, step: 50000, between: 4 },
    { name: 'ago step 20,000 (leading 2) -> 3 between', start: T.ROOT_START, end: NOW, w: 3000, step: 20000, between: 3 },
    { name: 'year step 1000 (leading 1) -> 4 between', start: T.bce(3000), end: T.ce(2026), w: 1000, step: 1000, between: 4 },
    { name: 'year step 100 (leading 1) -> 4 between', start: T.ce(1000), end: T.ce(2000), w: 1400, step: 100, between: 4 },
    { name: 'year step 50 (leading 5) -> 4 between', start: T.ce(1500), end: T.ce(2000), w: 1200, step: 50, between: 4 },
    { name: 'year step 20 (leading 2) -> 3 between', start: T.ce(1800), end: T.ce(2000), w: 1200, step: 20, between: 3 },
    { name: 'year step 10 (leading 1) -> 4 between', start: T.ce(1920), end: T.ce(2020), w: 1200, step: 10, between: 4 },
    { name: 'year step 5 (leading 5) -> 4 between', start: T.ce(1970), end: T.ce(2020), w: 1200, step: 5, between: 4 },
    { name: 'year step 2 (leading 2) -> 3 between', start: T.ce(2000), end: T.ce(2020), w: 1200, step: 2, between: 3 },
    { name: 'year step 1 (leading 1) -> 4 between', start: T.ce(2010), end: T.ce(2020), w: 1200, step: 1, between: 4 },
    { name: 'month step 2 -> 3 between', start: T.ce(1969), end: T.ce(1970), w: 1200, step: 2, between: 3 },
    { name: 'month step 1 -> 3 between', start: T.ce(1969), end: T.ce(1969, 7, 1), w: 1200, step: 1, between: 3 },
    { name: 'day step 7 -> 3 between', start: T.ce(1969, 7, 1), end: T.ce(1969, 7, 31), w: 1200, step: 7, between: 3 },
    { name: 'day step 1 -> 3 between', start: T.ce(1969, 7, 1), end: T.ce(1969, 7, 8), w: 1200, step: 1, between: 3 },
  ];

  for (const c of MINOR_CASES) {
    it(c.name, () => {
      const res = computeTicks(c.start, c.end, c.w);
      assert.equal(res.step, c.step);
      assert.ok(res.major.length >= 2, 'need at least two majors to count between');
      assertMinorsBetween(res, c.start, c.end, c.between + 1, ` [${c.name}]`);
      assertInvariants(res, c.start, c.end, c.w, {}, c.name);
    });
  }

  it('minors never coincide with majors and are sorted, for every case', () => {
    for (const c of [...BOUNDARY_CASES, ...STEP_CASES, ...MINOR_CASES]) {
      const res = computeTicks(c.start, c.end, c.w, c.opts);
      const eps = Math.max(Math.abs(c.start), Math.abs(c.end), 1) * 1e-9;
      const majorTs = res.major.map((m) => m.t);
      for (let i = 0; i < res.minor.length; i++) {
        if (i > 0) assert.ok(res.minor[i] > res.minor[i - 1], `${c.name}: minors sorted`);
        for (const mt of majorTs) {
          assert.ok(Math.abs(res.minor[i] - mt) > eps, `${c.name}: minor ${res.minor[i]} coincides with major ${mt}`);
        }
      }
    }
  });

  it('majors are sorted strictly ascending, for every case', () => {
    for (const c of [...BOUNDARY_CASES, ...STEP_CASES, ...MINOR_CASES]) {
      const res = computeTicks(c.start, c.end, c.w, c.opts);
      for (let i = 1; i < res.major.length; i++) {
        assert.ok(res.major[i].t > res.major[i - 1].t, `${c.name}: major[${i}] > major[${i - 1}]`);
      }
    }
  });

  it('minors extend to the view edges beyond the first and last major (1923..2017)', () => {
    const start = T.ce(1923);
    const end = T.ce(2017);
    const res = computeTicks(start, end, 1200);
    assert.equal(res.step, 10);
    assert.equal(res.major[0].t, T.ce(1930));
    assert.equal(res.major[res.major.length - 1].t, T.ce(2010));
    const round = (x) => Math.round(x * 1e6) / 1e6;
    const before = res.minor.filter((x) => x < res.major[0].t).map(round);
    const after = res.minor.filter((x) => x > res.major[res.major.length - 1].t).map(round);
    assert.deepEqual(before, [1924, 1926, 1928]);
    assert.deepEqual(after, [2012, 2014, 2016]);
    assertInvariants(res, start, end, 1200, {}, 'minor extension');
  });

  it('minors are never labeled (they are plain numbers)', () => {
    const res = computeTicks(T.ROOT_START, NOW, 1400);
    assert.ok(res.minor.length > 0);
    for (const x of res.minor) assert.equal(typeof x, 'number');
  });
});

describe('overlap thinning', () => {
  const start = T.ce(1920);
  const end = T.ce(2020);
  const w = 1200; // step 10 -> 120px pitch

  it('default label widths (4-char years, 28px) never overlap on a 120px pitch', () => {
    const res = computeTicks(start, end, w);
    assert.equal(res.step, 10);
    assert.ok(res.major.length >= 9);
    assert.ok(res.major.every((m) => m.labeled === true));
  });

  it('a labelWidth wider than the pitch suppresses every other label; ticks remain', () => {
    const plain = computeTicks(start, end, w);
    const res = computeTicks(start, end, w, { labelWidth: () => 150 });
    assert.deepEqual(res.major.map((m) => m.t), plain.major.map((m) => m.t), 'same tick positions');
    assert.deepEqual(res.major.map((m) => m.label), plain.major.map((m) => m.label), 'same label text');
    assert.deepEqual(res.minor, plain.minor, 'same minors');
    assert.deepEqual(
      res.major.map((m) => m.labeled),
      res.major.map((_, i) => i % 2 === 0),
      'alternating labeled / unlabeled starting with the first'
    );
    assertInvariants(res, start, end, w, { labelWidth: () => 150 }, 'thinning 150px');
  });

  it('a labelWidth wider than the whole axis keeps only the first label; all ticks remain', () => {
    const plain = computeTicks(start, end, w);
    const opts = { labelWidth: () => 1e6 };
    const res = computeTicks(start, end, w, opts);
    assert.equal(res.major.length, plain.major.length, 'no tick is removed by thinning');
    assert.deepEqual(res.major.map((m) => m.t), plain.major.map((m) => m.t));
    assert.equal(res.major[0].labeled, true, 'the first label is always kept');
    assert.ok(res.major.length >= 3);
    for (const m of res.major.slice(1)) {
      assert.equal(m.labeled, false, `${m.label} is thinned against the kept first label`);
    }
    assert.ok(
      res.major.filter((m) => !m.labeled).length >= Math.floor(res.major.length / 2),
      'at least every other label is suppressed'
    );
    assertInvariants(res, start, end, w, opts, 'thinning 1e6px');
  });

  it('labelGap participates: 100px labels fit at gap 12 but alternate at gap 30', () => {
    const fits = computeTicks(start, end, w, { labelWidth: () => 100, labelGap: 12 });
    assert.ok(fits.major.every((m) => m.labeled === true), 'left edge 70px clears right edge 50px + 12');
    const tight = computeTicks(start, end, w, { labelWidth: () => 100, labelGap: 30 });
    assert.deepEqual(
      tight.major.map((m) => m.labeled),
      tight.major.map((_, i) => i % 2 === 0),
      'left edge 70px is within 30px of right edge 50px -> every other drops'
    );
    assertInvariants(tight, start, end, w, { labelWidth: () => 100, labelGap: 30 }, 'thinning gap 30');
  });

  it('the labelWidth callback receives the label text', () => {
    const seen = [];
    const res = computeTicks(start, end, w, {
      labelWidth: (label) => {
        seen.push(label);
        return defaultLabelWidth(label);
      },
    });
    assert.ok(seen.length > 0, 'labelWidth was consulted');
    for (const s of seen) assert.equal(typeof s, 'string');
    for (const m of res.major) assert.ok(seen.includes(m.label), `labelWidth saw "${m.label}"`);
  });

  it('labeled majors never overlap under default estimates, for every case', () => {
    for (const c of [...BOUNDARY_CASES, ...STEP_CASES]) {
      const res = computeTicks(c.start, c.end, c.w, c.opts);
      let prevRight = -Infinity;
      for (const m of res.major) {
        if (!m.labeled) continue;
        const cpx = pxOf(m.t, c.start, c.end, c.w);
        const half = defaultLabelWidth(m.label) / 2;
        assert.ok(cpx - half >= prevRight + DEFAULT_GAP - 1e-6, `${c.name}: "${m.label}" overlaps the previous kept label`);
        prevRight = cpx + half;
      }
    }
  });
});

describe('majors are non-empty across the zoom range', () => {
  for (const c of SPAN_CASES) {
    for (const w of SPAN_WIDTHS) {
      it(`${c.name} @${w}px`, () => {
        const res = computeTicks(c.start, c.end, w);
        assert.ok(res.major.length >= 1, `at least one major for ${c.name} at ${w}px`);
        assert.ok(res.major.every((m) => typeof m.label === 'string' && m.label.length > 0));
        assertInvariants(res, c.start, c.end, w, {}, `${c.name} @${w}px`);
      });
    }
  }

  it('wider viewports never produce fewer majors than narrower ones', () => {
    for (const c of SPAN_CASES) {
      const narrow = computeTicks(c.start, c.end, 320);
      const wide = computeTicks(c.start, c.end, 4000);
      assert.ok(wide.major.length >= narrow.major.length, `${c.name}: ${wide.major.length} >= ${narrow.major.length}`);
    }
  });
});

describe('defaults and purity', () => {
  const VIEWS = [
    [T.ROOT_START, NOW, 1400],
    [T.ROOT_START, NOW, 375],
    [T.bce(3000), T.ce(2026), 1200],
    [T.ce(1969), T.ce(1970), 1200],
    [T.ce(1969, 7, 1), T.ce(1969, 7, 31), 1200],
  ];

  it('omitted opts equal { targetPx: 110, labelWidth: len*7, labelGap: 12 }', () => {
    for (const [s, e, w] of VIEWS) {
      const explicit = computeTicks(s, e, w, { targetPx: 110, labelWidth: (l) => l.length * 7, labelGap: 12 });
      assert.deepEqual(computeTicks(s, e, w), explicit, view(s, e, w));
      assert.deepEqual(computeTicks(s, e, w, undefined), explicit, view(s, e, w));
      assert.deepEqual(computeTicks(s, e, w, {}), explicit, view(s, e, w));
    }
  });

  it('is a pure function: repeated calls give identical results', () => {
    for (const [s, e, w] of VIEWS) {
      const a = computeTicks(s, e, w);
      computeTicks(T.ce(1969), T.ce(1970), 320); // unrelated call in between
      const b = computeTicks(s, e, w);
      assert.deepEqual(a, b, view(s, e, w));
    }
  });

  it('does not mutate the returned arrays across calls', () => {
    const a = computeTicks(T.ROOT_START, NOW, 1400);
    const snapshot = JSON.stringify(a);
    computeTicks(T.ROOT_START, NOW, 375);
    computeTicks(T.ce(1969), T.ce(1970), 1200);
    assert.equal(JSON.stringify(a), snapshot);
  });
});

describe('sub-day views always get a labelled major (regression)', () => {
  const T = globalThis.HT.time;
  const { computeTicks } = globalThis.HT.ticks;
  it('a one-day (1/365.25 y) view starting seconds after midnight in a common year', () => {
    for (let h = 0; h < 24; h++) {
      const start = T.ymd(2026, 9, 11) + (h + 30 / 3600) / 24 / T.daysInYear(2026);
      for (const w of [320, 1440, 4000]) {
        const r = computeTicks(start, start + 1 / 365.25, w);
        assert.ok(r.major.length >= 1, `no majors at h=${h} w=${w}`);
        assert.ok(r.major.every((m) => typeof m.label === 'string' && m.label.length > 0));
      }
    }
  });
});
