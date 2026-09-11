/* HT.time — time model and date formatting (CONTRACT.md §2)
 *
 * `t` is a floating-point astronomical year: 1 CE = 1, 1 BCE = 0, 2 BCE = -1.
 * The fractional part is the fraction of that calendar year elapsed, in the
 * proleptic Gregorian calendar, UTC. All conversions are done from day counts;
 * the JS Date object is only ever *read* (fromDate/now), never used for arithmetic.
 */
(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});

  const PRESENT = 1950;                       // "years ago" / BP reference year
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Cumulative days before each month in a common year.
  const MONTH_CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  // Float-noise tolerance (in days) used when flooring day-of-year and minutes so that
  // ymd/fromDate -> toParts round-trips exactly. A double near |t| carries ~|t|·1e-16 years of
  // representation error, which the ×366 day conversion turns into ~|t|·4e-14 days; 2e-13·|t|
  // leaves a 5× margin (≈5 ms at ROOT_START, ≈0.1 ms in the 20th century) while staying far below
  // one millisecond wherever day-precision data lives, so 23:59:59.999 stays on its own day.
  function dayEps(t) {
    return 1e-9 + Math.abs(t) * 2e-13;
  }

  function isLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function daysInYear(y) {
    return isLeap(y) ? 366 : 365;
  }

  function daysInMonth(year, month) {
    return month === 2 && isLeap(year) ? 29 : MONTH_DAYS[month - 1];
  }

  function clampMonth(month) {
    month = Math.floor(Number(month));
    if (!(month >= 1)) return 1;
    if (month > 12) return 12;
    return month;
  }

  // 1-based day of year; `day` may be fractional (e.g. 20.5 = noon on the 20th).
  function dayOfYear(year, month, day) {
    month = clampMonth(month);
    return MONTH_CUM[month - 1] + (month > 2 && isLeap(year) ? 1 : 0) + Number(day);
  }

  function ymd(year, month, day) {
    if (month === undefined) month = 1;
    if (day === undefined) day = 1;
    year = Math.floor(Number(year));
    return year + (dayOfYear(year, month, day) - 1) / daysInYear(year);
  }

  function ce(y, month, day) {
    return ymd(y, month, day);
  }

  function bce(y, month, day) {
    return ymd(1 - Math.floor(Number(y)), month, day);
  }

  function ya(n) {
    return PRESENT - n;
  }

  const ROOT_START = ya(300000);              // -298050

  function fromDate(date) {
    const secs = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 +
      date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;
    return ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate() + secs / 86400);
  }

  function now() {
    return fromDate(new Date());
  }

  function toParts(t) {
    let year = Math.floor(t);
    const eps = dayEps(t);
    let dayFloat = (t - year) * daysInYear(year);       // 0 ≤ dayFloat < daysInYear
    let dayIdx = Math.floor(dayFloat + eps);             // 0-based day of year
    if (dayIdx >= daysInYear(year)) {                     // float noise just below Jan 1 of next year
      year += 1;
      dayIdx = 0;
      dayFloat = 0;
    }
    let tod = dayFloat - dayIdx;                          // fraction of the day elapsed
    if (tod < 0) tod = 0;
    let totalMinutes = Math.floor(tod * 1440 + eps * 1440);
    if (totalMinutes > 1439) totalMinutes = 1439;

    const leap = isLeap(year);
    let month = 1;
    let rem = dayIdx;
    while (month < 12) {
      const len = month === 2 && leap ? 29 : MONTH_DAYS[month - 1];
      if (rem < len) break;
      rem -= len;
      month++;
    }
    return {
      year: year,
      month: month,
      day: rem + 1,
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60,
      dayOfYear: dayIdx + 1
    };
  }

  // Historical (non-astronomical) year: never 0; -1 = 1 BCE.
  function histYear(t) {
    return t >= 1 ? Math.floor(t) : Math.floor(t) - 1;
  }

  function fromHistYear(h) {
    h = Number(h);
    if (h === 0 || !Number.isFinite(h)) throw new RangeError('fromHistYear: historical year 0 does not exist');
    return h > 0 ? Math.floor(h) : Math.floor(h) + 1;
  }

  // Thousands separators only from 10,000 upward ("3000 BCE", "1492", "10,000 BCE").
  function fmtYearNumber(n) {
    return n >= 10000 ? n.toLocaleString('en-US') : String(n);
  }

  // Year label from a historical year. `forceCE` adds " CE" to years ≥ 1000 as well.
  function yearLabel(h, forceCE) {
    if (h < 0) return fmtYearNumber(-h) + ' BCE';
    if (h < 1000 || forceCE) return fmtYearNumber(h) + ' CE';
    return fmtYearNumber(h);
  }

  function formatYear(t) {
    return yearLabel(histYear(t), false);
  }

  // "250,000 years ago" ("1 year ago" for n = 1); anything at or after PRESENT (n ≤ 0) reads "today".
  function formatAgo(t) {
    const n = Math.round(PRESENT - t);
    if (n <= 0) return 'today';
    return n.toLocaleString('en-US') + (n === 1 ? ' year ago' : ' years ago');
  }

  function regimeForSpan(span) {
    if (span > 20000) return 'ago';
    if (span > 2) return 'year';
    if (span > 0.25) return 'month';
    return 'day';
  }

  function formatByRegime(t, regime, forceCE) {
    if (regime === 'ago') return formatAgo(t);
    if (regime === 'year') return yearLabel(histYear(t), forceCE);
    const p = toParts(t);
    const y = yearLabel(histYear(t), forceCE);
    if (regime === 'month') return MONTHS[p.month - 1] + ' ' + y;
    return MONTHS[p.month - 1] + ' ' + p.day + ', ' + y;
  }

  // Label for a tick/label at `t` while viewing a window of `span` years.
  function formatDate(t, span) {
    const regime = Number.isFinite(span) ? regimeForSpan(span) : 'day';
    return formatByRegime(t, regime, false);
  }

  // Coarseness rank of a regime (higher = coarser).
  const RANK = { day: 0, month: 1, year: 2, ago: 3 };

  // The coarsest calendar regime at which `t` is exactly representable
  // (Jan 1 00:00 -> 'year'; 1st of a month 00:00 -> 'month'; otherwise 'day').
  function exactRegime(t) {
    const p = toParts(t);
    if (p.hour !== 0 || p.minute !== 0 || p.day !== 1) return 'day';
    return p.month === 1 ? 'year' : 'month';
  }

  // "10,000 BCE – 1 CE", "1500 – 1800", "Jul 1969 – Aug 1969", "300,000 years ago – today".
  // Regime is the one for the span, promoted to 'month'/'year' when BOTH ends sit exactly on
  // such a boundary (so a Jul 1 – Aug 1 view reads "Jul 1969 – Aug 1969", not "Jul 1, 1969 – …").
  function formatRange(start, end) {
    let regime = regimeForSpan(end - start);
    if (regime !== 'ago') {
      const exact = Math.min(RANK[exactRegime(start)], RANK[exactRegime(end)]);
      if (exact > RANK[regime]) regime = exact === 2 ? 'year' : 'month';
    }
    const forceCE = regime !== 'ago' && (histYear(start) < 0 || histYear(end) < 0);
    return formatByRegime(start, regime, forceCE) + ' – ' + formatByRegime(end, regime, forceCE);
  }

  // Full-precision label for tooltips and the side panel.
  function formatDateFull(t) {
    if (t < bce(20000)) return 'c. ' + formatAgo(t);
    return formatByRegime(t, 'day', false);
  }

  HT.time = {
    PRESENT: PRESENT,
    ROOT_START: ROOT_START,
    MONTHS: MONTHS,
    now: now,
    isLeap: isLeap,
    daysInYear: daysInYear,
    daysInMonth: daysInMonth,
    dayOfYear: dayOfYear,
    fromDate: fromDate,
    toParts: toParts,
    ymd: ymd,
    ce: ce,
    bce: bce,
    ya: ya,
    histYear: histYear,
    fromHistYear: fromHistYear,
    formatYear: formatYear,
    formatAgo: formatAgo,
    formatDate: formatDate,
    formatRange: formatRange,
    formatDateFull: formatDateFull,
    regimeForSpan: regimeForSpan
  };
})(typeof window !== 'undefined' ? window : globalThis);
