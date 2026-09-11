'use strict';
// Contract tests for HT.time (CONTRACT.md sections 1-2).
// Written from the contract only; they are the independent check on src/time.js.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('../src/time.js');
const T = globalThis.HT && globalThis.HT.time;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function closeTo(actual, expected, eps, msg) {
  assert.ok(
    typeof actual === 'number' && Math.abs(actual - expected) <= eps,
    `${msg || 'closeTo'}: expected ${actual} to be within ${eps} of ${expected}`
  );
}

describe('module shape (section 1)', () => {
  test('require installs HT.time on globalThis', () => {
    assert.equal(typeof globalThis.HT, 'object');
    assert.equal(typeof T, 'object');
  });

  test('exports every contract member', () => {
    for (const fn of [
      'now', 'isLeap', 'daysInYear', 'fromDate', 'toParts', 'ymd', 'ce', 'bce', 'ya',
      'histYear', 'fromHistYear', 'formatYear', 'formatAgo', 'formatDate', 'formatRange',
      'formatDateFull', 'regimeForSpan',
    ]) {
      assert.equal(typeof T[fn], 'function', `HT.time.${fn} should be a function`);
    }
    assert.equal(typeof T.PRESENT, 'number');
    assert.equal(typeof T.ROOT_START, 'number');
  });
});

describe('constants', () => {
  test('PRESENT is 1950', () => {
    assert.equal(T.PRESENT, 1950);
  });

  test('ROOT_START = ya(300000) = -298050', () => {
    assert.equal(T.ROOT_START, -298050);
    assert.equal(T.ROOT_START, T.ya(300000));
  });
});

describe('bce / ce / ymd / ya conversions', () => {
  test('bce maps historical BCE years onto astronomical years', () => {
    assert.equal(T.bce(3000), -2999);
    assert.equal(T.bce(1), 0);
    assert.equal(T.bce(2), -1);
    assert.equal(T.bce(10000), -9999);
    assert.equal(T.bce(3000), T.ymd(-2999));
    assert.equal(T.bce(44, 3, 15), T.ymd(-43, 3, 15));
  });

  test('ce is ymd for y >= 1', () => {
    assert.equal(T.ce(1), 1);
    assert.equal(T.ce(79), 79);
    assert.equal(T.ce(1492), 1492);
    assert.equal(T.ce(1969, 7, 20), T.ymd(1969, 7, 20));
  });

  test('ya(n) = 1950 - n', () => {
    assert.equal(T.ya(300000), -298050);
    assert.equal(T.ya(250000), -248050);
    assert.equal(T.ya(0), 1950);
    assert.equal(T.ya(1949), 1);
    assert.equal(T.ya(1950), 0);
    assert.equal(T.ya(1951), -1);
  });

  test('ymd defaults to Jan 1 and returns the bare year', () => {
    assert.equal(T.ymd(1969), 1969);
    assert.equal(T.ymd(1969, 1), 1969);
    assert.equal(T.ymd(1969, 1, 1), 1969);
    assert.equal(T.ymd(0), 0);
    assert.equal(T.ymd(-2999), -2999);
  });

  test('ymd fractional part = fraction of the calendar year elapsed', () => {
    // Jul 20 is day-of-year 201 in a non-leap year -> 200 days elapsed.
    closeTo(T.ymd(1969, 7, 20), 1969 + 200 / 365, 1e-12, 'ymd(1969,7,20)');
    // Dec 31 of a leap year -> 365 days elapsed out of 366.
    closeTo(T.ymd(2000, 12, 31), 2000 + 365 / 366, 1e-12, 'ymd(2000,12,31)');
    // Dec 31 of a non-leap year.
    closeTo(T.ymd(1969, 12, 31), 1969 + 364 / 365, 1e-12, 'ymd(1969,12,31)');
    // Mar 1 follows Feb 29 in a leap year, Feb 28 in a common year.
    closeTo(T.ymd(2000, 3, 1), 2000 + 60 / 366, 1e-12, 'ymd(2000,3,1)');
    closeTo(T.ymd(1900, 3, 1), 1900 + 59 / 365, 1e-12, 'ymd(1900,3,1)');
    // Astronomical year 0 (1 BCE) is a leap year.
    closeTo(T.ymd(0, 12, 31), 365 / 366, 1e-12, 'ymd(0,12,31)');
  });

  test('ymd is strictly increasing through a year', () => {
    let prev = -Infinity;
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        const t = T.ymd(1969, m, d);
        assert.ok(t > prev, `ymd(1969,${m},${d}) should be > previous day`);
        assert.ok(t >= 1969 && t < 1970, `ymd(1969,${m},${d}) stays inside year 1969`);
        prev = t;
      }
    }
  });
});

