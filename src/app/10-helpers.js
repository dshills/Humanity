// HT.app, part 10: Helpers: view limits and pixel mapping wrappers, DOM builders, date labels.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // ------------------------------------------------------------------
  // 2. Helpers
  // ------------------------------------------------------------------
  const clamp = C.clamp;
  const sameView = C.sameView;
  const contains = C.contains;
  const fitInside = C.fitInside;
  const hasEnd = C.hasEnd;

  function nowT() {
    if (NOW === null) NOW = HT.time.now();
    return NOW;
  }

  // View limits, the hash, regions, slugs and the other pure rules live in src/core.js (HT.core), where they
  // are tested from Node; the wrappers here only supply this page's fixed "now".
  function maxEnd(span) { return C.maxEnd(span, nowT()); }
  function endAtNow(start) { return C.endAtNow(start, nowT()); }
  function atNow(v) { return C.atNow(v, nowT()); }
  function capNow(t) { return Math.min(t, nowT()); }
  function rootView() { return C.rootView(nowT()); }

  function rootEntry() {
    const r = rootView();
    return { start: r.start, end: r.end, discrete: true };
  }

  function isRoot(v) {
    return sameView(v, rootView());
  }

  function clampView(start, end) { return C.clampView(start, end, nowT()); }

  // Time to pixels and back. Linear for ordinary views; warped on the widest ones unless the scale is set to
  // linear (HT.core.tToU). Gestures never assume linearity: they work out which stretch of the current
  // width should fill the stage and ask viewOfPx for the view that shows it.
  function tToPx(t, v) {
    return C.tToU(t, v, nowT(), scaleMode) * size.width;
  }

  function pxToT(px, v) {
    return C.uToT(px / size.width, v, nowT(), scaleMode);
  }

  // `anchorPx`: a pixel whose date must stay where it is (the pointer, a finger); see HT.core.anchorView.
  function viewOfPx(px0, px1, v, anchorPx) {
    const out = C.viewFromU(px0 / size.width, px1 / size.width, v, nowT(), scaleMode);
    if (anchorPx === undefined || !warped(v)) return out;
    const tA = pxToT(px0 + (anchorPx / size.width) * (px1 - px0), v);     // the date that should end up at anchorPx
    return C.anchorView(out, tA, anchorPx / size.width, nowT(), scaleMode);
  }

  function warped(v) { return C.warpWeight(v.end - v.start, scaleMode); }

  function crisp(x) {
    return Math.round(x) + 0.5;
  }

  function svgLeft() {
    return dom.svg.getBoundingClientRect().left;
  }

  function svgEl(name, attrs, text) {
    const el = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (const k in attrs) {
        if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
      }
    }
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function htmlEl(name, className, text) {
    const el = document.createElement(name);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function closestEra(target) {
    return target && typeof target.closest === 'function' ? target.closest('.era-jump') : null;
  }

  function closestEvent(target) {
    return target && typeof target.closest === 'function' ? target.closest('.event') : null;
  }

  function tierSpan(tier) {
    if (HT.tiers && typeof HT.tiers.tierSpan === 'function') return HT.tiers.tierSpan(tier);
    return TIER_SPANS_FALLBACK[clamp(Math.floor(Number(tier)) || 0, 0, 7)];
  }

  function reduceMotion() {
    return typeof root.matchMedia === 'function' && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function events() {
    return HT.events || [];
  }

  // Date text for tooltips/panel. Ranges use formatRange (year-precision ranges read
  // "3100 BCE – 2900 BCE" instead of two "Jan 1" dates); points use formatDateFull, except
  // that pre-1900 events dated exactly Jan 1 (year precision by the data rules) show just the year.
  function eventDateLabel(ev) {
    const T = HT.time;
    if (hasEnd(ev)) {
      const range = T.formatRange(ev.t, ev.end);
      const cut = range.lastIndexOf(' \u2013 ');
      return ev.ongoing === true && cut > 0 ? range.slice(0, cut) + ' \u2013 present' : range;
    }
    if (ev.yearOnly === true) return T.formatYear(ev.t);
    if (ev.t < T.bce(10000) && (T.PRESENT - ev.t) % 100 === 0) return 'c. ' + T.formatAgo(ev.t);
    if (ev.t < 1900 && ev.t >= T.bce(20000)) {
      const p = T.toParts(ev.t);
      if (p.month === 1 && p.day === 1 && p.hour === 0 && p.minute === 0) return T.formatYear(ev.t);
    }
    return T.formatDateFull(ev.t);
  }

  function cursorLabel(t, span) {
    return span <= 20000 ? HT.time.formatDateFull(t) : HT.time.formatAgo(t);
  }
