/* HT.ticks — axis tick generation (CONTRACT.md §4)
 *
 * computeTicks(start, end, widthPx, opts?) -> { regime, unit, step, major, minor }
 *
 * regime = HT.time.regimeForSpan(end - start) and every label is HT.time.formatDate(t, span),
 * so the tick unit follows the regime (ago/year → years, month → months, day → days): a finer
 * unit would give several ticks the same label. Within that unit's ladder the smallest interval
 * whose average pixel spacing is ≥ opts.targetPx wins (the largest interval when none qualifies;
 * overlap thinning then keeps the labels apart). Positions are "nice" in the space the user reads
 * (whole "years ago" multiples, historical-year multiples with the 1 CE epoch tick, calendar
 * month/day boundaries). Minor ticks subdivide consecutive majors evenly in t and are extended
 * past the first/last major to the view edges. Labels are thinned left-to-right so they never
 * overlap; the font never shrinks.
 *
 * HT.time is read at call time only (never at definition time).
 */
(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});

  const DAY = 1 / 365.25;                     // average unit lengths in years, used for ladder spacing
  const MONTH = 1 / 12;
  const MAX_YEAR_EXP = 6;                     // years ladder runs 1 … 5,000,000
  const MAX_MAJORS_SAFETY = 400;              // hard ceiling on generated majors (defensive only)
  const LOOP_GUARD = 5000;

  const DEFAULTS = {
    targetPx: 110,
    labelGap: 12,
    labelWidth: function (label) { return label.length * 7 + 0; }
  };

  const UNIT_FOR_REGIME = { ago: 'years', year: 'years', month: 'months', day: 'days' };
  const UNIT_SIZE = { years: 1, months: MONTH, days: DAY };

  function yearsLadder() {
    const out = [];
    let pow = 1;
    for (let n = 0; n <= MAX_YEAR_EXP; n++) {
      out.push(1 * pow, 2 * pow, 5 * pow);
      pow *= 10;
    }
    return out;
  }
  const LADDERS = { years: yearsLadder(), months: [1, 2, 3, 6], days: [1, 2, 7, 14] };

  // 5 subdivisions when the step's leading digit is 1 or 5, 4 when it is 2; months/days: 4.
  function subdivisions(unit, step) {
    if (unit !== 'years') return 4;
    const lead = Number(String(step).charAt(0));
    return lead === 2 ? 4 : 5;
  }

  /* ---- position generators -------------------------------------------------------------
   * Each returns an ASCENDING array of candidate positions that reaches at least one interval
   * past both view edges, so that minors can be "extended to the view edges" using the real
   * neighbouring spacing. Callers decide which in-view candidates are majors.
   */

  // regime 'ago': t = PRESENT - k*step. k ≤ 0 candidates (t ≥ PRESENT) are generated only to
  // anchor minors; they are never majors (see isMajor in computeTicks).
  function positionsAgo(T, start, end, step) {
    const P = T.PRESENT;
    const kMin = Math.ceil((P - end) / step) - 1;
    const kMax = Math.floor((P - start) / step) + 1;
    const out = [];
    for (let k = kMax; k >= kMin && out.length < LOOP_GUARD; k--) out.push(P - k * step);
    return out;
  }

  // years, step 1: every integer t.
  function positionsIntegerYears(start, end) {
    const out = [];
    const a = Math.floor(start) - 1;
    const b = Math.ceil(end) + 1;
    for (let t = a; t <= b && out.length < LOOP_GUARD; t++) out.push(t);
    return out;
  }

  // years, step ≥ 2: historical years that are multiples of step (via fromHistYear) plus the
  // epoch tick at t = 1 (1 CE) standing in for historical year 0.
  function positionsHistYears(T, start, end, step) {
    const hs = T.histYear(start);
    const he = T.histYear(end);
    const kMin = Math.floor(hs / step) - 1;
    const kMax = Math.ceil(he / step) + 1;
    const out = [];
    for (let k = kMin; k <= kMax && out.length < LOOP_GUARD; k++) {
      const h = k * step;
      out.push(h === 0 ? 1 : T.fromHistYear(h));
    }
    return out;
  }

  // months: the 1st of months whose (month-1) is a multiple of step (step divides 12).
  function positionsMonths(T, start, end, step) {
    const ps = T.toParts(start);
    let y = ps.year;
    let m = Math.floor((ps.month - 1) / step) * step;   // 0-based, aligned, ≤ start
    m -= step;                                          // one interval before the view
    if (m < 0) { m += 12; y -= 1; }
    const out = [];
    for (let i = 0; i < LOOP_GUARD; i++) {
      const t = T.ymd(y, m + 1, 1);
      out.push(t);
      if (t > end) break;
      m += step;
      if (m >= 12) { m -= 12; y += 1; }
    }
    return out;
  }

  // days: day-of-month 1, 1+step, 1+2*step, … (reset each month), from the month before the
  // view to the month after it.
  function positionsDays(T, start, end, step) {
    const ps = T.toParts(start);
    const pe = T.toParts(end);
    let y = ps.year;
    let m = ps.month - 1;
    if (m < 1) { m = 12; y -= 1; }
    let yEnd = pe.year;
    let mEnd = pe.month + 1;
    if (mEnd > 12) { mEnd = 1; yEnd += 1; }
    const out = [];
    for (let i = 0; i < LOOP_GUARD; i++) {
      const dim = T.daysInMonth(y, m);
      for (let d = 1; d <= dim; d += step) out.push(T.ymd(y, m, d));
      if (y > yEnd || (y === yEnd && m >= mEnd)) break;
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }

  function generatePositions(T, unit, regime, start, end, step) {
    if (unit === 'days') return positionsDays(T, start, end, step);
    if (unit === 'months') return positionsMonths(T, start, end, step);
    if (regime === 'ago') return positionsAgo(T, start, end, step);
    if (step === 1) return positionsIntegerYears(start, end);
    return positionsHistYears(T, start, end, step);
  }

  /* ---- main entry point ---------------------------------------------------------------- */

  function computeTicks(start, end, widthPx, opts) {
    const T = HT.time;
    opts = opts || {};
    start = Number(start);
    end = Number(end);
    if (end < start) { const tmp = start; start = end; end = tmp; }
    const span = end - start;
    widthPx = Number(widthPx);
    if (!(widthPx > 0)) widthPx = 1;
    const targetPx = opts.targetPx > 0 ? Number(opts.targetPx) : DEFAULTS.targetPx;
    const labelGap = Number.isFinite(opts.labelGap) ? Number(opts.labelGap) : DEFAULTS.labelGap;
    const lw = opts.labelWidth;
    const labelWidth = typeof lw === 'function' ? lw
      : (typeof lw === 'number' ? function () { return lw; } : DEFAULTS.labelWidth);

    if (!(span > 0) || !Number.isFinite(span)) {
      return { regime: 'day', unit: 'days', step: 1, major: [], minor: [] };
    }

    const regime = T.regimeForSpan(span);
    const unit = UNIT_FOR_REGIME[regime];
    const ladder = LADDERS[unit];
    const size = UNIT_SIZE[unit];

    // Smallest ladder interval (in this unit) whose average pixel spacing is ≥ targetPx; the
    // largest interval when none qualifies (thinning keeps the labels apart).
    let idx = -1;
    for (let i = 0; i < ladder.length; i++) {
      if (ladder[i] * size / span * widthPx >= targetPx) { idx = i; break; }
    }
    if (idx < 0) idx = ladder.length - 1;
    // Defensive: never let a pathological opts/width combination explode the tick count.
    while (idx < ladder.length - 1 && span / (ladder[idx] * size) > MAX_MAJORS_SAFETY) idx++;

    // Inclusion tolerance for ticks sitting exactly on a view edge (float noise only).
    const eps = span * 1e-9 + (Math.abs(start) + Math.abs(end)) * 1e-12;
    const lo = start - eps;
    const hi = end + eps;
    const inView = function (t) { return t >= lo && t <= hi; };

    // In the 'ago' regime only k ≥ 1 ("N years ago") positions are majors: the k = 0 position
    // (t = PRESENT = 1950) would read "today" while the axis runs on to now.
    const isMajor = function (t, step) {
      if (!inView(t)) return false;
      if (regime === 'ago') return t <= T.PRESENT - step + eps;
      return true;
    };

    // A chosen interval can be wider than the view (e.g. a 7-day step over a 6-day view), in
    // which case the window may contain no major at all; fall back to the next finer interval
    // so the axis is never empty.
    let step = ladder[idx];
    let positions = [];
    let majorTs = [];
    for (let i = idx; i >= 0; i--) {
      step = ladder[i];
      positions = generatePositions(T, unit, regime, start, end, step);
      majorTs = positions.filter(function (t) { return isMajor(t, step); });
      if (majorTs.length > 0) break;
    }

    // A sub-day view that contains no midnight (a one-day span in a common year can be a few
    // seconds short of a calendar day): fall back to quarter-day positions so the axis is labelled.
    if (majorTs.length === 0 && unit === 'days') {
      const p0 = T.toParts(start);
      const dayStart = T.ymd(p0.year, p0.month, p0.day);
      const dayLen = 1 / T.daysInYear(p0.year);
      for (let k = 0; k <= 8; k++) {
        const t = dayStart + k * dayLen / 4;
        if (inView(t)) majorTs.push(t);
      }
    }

    const major = majorTs.map(function (t) {
      return { t: t, label: T.formatDate(t, span), labeled: true };
    });

    // Minor ticks: evenly spaced in t between consecutive candidate positions (which extend past
    // both view edges), keeping only those inside the view. An in-view candidate that is not a
    // major (the 'ago' k ≤ 0 anchor) is itself a minor so the grid reaches the view edge.
    const n = subdivisions(unit, step);
    const majorSet = new Set(majorTs);
    const minor = [];
    for (let i = 0; i < positions.length; i++) {
      const b = positions[i];
      if (i > 0) {
        const a = positions[i - 1];
        if (b > a && !(b < lo || a > hi)) {
          for (let j = 1; j < n; j++) {
            const t = a + (b - a) * (j / n);
            if (inView(t)) minor.push(t);
          }
        }
      }
      if (inView(b) && !majorSet.has(b)) minor.push(b);
    }

    // Overlap thinning: walk left to right, keep the first, suppress any label whose left edge
    // would come within labelGap of the previous kept label's right edge.
    const scale = widthPx / span;
    let prevRight = -Infinity;
    for (let i = 0; i < major.length; i++) {
      const m = major[i];
      const w = Number(labelWidth(m.label, m.t)) || 0;
      const px = (m.t - start) * scale;
      const left = px - w / 2;
      if (i === 0 || left >= prevRight + labelGap) {
        m.labeled = true;
        prevRight = px + w / 2;
      } else {
        m.labeled = false;
      }
    }

    return { regime: regime, unit: unit, step: step, major: major, minor: minor };
  }

  HT.ticks = {
    computeTicks: computeTicks,
    DEFAULTS: DEFAULTS
  };
})(typeof window !== 'undefined' ? window : globalThis);