describe('isLeap / daysInYear (proleptic Gregorian, astronomical years)', () => {
  test('isLeap on the classic cases', () => {
    assert.equal(T.isLeap(1900), false);
    assert.equal(T.isLeap(2000), true);
    assert.equal(T.isLeap(2024), true);
    assert.equal(T.isLeap(2023), false);
    assert.equal(T.isLeap(1969), false);
  });

  test('isLeap on astronomical years <= 0', () => {
    assert.equal(T.isLeap(0), true, 'year 0 (1 BCE) is divisible by 400');
    assert.equal(T.isLeap(-1), false, 'year -1 (2 BCE) is not divisible by 4');
    assert.equal(T.isLeap(-4), true, 'year -4 (5 BCE) is divisible by 4');
    assert.equal(T.isLeap(-100), false, 'year -100 is a century not divisible by 400');
    assert.equal(T.isLeap(-400), true, 'year -400 is divisible by 400');
  });

  test('daysInYear follows isLeap', () => {
    assert.equal(T.daysInYear(1900), 365);
    assert.equal(T.daysInYear(2000), 366);
    assert.equal(T.daysInYear(2024), 366);
    assert.equal(T.daysInYear(1969), 365);
    assert.equal(T.daysInYear(0), 366);
    assert.equal(T.daysInYear(-1), 365);
  });
});

describe('histYear / fromHistYear', () => {
  test('histYear: t >= 1 -> floor(t)', () => {
    assert.equal(T.histYear(1), 1);
    assert.equal(T.histYear(1.5), 1);
    assert.equal(T.histYear(79), 79);
    assert.equal(T.histYear(1492), 1492);
    assert.equal(T.histYear(2026.7), 2026);
  });

  test('histYear: t < 1 -> floor(t) - 1 (no year zero)', () => {
    assert.equal(T.histYear(0.999), -1);
    assert.equal(T.histYear(0.5), -1);
    assert.equal(T.histYear(0), -1);
    assert.equal(T.histYear(-0.5), -2);
    assert.equal(T.histYear(-1), -2);
    assert.equal(T.histYear(-2999), -3000);
    assert.equal(T.histYear(T.bce(3000)), -3000);
    assert.equal(T.histYear(T.bce(44, 3, 15)), -44);
  });

  test('histYear never returns 0 and is always an integer', () => {
    for (let t = -5; t <= 5; t += 0.125) {
      const h = T.histYear(t);
      assert.ok(Number.isInteger(h), `histYear(${t}) = ${h} should be an integer`);
      assert.notEqual(h, 0, `histYear(${t}) must never be 0`);
    }
    assert.notEqual(T.histYear(T.ROOT_START), 0);
  });

  test('fromHistYear: h > 0 -> h; h < 0 -> h + 1', () => {
    assert.equal(T.fromHistYear(1), 1);
    assert.equal(T.fromHistYear(79), 79);
    assert.equal(T.fromHistYear(2026), 2026);
    assert.equal(T.fromHistYear(-1), 0);
    assert.equal(T.fromHistYear(-2), -1);
    assert.equal(T.fromHistYear(-3000), -2999);
    assert.equal(T.fromHistYear(-10000), -9999);
  });

  test('fromHistYear(0) throws', () => {
    assert.throws(() => T.fromHistYear(0));
    assert.throws(() => T.fromHistYear(-0), 'negative zero is still historical year 0');
  });

  test('round trip h -> t -> h', () => {
    for (const h of [-300000, -10000, -3000, -44, -2, -1, 1, 2, 79, 476, 999, 1000, 1492, 1969, 2026]) {
      assert.equal(T.histYear(T.fromHistYear(h)), h, `histYear(fromHistYear(${h}))`);
    }
  });

  test('round trip integer t -> h -> t', () => {
    for (const t of [-298050, -9999, -2999, -43, -1, 0, 1, 2, 79, 1000, 1492, 1969, 2026]) {
      assert.equal(T.fromHistYear(T.histYear(t)), t, `fromHistYear(histYear(${t}))`);
    }
  });

  test('the boundary across 1 BCE / 1 CE', () => {
    assert.equal(T.histYear(T.bce(1)), -1);
    assert.equal(T.histYear(T.ce(1)), 1);
    assert.equal(T.fromHistYear(-1), T.bce(1));
    assert.equal(T.fromHistYear(1), T.ce(1));
    assert.equal(T.fromHistYear(1) - T.fromHistYear(-1), 1, 'exactly one (leap) year apart');
  });
});

describe('toParts / ymd / fromDate', () => {
  test('toParts(ymd(1969, 7, 20))', () => {
    const p = T.toParts(T.ymd(1969, 7, 20));
    assert.equal(p.year, 1969);
    assert.equal(p.month, 7);
    assert.equal(p.day, 20);
    assert.equal(p.hour, 0);
    assert.equal(p.minute, 0);
    assert.ok(Number.isInteger(p.dayOfYear), 'dayOfYear is an integer');
  });

  test('toParts on year starts, including astronomical year 0 and negatives', () => {
    for (const y of [-2999, -43, -1, 0, 1, 79, 1969, 2000]) {
      const p = T.toParts(T.ymd(y));
      assert.equal(p.year, y, `year for ymd(${y})`);
      assert.equal(p.month, 1, `month for ymd(${y})`);
      assert.equal(p.day, 1, `day for ymd(${y})`);
      assert.equal(p.hour, 0);
      assert.equal(p.minute, 0);
    }
  });

  test('dayOfYear counts days from Jan 1 (basing left to the implementation)', () => {
    const jan1 = T.toParts(T.ymd(1969, 1, 1)).dayOfYear;
    assert.equal(T.toParts(T.ymd(1969, 7, 20)).dayOfYear - jan1, 200);
    assert.equal(T.toParts(T.ymd(1969, 12, 31)).dayOfYear - jan1, 364);
    const jan1Leap = T.toParts(T.ymd(2000, 1, 1)).dayOfYear;
    assert.equal(T.toParts(T.ymd(2000, 12, 31)).dayOfYear - jan1Leap, 365);
    assert.equal(T.toParts(T.ymd(2000, 3, 1)).dayOfYear - jan1Leap, 60);
  });

  test('ymd(toParts(t)) round trips for a spread of dates', () => {
    const cases = [
      [1969, 7, 20], [1969, 1, 1], [1969, 12, 31],
      [2000, 1, 1], [2000, 2, 29], [2000, 3, 1], [2000, 12, 31],
      [1900, 2, 28], [1900, 3, 1], [1900, 12, 31],
      [2024, 2, 29], [2024, 12, 31],
      [1, 1, 1], [1, 12, 31], [0, 1, 1], [0, 2, 29], [0, 12, 31],
      [-1, 1, 1], [-1, 12, 31], [-43, 3, 15], [-2999, 1, 1], [-2999, 12, 31],
      [-9999, 6, 15], [-298050, 1, 1],
    ];
    for (const [y, m, d] of cases) {
      const t = T.ymd(y, m, d);
      const p = T.toParts(t);
      assert.deepEqual([p.year, p.month, p.day], [y, m, d], `toParts(ymd(${y},${m},${d}))`);
      closeTo(T.ymd(p.year, p.month, p.day), t, 1e-9, `ymd(toParts(ymd(${y},${m},${d})))`);
    }
  });

  test('toParts on every day of a leap and a common year', () => {
    for (const y of [1969, 2000]) {
      const dim = [31, T.isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= dim[m - 1]; d++) {
          const p = T.toParts(T.ymd(y, m, d));
          assert.deepEqual([p.year, p.month, p.day], [y, m, d], `toParts(ymd(${y},${m},${d}))`);
        }
      }
    }
  });

  test('fromDate uses UTC fields', () => {
    closeTo(T.fromDate(new Date(Date.UTC(1969, 6, 20))), T.ymd(1969, 7, 20), 1e-9, 'fromDate(1969-07-20Z)');
    closeTo(T.fromDate(new Date(Date.UTC(2000, 0, 1))), 2000, 1e-9, 'fromDate(2000-01-01Z)');
    closeTo(T.fromDate(new Date(Date.UTC(2000, 11, 31))), T.ymd(2000, 12, 31), 1e-9, 'fromDate(2000-12-31Z)');
    closeTo(T.fromDate(new Date(Date.UTC(1900, 2, 1))), T.ymd(1900, 3, 1), 1e-9, 'fromDate(1900-03-01Z)');
  });

  test('fromDate -> toParts carries hour and minute', () => {
    const p = T.toParts(T.fromDate(new Date(Date.UTC(1969, 6, 20, 20, 17))));
    assert.equal(p.year, 1969);
    assert.equal(p.month, 7);
    assert.equal(p.day, 20);
    assert.equal(p.hour, 20);
    assert.equal(p.minute, 17);
    const noon = T.toParts(T.fromDate(new Date(Date.UTC(2000, 1, 29, 12, 0))));
    assert.deepEqual([noon.year, noon.month, noon.day, noon.hour, noon.minute], [2000, 2, 29, 12, 0]);
  });

  test('a day is 1/daysInYear of a year', () => {
    closeTo(T.ymd(1969, 7, 21) - T.ymd(1969, 7, 20), 1 / 365, 1e-12, 'one day in 1969');
    closeTo(T.ymd(2000, 3, 1) - T.ymd(2000, 2, 28), 2 / 366, 1e-12, 'Feb 28 -> Mar 1 in 2000');
    closeTo(T.ymd(1900, 3, 1) - T.ymd(1900, 2, 28), 1 / 365, 1e-12, 'Feb 28 -> Mar 1 in 1900');
  });

  test('now() is the current instant', () => {
    const n = T.now();
    assert.equal(typeof n, 'number');
    closeTo(n, T.fromDate(new Date()), 1e-6, 'now() vs fromDate(new Date())');
    assert.ok(n > 2026 && n < 2200, 'now() is a plausible current year');
    assert.ok(n > T.ROOT_START);
  });

  test('adding one day to Dec 31 rolls into Jan 1 of the next astronomical year', () => {
    // t is continuous across year boundaries: Dec 31 + 1/daysInYear(y) is exactly (up to float
    // noise) the next integer year, and toParts must land on Jan 1 00:00 of y + 1 either side of it.
    for (const y of [1969, 2000, 1, 0, -1, -4, -2999, -298050]) {
      const t = T.ymd(y, 12, 31) + 1 / T.daysInYear(y);
      closeTo(t, y + 1, 1e-9, `Dec 31, ${y} + one day`);
      const p = T.toParts(t);
      assert.deepEqual([p.year, p.month, p.day, p.hour, p.minute], [y + 1, 1, 1, 0, 0], `day after Dec 31, ${y}`);
    }
  });

  test('proleptic Gregorian leap rules hold for negative astronomical years', () => {
    // -4 (5 BCE) and -400 are leap; -100 is a common century year.
    for (const [y, m, d] of [
      [-4, 2, 29], [-4, 3, 1], [-4, 12, 31],
      [-100, 2, 28], [-100, 3, 1], [-100, 12, 31],
      [-400, 2, 29], [-400, 12, 31],
    ]) {
      const p = T.toParts(T.ymd(y, m, d));
      assert.deepEqual([p.year, p.month, p.day], [y, m, d], `toParts(ymd(${y},${m},${d}))`);
    }
    closeTo(T.ymd(-4, 3, 1) - T.ymd(-4, 2, 28), 2 / 366, 1e-12, 'Feb 28 -> Mar 1 in -4 (leap)');
    closeTo(T.ymd(-100, 3, 1) - T.ymd(-100, 2, 28), 1 / 365, 1e-12, 'Feb 28 -> Mar 1 in -100 (common)');
    closeTo(T.ymd(-400, 12, 31), -400 + 365 / 366, 1e-12, 'Dec 31 of leap year -400');
  });

  test('fromDate keeps the UTC time of day as a fraction of the day', () => {
    closeTo(T.fromDate(new Date(Date.UTC(1969, 6, 20, 12))), T.ymd(1969, 7, 20) + 0.5 / 365, 1e-12, 'noon, Jul 20 1969');
    closeTo(T.fromDate(new Date(Date.UTC(2000, 1, 29, 18))), T.ymd(2000, 2, 29) + 0.75 / 366, 1e-12, '18:00, Feb 29 2000');
    // 23:59:59.999 on Dec 31 is still Dec 31 of the same year.
    const p = T.toParts(T.fromDate(new Date(Date.UTC(1969, 11, 31, 23, 59, 59, 999))));
    assert.deepEqual([p.year, p.month, p.day, p.hour, p.minute], [1969, 12, 31, 23, 59]);
  });

  test('toParts fields are integers in calendar range for every day of a year', () => {
    for (let doy = 0; doy < 366; doy++) {
      const p = T.toParts(2000 + doy / 366);
      assert.ok(Number.isInteger(p.year) && p.year === 2000, `year at doy ${doy}`);
      assert.ok(Number.isInteger(p.month) && p.month >= 1 && p.month <= 12, `month at doy ${doy}`);
      assert.ok(Number.isInteger(p.day) && p.day >= 1 && p.day <= 31, `day at doy ${doy}`);
      assert.ok(Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 23, `hour at doy ${doy}`);
      assert.ok(Number.isInteger(p.minute) && p.minute >= 0 && p.minute <= 59, `minute at doy ${doy}`);
      assert.ok(Number.isInteger(p.dayOfYear), `dayOfYear at doy ${doy}`);
    }
  });
});

describe('regimeForSpan', () => {
  test('ago: span > 20000', () => {
    assert.equal(T.regimeForSpan(300000), 'ago');
    assert.equal(T.regimeForSpan(100000), 'ago');
    assert.equal(T.regimeForSpan(20001), 'ago');
    assert.equal(T.regimeForSpan(20000.000001), 'ago');
  });

  test('year: 2 < span <= 20000 (20000 inclusive, 2 exclusive)', () => {
    assert.equal(T.regimeForSpan(20000), 'year');
    assert.equal(T.regimeForSpan(19999.999), 'year');
    assert.equal(T.regimeForSpan(5000), 'year');
    assert.equal(T.regimeForSpan(100), 'year');
    assert.equal(T.regimeForSpan(10), 'year');
    assert.equal(T.regimeForSpan(2.000001), 'year');
  });

  test('month: 0.25 < span <= 2 (2 inclusive, 0.25 exclusive)', () => {
    assert.equal(T.regimeForSpan(2), 'month');
    assert.equal(T.regimeForSpan(1.999), 'month');
    assert.equal(T.regimeForSpan(1), 'month');
    assert.equal(T.regimeForSpan(0.5), 'month');
    assert.equal(T.regimeForSpan(0.2500001), 'month');
  });

  test('day: span <= 0.25 (0.25 inclusive)', () => {
    assert.equal(T.regimeForSpan(0.25), 'day');
    assert.equal(T.regimeForSpan(0.1), 'day');
    assert.equal(T.regimeForSpan(1 / 12), 'day');
    assert.equal(T.regimeForSpan(1 / 365.25), 'day');
    assert.equal(T.regimeForSpan(0), 'day');
  });
});

describe('formatYear', () => {
  test('contract examples', () => {
    assert.equal(T.formatYear(T.bce(3000)), '3000 BCE');
    assert.equal(T.formatYear(T.ce(79)), '79 CE');
    assert.equal(T.formatYear(T.ce(1492)), '1492');
  });

  test('CE suffix only for years 1..999', () => {
    assert.equal(T.formatYear(1), '1 CE');
    assert.equal(T.formatYear(2), '2 CE');
    assert.equal(T.formatYear(476), '476 CE');
    assert.equal(T.formatYear(999), '999 CE');
    assert.equal(T.formatYear(1000), '1000');
    assert.equal(T.formatYear(1969), '1969');
    assert.equal(T.formatYear(2026), '2026');
    assert.equal(T.formatYear(9999), '9999');
  });

  test('BCE years, no year zero', () => {
    assert.equal(T.formatYear(0), '1 BCE');
    assert.equal(T.formatYear(-1), '2 BCE');
    assert.equal(T.formatYear(T.bce(1)), '1 BCE');
    assert.equal(T.formatYear(T.bce(2)), '2 BCE');
    assert.equal(T.formatYear(T.bce(44)), '44 BCE');
    assert.equal(T.formatYear(T.bce(500)), '500 BCE');
    assert.equal(T.formatYear(T.bce(9999)), '9999 BCE');
  });

  test('thousands separators for >= 10,000', () => {
    assert.equal(T.formatYear(T.bce(10000)), '10,000 BCE');
    assert.equal(T.formatYear(T.bce(20000)), '20,000 BCE');
    assert.equal(T.formatYear(T.bce(250000)), '250,000 BCE');
    assert.equal(T.formatYear(10000), '10,000');
    assert.equal(T.formatYear(123456), '123,456');
  });

  test('fractional t uses the historical year containing t', () => {
    assert.equal(T.formatYear(T.ymd(1969, 7, 20)), '1969');
    assert.equal(T.formatYear(T.bce(44, 3, 15)), '44 BCE');
    assert.equal(T.formatYear(0.5), '1 BCE');
    assert.equal(T.formatYear(-0.5), '2 BCE');
    assert.equal(T.formatYear(1.5), '1 CE');
    assert.equal(T.formatYear(999.9), '999 CE');
  });
});

describe('formatAgo', () => {
  test('contract example', () => {
    assert.equal(T.formatAgo(T.ya(250000)), '250,000 years ago');
  });

  test('n = round(PRESENT - t) with thousands separators', () => {
    assert.equal(T.formatAgo(T.ya(300000)), '300,000 years ago');
    assert.equal(T.formatAgo(T.ROOT_START), '300,000 years ago');
    assert.equal(T.formatAgo(T.ya(50000)), '50,000 years ago');
    assert.equal(T.formatAgo(T.ya(1000)), '1,000 years ago');
    assert.equal(T.formatAgo(T.ya(999)), '999 years ago');
    assert.equal(T.formatAgo(T.ya(12345)), '12,345 years ago');
    assert.equal(T.formatAgo(T.ya(1234567)), '1,234,567 years ago');
    assert.equal(T.formatAgo(T.bce(10000)), '11,949 years ago');
  });

  test('rounds to the nearest whole year', () => {
    assert.equal(T.formatAgo(T.ya(12345.4)), '12,345 years ago');
    assert.equal(T.formatAgo(T.ya(12345.6)), '12,346 years ago');
    assert.equal(T.formatAgo(T.ya(250000.49)), '250,000 years ago');
  });

  test('t at or after PRESENT reads "today", never a negative count', () => {
    // Implied by the contract's formatRange example "300,000 years ago – today" (end = now()) and
    // by the app using formatAgo for the cursor readout whenever span > 20000: a cursor over
    // 2020 CE in the root view must not read "-70 years ago".
    assert.equal(T.formatAgo(T.now()), 'today');
    assert.equal(T.formatAgo(T.PRESENT), 'today');
    assert.equal(T.formatAgo(T.ce(2000)), 'today');
    for (const t of [T.ROOT_START, T.bce(10000), T.bce(1), T.ce(1), T.ce(1900), T.PRESENT, T.ce(2000), T.now()]) {
      assert.doesNotMatch(T.formatAgo(t), /-\d/, `formatAgo(${t}) must not be negative`);
    }
  });

  test('singular for exactly one year', () => {
    assert.equal(T.formatAgo(T.ya(1)), '1 year ago');
    assert.equal(T.formatAgo(T.ya(2)), '2 years ago');
    assert.equal(T.formatAgo(T.ya(0.6)), '1 year ago');
  });
});

describe('formatDate(t, span)', () => {
  test("'ago' regime: span > 20000", () => {
    assert.equal(T.formatDate(T.ya(250000), 300000), '250,000 years ago');
    assert.equal(T.formatDate(T.ya(300000), 300000), '300,000 years ago');
    assert.equal(T.formatDate(T.ya(50000), 100000), '50,000 years ago');
    assert.equal(T.formatDate(T.ya(250000), 20000.000001), '250,000 years ago');
  });

  test("'year' regime: 2 < span <= 20000", () => {
    assert.equal(T.formatDate(T.bce(3000), 5000), '3000 BCE');
    assert.equal(T.formatDate(T.ce(79), 100), '79 CE');
    assert.equal(T.formatDate(T.ce(1492), 500), '1492');
    assert.equal(T.formatDate(T.bce(10000), 20000), '10,000 BCE');
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 10), '1969');
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 20000), '1969');
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 2.000001), '1969');
    assert.equal(T.formatDate(T.ce(1), 5), '1 CE');
    assert.equal(T.formatDate(T.bce(1), 5), '1 BCE');
  });

  test("'month' regime: 0.25 < span <= 2 -> 'Mon YYYY'", () => {
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 1), 'Jul 1969');
    assert.equal(T.formatDate(T.bce(44, 3, 15), 1), 'Mar 44 BCE');
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 2), 'Jul 1969');
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 0.2500001), 'Jul 1969');
    assert.equal(T.formatDate(T.ymd(79, 8, 24), 1.5), 'Aug 79 CE');
    assert.equal(T.formatDate(T.ymd(1492, 10, 12), 0.5), 'Oct 1492');
    assert.equal(T.formatDate(T.ymd(2000, 2, 29), 1), 'Feb 2000');
    assert.equal(T.formatDate(T.bce(10000, 6, 1), 1), 'Jun 10,000 BCE');
  });

  test("'day' regime: span <= 0.25 -> 'Mon D, YYYY'", () => {
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 0.25), 'Jul 20, 1969');
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 0.1), 'Jul 20, 1969');
    assert.equal(T.formatDate(T.ymd(1969, 7, 20), 1 / 365.25), 'Jul 20, 1969');
    assert.equal(T.formatDate(T.bce(44, 3, 15), 0.1), 'Mar 15, 44 BCE');
    assert.equal(T.formatDate(T.ymd(79, 8, 24), 0.05), 'Aug 24, 79 CE');
    assert.equal(T.formatDate(T.ymd(1969, 7, 1), 0.1), 'Jul 1, 1969');
    assert.equal(T.formatDate(T.ymd(1970, 1, 1), 0.1), 'Jan 1, 1970');
    assert.equal(T.formatDate(T.ymd(1969, 12, 31), 0.1), 'Dec 31, 1969');
    assert.equal(T.formatDate(T.ymd(2000, 2, 29), 0.1), 'Feb 29, 2000');
    assert.equal(T.formatDate(T.ymd(2000, 12, 31), 0.1), 'Dec 31, 2000');
    assert.equal(T.formatDate(T.ymd(0, 1, 1), 0.1), 'Jan 1, 1 BCE');
    assert.equal(T.formatDate(T.ymd(1, 1, 1), 0.1), 'Jan 1, 1 CE');
    assert.equal(T.formatDate(T.bce(10000, 6, 1), 0.1), 'Jun 1, 10,000 BCE');
  });

  test('all twelve month abbreviations', () => {
    for (let m = 1; m <= 12; m++) {
      assert.equal(T.formatDate(T.ymd(2000, m, 1), 1), `${MON[m - 1]} 2000`);
      assert.equal(T.formatDate(T.ymd(2000, m, 15), 0.1), `${MON[m - 1]} 15, 2000`);
    }
  });

  test('regime chosen by formatDate agrees with regimeForSpan', () => {
    const t = T.ymd(1969, 7, 20);
    const byRegime = { ago: /years ago$/, year: /^1969$/, month: /^Jul 1969$/, day: /^Jul 20, 1969$/ };
    for (const span of [300000, 20000.5, 20000, 5000, 2.5, 2, 1, 0.26, 0.25, 0.01]) {
      const regime = T.regimeForSpan(span);
      if (regime === 'ago') continue; // ago-labels for a 1969 t are meaningless; covered elsewhere
      assert.match(T.formatDate(t, span), byRegime[regime], `span ${span} -> ${regime}`);
    }
  });
});

describe('formatRange(start, end)', () => {
  test('contract example: "10,000 BCE – 1 CE"', () => {
    assert.equal(T.formatRange(T.bce(10000), T.ce(1)), '10,000 BCE – 1 CE');
  });

  test('contract example: "500 BCE – 400 BCE"', () => {
    assert.equal(T.formatRange(T.bce(500), T.bce(400)), '500 BCE – 400 BCE');
  });

  test('contract example: "1500 – 1800"', () => {
    assert.equal(T.formatRange(T.ce(1500), T.ce(1800)), '1500 – 1800');
  });

  test('contract example: "300,000 years ago – today"', () => {
    const end = T.now();
    assert.equal(T.formatRange(T.ROOT_START, end), '300,000 years ago – today');
  });

  test('contract example (literal): "Jul 1969 – Aug 1969"', () => {
    // The contract lists this exact string as a formatRange output. A Jul->Aug range is at most
    // ~0.17 years, which is below the 0.25 'month' threshold of the formatDate table, so this
    // test pins the literal example rather than the table. See the report accompanying this file.
    assert.equal(T.formatRange(T.ymd(1969, 7, 1), T.ymd(1969, 8, 1)), 'Jul 1969 – Aug 1969');
  });

  test("month regime by the span table: 'Mon YYYY – Mon YYYY'", () => {
    assert.equal(T.formatRange(T.ymd(1969, 7, 1), T.ymd(1970, 8, 1)), 'Jul 1969 – Aug 1970');
    assert.equal(T.formatRange(T.ymd(1969, 7, 20), T.ymd(1969, 11, 20)), 'Jul 1969 – Nov 1969');
  });

  test('ago regime for deep-prehistory ranges', () => {
    assert.equal(T.formatRange(T.ya(300000), T.ya(250000)), '300,000 years ago – 250,000 years ago');
    assert.equal(T.formatRange(T.ya(100000), T.ya(50000)), '100,000 years ago – 50,000 years ago');
  });

  test('en dash with a single space on each side', () => {
    const s = T.formatRange(T.ce(1500), T.ce(1800));
    assert.ok(s.includes(' – '), `expected " – " (U+2013) in ${JSON.stringify(s)}`);
    assert.ok(!s.includes('-'), 'no ASCII hyphen as the range separator');
  });

  test('if either side is BCE, CE years get " CE"', () => {
    assert.equal(T.formatRange(T.bce(500), T.ce(1500)), '500 BCE – 1500 CE');
    assert.equal(T.formatRange(T.bce(3000), T.ce(2000)), '3000 BCE – 2000 CE');
    assert.equal(T.formatRange(T.bce(100), T.ce(100)), '100 BCE – 100 CE');
  });

  test('CE years follow formatYear when no side is BCE', () => {
    assert.equal(T.formatRange(T.ce(79), T.ce(476)), '79 CE – 476 CE');
    assert.equal(T.formatRange(T.ce(79), T.ce(1492)), '79 CE – 1492');
    assert.equal(T.formatRange(T.ce(1000), T.ce(1500)), '1000 – 1500');
  });

  test('day regime for sub-quarter ranges', () => {
    assert.equal(T.formatRange(T.ymd(1969, 7, 16), T.ymd(1969, 7, 24)), 'Jul 16, 1969 – Jul 24, 1969');
  });

  test('representative windows (contract section 6) as breadcrumb labels', () => {
    const y = T.histYear(T.now());
    // A BCE start forces " CE" onto the current year even though it is >= 1000.
    assert.equal(T.formatRange(T.bce(10000), T.now()), `10,000 BCE – ${y} CE`);
    // No BCE side: plain formatYear rules.
    assert.equal(T.formatRange(T.ce(1945), T.now()), `1945 – ${y}`);
    assert.equal(T.formatRange(T.ce(1800), T.ce(1945)), '1800 – 1945');
    assert.equal(T.formatRange(T.bce(3000), T.ce(500)), '3000 BCE – 500 CE');
    assert.equal(T.formatRange(T.ce(500), T.ce(1500)), '500 CE – 1500');
  });

  test('a 20,000-year window straddling the epoch stays in the year regime', () => {
    // span exactly 20000 -> 'year' (the 'ago' regime needs span > 20000).
    assert.equal(T.formatRange(T.fromHistYear(-10000), T.fromHistYear(10001)), '10,000 BCE – 10,001 CE');
    // Just over 20000 -> 'ago' for both ends.
    assert.equal(T.formatRange(T.ya(22000), T.ya(1000)), '22,000 years ago – 1,000 years ago');
  });
});

describe('formatDateFull(t)', () => {
  test('contract examples', () => {
    assert.equal(T.formatDateFull(T.ymd(1969, 7, 20)), 'Jul 20, 1969');
    assert.equal(T.formatDateFull(T.bce(44, 3, 15)), 'Mar 15, 44 BCE');
    assert.equal(T.formatDateFull(T.ya(250000)), 'c. 250,000 years ago');
  });

  test('"c. N years ago" only when t < bce(20000)', () => {
    assert.equal(T.formatDateFull(T.ROOT_START), 'c. 300,000 years ago');
    assert.equal(T.formatDateFull(T.ya(50000)), 'c. 50,000 years ago');
    assert.equal(T.formatDateFull(T.bce(20000) - 0.001), 'c. 21,949 years ago');
    assert.equal(T.formatDateFull(T.bce(20000)), 'Jan 1, 20,000 BCE');
    assert.equal(T.formatDateFull(T.bce(10000)), 'Jan 1, 10,000 BCE');
    assert.equal(T.formatDateFull(T.bce(3000)), 'Jan 1, 3000 BCE');
  });

  test('day precision with formatYear rules for the year part', () => {
    assert.equal(T.formatDateFull(T.ymd(79, 8, 24)), 'Aug 24, 79 CE');
    assert.equal(T.formatDateFull(T.ymd(1492, 10, 12)), 'Oct 12, 1492');
    assert.equal(T.formatDateFull(T.ce(1)), 'Jan 1, 1 CE');
    assert.equal(T.formatDateFull(T.bce(1)), 'Jan 1, 1 BCE');
    assert.equal(T.formatDateFull(T.ymd(2000, 2, 29)), 'Feb 29, 2000');
    assert.equal(T.formatDateFull(T.ymd(1969, 12, 31)), 'Dec 31, 1969');
    assert.equal(T.formatDateFull(T.fromDate(new Date(Date.UTC(1969, 6, 20, 20, 17)))), 'Jul 20, 1969');
  });

  test('formatDateFull(now()) is today in "Mon D, YYYY" form', () => {
    const n = T.now();
    const p = T.toParts(n);
    assert.equal(T.formatDateFull(n), `${MON[p.month - 1]} ${p.day}, ${p.year}`);
  });

  test('year part follows formatYear rules, including thousands separators', () => {
    assert.equal(T.formatDateFull(T.bce(12000, 6, 15)), 'Jun 15, 12,000 BCE');
    assert.equal(T.formatDateFull(T.bce(999, 12, 31)), 'Dec 31, 999 BCE');
    assert.equal(T.formatDateFull(T.ymd(999, 12, 31)), 'Dec 31, 999 CE');
    assert.equal(T.formatDateFull(T.ymd(1000, 1, 1)), 'Jan 1, 1000');
  });
});
