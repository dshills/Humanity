/* HT.app — rendering, interaction and URL state (CONTRACT.md §7, PROMPT.md)
 *
 * Sections
 *   1. Constants and state
 *   2. Helpers: math, view clamping, DOM
 *   3. View model: history stack, URL hash, animation, commit()
 *   4. Public navigation API: setView, zoomIn, zoomOut, home, zoomToEvent, getView
 *   5. Rendering: axis + ticks, events + lanes, cursor guide, breadcrumbs, legend
 *   6. Tooltip and detail panel
 *   7. Interaction: pointer (tap / drag / pinch), wheel, keyboard, buttons, resize, history
 *   8. init
 *
 * The script never runs on its own: the bundle calls HT.app.init() once at the end.
 */
(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const C = HT.core;                      // pure rules, tested in test/core.test.js

  // ------------------------------------------------------------------
  // 1. Constants and state
  // ------------------------------------------------------------------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ZOOM_FACTOR = 4;
  const ANIM_MS = 250;
  const MIN_SPAN = C.MIN_SPAN;            // one day in years (>= one calendar day in common and leap years)
  const MIN_VISIBLE = 8;                  // admit lower tiers until this many events are in view
  const THEMES = ['ops', 'crt', 'nvg', 'ironbow', 'noir', 'paper'];
  const THEME_KEY = 'ht-theme';
  const EARTH_KEY = 'ht-earth';
  const HIDDEN_KEY = 'ht-hidden-cats';
  const REIGNS_KEY = 'ht-reigns';
  const LIVES_KEY = 'ht-lives';
  const BIRTH_KEY = 'ht-birth';
  const LIVES_MAX_SPAN = 3000;            // wider than this a lifetime is a few pixels
  const IMAGES_KEY = 'ht-images';
  const REGION_KEY = 'ht-region';
  const HELP_KEY = 'ht-help-seen';
  const MM_BINS = 160;
  const REIGN_MAX_SPAN = 20000;       // wider than this, five millennia of reigns are a smear at the edge
  const CITY_MAX_SPAN = 40000;
  const RECORDED_START = -3299;       // c. 3300 BCE, the first writing: where "recorded history" begins
  const ERA_TOP = 30;                 // y of the recorded-history bracket
  const ERA_RESERVE = 52;             // px kept clear of lanes beneath the top of the stage while it shows
  const IMAGE_CACHE_KEY = 'ht-summary-cache';      // was ht-image-cache before summaries were kept too
  const OTD_MAX_SPAN = C.OTD_MAX_SPAN;    // about a month: the widest view that loads Wikipedia's "on this day" lists
  const OTD_CACHE_KEY = 'ht-otd-cache';
  const OTD_CACHE_DAYS = 40;              // days kept in localStorage, oldest dropped first
  const OTD_HINT_KEY = 'ht-otd-hint';
  const SCALE_KEY = 'ht-scale';
  const OTD_PARALLEL = 6;
  const OTD_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/';
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const IMAGE_CACHE_MAX = 200;
  const API_UA = 'HumanityTimeline/1.0 (https://github.com/dshills/Humanity)';
  const REIGN_ROW_H = 17;                 // px per swimlane row
  const REIGN_TOP = 22;                   // px from the top of the stage to the first row (clears the corner bracket)
  const REIGN_MAX_ROWS = 12;
  const REIGN_MIN_WIDTH = 640;            // narrower stages keep reigns as ordinary events
  const WIKI_PREFIX = C.WIKI_PREFIX;
  const SEARCH_LIMIT = 12;
  const EARTH_ORDER = ['co2', 'temp', 'sea', 'pop'];
  const POP_META = { label: 'Population', range: [6.5, 10], log: true };   // log10 scale: 3 million to 10 billion
  const CITY_H = 15;
  const DRAG_THRESHOLD = 4;               // px of movement before a press becomes a drag
  const RESIZE_DEBOUNCE_MS = 100;
  const URL_DEBOUNCE_MS = 200;            // trailing replaceState during wheel/drag (Safari rate-limits history writes)
  const AXIS_FRACTION = 0.62;             // the axis sits at 62% of the stage height
  const LANE_PITCH = 26;                  // px between label lanes
  const MAX_LANES = 8;
  const LANE_TOP_PAD = 24;                // px kept free above the top-most lane
  const LANE_BASE_OFFSET = 18;            // px from the axis up to lane 0's text baseline
  const MARKER_R = 5;                     // point marker radius
  const BAR_H = 6;                        // range bar height
  const LABEL_GAP = 6;                    // px between a marker and its label
  const EDGE_PAD = 4;                     // px keep-out at the left/right edges
  const ROOT_CRUMB = 'All of humanity';
  const WHEEL_K = 0.002;                  // zoom factor = exp(deltaY * K) for mouse wheels
  const PINCH_K = 0.01;                   // trackpad pinch (ctrlKey wheel) reports much smaller deltas
  const TIER_SPANS_FALLBACK = [100000, 20000, 5000, 1000, 200, 50, 10, 10];

  let inited = false;
  let dom = null;                         // element references (filled by init)
  let NOW = null;                         // t of the current instant, fixed at init
  let view = null;                        // committed logical view {start, end}
  let shown = null;                       // the view currently drawn (differs from `view` only mid-animation)
  let stack = [];                         // zoom history: [{start, end, discrete}] root … current
  let anim = null;                        // running animation {raf}
  const size = { width: 1, height: 1 };   // stage pixel size
  let selected = -1;                      // index of the event open in the panel
  const widthCache = new Map();           // 'kind\0text' -> measured px
  let measureTickEl = null;               // hidden <text class="tick-label">
  let measureLabelEl = null;              // hidden <text class="label">
  let resizeTimer = 0;
  let urlTimer = 0;
  let urlPending = false;
  const pointers = new Map();             // active pointers: id -> {x, y}
  let gesture = null;                     // {type:'press'|'pinch', ...}
  let lastMouseX = null;                  // last mouse clientX over the stage (null when no mouse is over it)
  let theme = 'auto';                     // 'auto' resolves to ops/paper from prefers-color-scheme
  let settleNext = false;                 // next render follows a discrete view change: animate arrivals
  let lastAxisY = 0;
  let chipHalf = 40;                      // cached half-width of the cursor chip
  let hudStats = { visible: 0, inWindow: 0, tier: 0 };
  let clockTimer = 0;
  let earthOn = true;                     // climate sparklines visible
  const hiddenCats = new Set();           // categories filtered out via the legend
  let reignsOn = true;                    // ruler swimlanes visible
  let birthYear = null;                   // "Your lifetime": kept in this browser only, never written to the URL
  let lifeTourDef = null;                 // the tour generated from it
  let livesOn = false;                    // lifespans of notable people instead (the two layers share the top of the stage)
  let livesRows = [];                     // [[event index]] per row, chosen for this frame
  let livesStats = { shown: 0, inView: 0 };
  let imagesOn = false;                   // opt-in: fetch a thumbnail from Wikimedia for the open event
  let regionFilter = null;                // null = everywhere, else a key of REGIONS
  let regionCache = null;                 // event index -> region key | '' (unknown)
  let slugIndex = null;                   // { bySlug: Map, byIndex: [] } for ev= permalinks
  let pendingEv = -1;                     // event index named by the URL, opened once the view is set
  let mmDensity = null;                   // minimap density bins
  let mmDrag = false;
  let mmGrab = 0;
  let mmDownX = 0;
  let mmMoved = false;
  let imageSeq = 0;                     // guards against a slow response landing on a different event
  const otdDays = new Map();              // 'MM/DD' -> 'loading' | 'done' | 'error'
  const otdInflight = new Map();          // 'MM/DD' -> the promise of a request under way
  let otdQueue = [];
  let otdActive = 0;
  let otdTimer = 0;
  let otdRenderTimer = 0;
  let otdInView = 0;                      // on-this-day events inside the current view
  let otdHint = true;                     // offer the layer on deep views while the opt-in is off
  let otdLinkIndex = null;                // article title -> [t] of bundled events, to skip what is already here
  let scaleMode = 'log';                  // 'log': the widest views use a warped axis (HT.core.tToU); 'lin': never
  let measureFrom = -1;                   // index of the event being measured from, or -1
  let embed = false;                      // ?embed=1: a quiet page for an iframe (no chrome, no history entries)
  let tour = null;                        // { def, step } while a guided tour is running
  let pendingTour = null;                 // { id, step } last parsed from the URL
  let titleIndex = null;                  // event title -> index, for tour steps
  let pendingSlug = '';                   // ev= slug that named nothing yet (an on-this-day event not loaded)
  let imageCache = null;                  // { title: { src, page, credit } | 0 }  (0 = nothing usable)
  let reignReserve = 0;                   // px at the top of the stage reserved for swimlanes this frame
  let reignRows = [];                     // [{ group, items: [event index] }] chosen for this frame
  let groupOrder = null;                  // stable row order: first appearance in the data
  let searchIndex = null;                 // lazily built [{ i, key }] of lower-cased titles
  let searchHits = [];
  let searchActive = -1;
  let suppressClickUntil = 0;

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

  // ------------------------------------------------------------------
  // 3. View model: history stack, URL hash, animation, commit()
  // ------------------------------------------------------------------

  // --- URL hash: #s=<start>&e=<end|now>&m=<theme>&ev=<slug> (format and parsing in HT.core) ---
  function encodeHash(v) {
    return C.encodeHash(v, nowT(), theme, selected >= 0 && dom && !dom.panel.hidden ? slugFor(selected) : '',
      tour ? { id: tour.def.id, step: tour.step } : null, scaleMode, measureFrom >= 0 ? slugFor(measureFrom) : '');
  }

  // Applies the hash's theme and event as side effects and returns its view (null when it names none).
  function parseHash(hash) {
    if (!hash || hash.length < 2) return null;
    const h = C.parseHash(hash, nowT());
    if (h.theme && THEMES.indexOf(h.theme) >= 0 && h.theme !== theme) setTheme(h.theme, { silent: true });
    pendingEv = h.ev ? indexForSlug(h.ev) : -1;
    pendingSlug = h.ev && pendingEv < 0 ? h.ev : '';
    pendingTour = h.tour;
    const fromIndex = h.from ? indexForSlug(h.from) : -1;
    if (fromIndex !== measureFrom) { measureFrom = fromIndex; if (dom) { updateMeasureChip(); if (selected >= 0 && !dom.panel.hidden) updatePanelMeasure(selected); } }
    if (h.scale === 'lin' && scaleMode !== 'lin') setScale('lin', { keep: true });   // a shared linear link shows as sent, without changing the visitor's own choice
    return h.view;
  }

  // --- Breadcrumb stack. Invariant: stack[0] is the root view and every entry contains the next. ---
  function normalizeStack() {
    const cur = stack.pop();
    while (stack.length > 1 && !contains(stack[stack.length - 1], cur)) stack.pop();
    if (stack.length === 0) stack.push(rootEntry());
    if (!isRoot(cur)) stack.push(cur);
  }

  function pushStack(v, discrete) {
    const top = stack[stack.length - 1];
    if (top && sameView(top, v)) { top.discrete = !!discrete; return; }
    stack.push({ start: v.start, end: v.end, discrete: !!discrete });
    normalizeStack();
  }

  function replaceStack(v, discrete) {
    if (stack.length > 1) stack.pop();
    pushStack(v, discrete);
  }

  function deriveStack(v) {
    const s = [rootEntry()];
    if (!isRoot(v)) s.push({ start: v.start, end: v.end, discrete: true });
    return s;
  }

  function serializeStack() {
    return stack.map(function (e) {
      return [e.start, atNow(e) ? 'now' : e.end, e.discrete ? 1 : 0];
    });
  }

  // Rebuild a stack saved in history.state; null when it is not a valid chain ending at `target`.
  function restoreStack(arr, target) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const s = [];
    for (let i = 0; i < arr.length; i++) {
      const x = arr[i];
      if (!Array.isArray(x)) return null;
      const e = { start: Number(x[0]), end: x[1] === 'now' ? endAtNow(Number(x[0])) : Number(x[1]), discrete: !!x[2] };
      if (!Number.isFinite(e.start) || !Number.isFinite(e.end) || !(e.end > e.start)) return null;
      if (i > 0 && !contains(s[i - 1], e)) return null;
      s.push(e);
    }
    if (!isRoot(s[0]) || !sameView(s[s.length - 1], target)) return null;
    return s;
  }

  // --- history.pushState / replaceState ---
  function historyState() {
    return { ht: 1, stack: serializeStack() };
  }

  function writeUrl(mode) {
    if (typeof root.history === 'undefined' || typeof root.location === 'undefined') return;
    const hash = encodeHash(view);
    if (embed) { mode = 'replace'; updateEmbedLink(hash); }   // an iframe must not add entries to its host's history
    try {
      if (mode === 'push' && root.location.hash !== hash) root.history.pushState(historyState(), '', hash);
      else root.history.replaceState(historyState(), '', hash);
    } catch (err) {
      // file:// in some browsers or Safari's rate limit: fall back to a plain hash assignment
      if (mode === 'push' && root.location.hash !== hash) {
        try { root.location.hash = hash; } catch (err2) { /* ignore */ }
      }
    }
  }

  // Embedded, the brand line links to the same view on the full page.
  function updateEmbedLink(hash) {
    if (!dom || !dom.embedOpen) return;
    try {
      const u = new root.URL(String(root.location.href));
      u.searchParams.delete('embed');                     // whatever else is in the query stays
      u.hash = hash || root.location.hash || '';
      dom.embedOpen.href = u.href;
    } catch (err) { /* ignore */ }
  }

  // Stamp the current entry with our state without touching the visible URL.
  function stampState() {
    if (typeof root.history === 'undefined') return;
    try { root.history.replaceState(historyState(), ''); } catch (err) { /* ignore */ }
  }

  function scheduleUrlReplace() {
    urlPending = true;
    if (!urlTimer) urlTimer = setTimeout(flushUrl, URL_DEBOUNCE_MS);
  }

  function flushUrl() {
    if (urlTimer) { clearTimeout(urlTimer); urlTimer = 0; }
    if (urlPending) { urlPending = false; writeUrl('replace'); }
  }

  function discardPendingUrl() {
    if (urlTimer) { clearTimeout(urlTimer); urlTimer = 0; }
    urlPending = false;
  }

  // --- Animation: 250ms ease-out interpolating log(span) and center ---
  function cancelAnimation() {
    if (anim) {
      if (typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(anim.raf);
      clearTimeout(anim.timer);
      anim = null;
    }
  }

  function startAnimation(from, to) {
    cancelAnimation();
    const s0 = Math.log(from.end - from.start);
    const s1 = Math.log(to.end - to.start);
    const c0 = (from.start + from.end) / 2;
    const c1 = (to.start + to.end) / 2;
    const t0 = root.performance.now();
    const a = { raf: 0, timer: 0 };
    anim = a;
    function finish() {
      if (anim !== a) return;
      anim = null;
      clearTimeout(a.timer);
      shown = to;
      settleNext = true;
      render();
    }
    // Safety net: if animation frames are starved (background tab, busy main thread), still land.
    a.timer = setTimeout(function () {
      if (anim === a) { root.cancelAnimationFrame(a.raf); finish(); }
    }, ANIM_MS + 100);
    function step(ms) {
      if (anim !== a) return;
      const p = clamp((ms - t0) / ANIM_MS, 0, 1);
      if (p >= 1) { finish(); return; }
      const e = 1 - Math.pow(1 - p, 3);                 // cubic ease-out
      const span = Math.exp(s0 + (s1 - s0) * e);
      const c = c0 + (c1 - c0) * e;
      shown = clampView(c - span / 2, c + span / 2);
      render();
      a.raf = root.requestAnimationFrame(step);
    }
    a.raf = root.requestAnimationFrame(step);
  }

  // Central state transition.
  //   opts.animate  boolean
  //   opts.url      'push' | 'replace' | 'none'    push = discrete zoom, replace = continuous (debounced)
  //   opts.stack    'push' | 'replace' | 'keep'    keep = caller already arranged the stack
  //   opts.discrete flag stored on the stack entry (true = produced by a click/button zoom)
  function commit(target, opts) {
    const v = clampView(target.start, target.end);
    if (opts.url === 'push') flushUrl();                // persist a pending continuous change before pushing
    view = v;
    if (opts.stack === 'push') pushStack(v, opts.discrete);
    else if (opts.stack === 'replace') replaceStack(v, opts.discrete);
    if (!dom) { shown = v; return; }                    // before init: state only
    if (opts.url === 'push') writeUrl('push');
    else if (opts.url === 'replace') scheduleUrlReplace();
    const animate = opts.animate && !reduceMotion() && typeof root.requestAnimationFrame === 'function';
    if (animate && shown && !sameView(shown, v)) {
      startAnimation(shown, v);
    } else {
      cancelAnimation();
      const changed = !sameView(shown, v);
      shown = v;
      if (changed) { settleNext = !!opts.discrete; render(); }
    }
    renderCrumbs();
    if (dom && (opts.discrete || opts.url === 'push')) announceView();
  }

  // ------------------------------------------------------------------
  // 4. Public navigation API
  // ------------------------------------------------------------------
  function getView() {
    const v = view || rootView();
    return { start: v.start, end: v.end };
  }

  function setView(start, end, opts) {
    opts = opts || {};
    const animate = opts.animate !== false;
    const push = opts.pushHistory !== false;
    commit({ start: start, end: end }, {
      animate: animate,
      url: push ? 'push' : 'replace',
      stack: push ? 'push' : 'replace',
      discrete: push
    });
  }

  function zoomIn(tCenter, factor) {
    factor = factor > 0 ? factor : ZOOM_FACTOR;
    // Base the new span on the committed view, not the in-flight animation frame, so that a
    // second click during (or before the first frame of) an animation still zooms a further x4.
    const base = view || rootView();
    const baseSpan = base.end - base.start;
    if (baseSpan <= MIN_SPAN * (1 + 1e-6)) return;     // already at maximum zoom: a click is a no-op
    if (!Number.isFinite(tCenter)) tCenter = (base.start + base.end) / 2;
    // The clicked date moves to the middle and 1/factor of the width around it fills the stage, slid back
    // inside when it would overhang an edge. On a linear view that is a span of baseSpan / factor; on a
    // warped one it is whatever that stretch of the screen holds.
    const half = 0.5 / factor;
    const uc = clamp(C.tToU(tCenter, base, nowT(), scaleMode), half, 1 - half);
    let target = C.viewFromU(uc - half, uc + half, base, nowT(), scaleMode);
    if (warped(base)) target = C.anchorView(target, C.uToT(uc, base, nowT(), scaleMode), 0.5, nowT(), scaleMode);   // keep the middle in the middle
    if (target.end - target.start < MIN_SPAN) target = fitInside({ start: tCenter - MIN_SPAN / 2, end: tCenter + MIN_SPAN / 2 }, base);
    commit(target, { animate: true, url: 'push', stack: 'push', discrete: true });
  }

  // Reverses the last discrete zoom-in when there is one; otherwise zooms out ×factor around the center.
  function zoomOut(factor) {
    factor = factor > 0 ? factor : ZOOM_FACTOR;
    const top = stack[stack.length - 1];
    if (stack.length > 1 && top && top.discrete && sameView(top, view)) {
      stack.pop();
      const parent = stack[stack.length - 1];
      commit(parent, { animate: true, url: 'push', stack: 'keep' });
      return;
    }
    const base = view || rootView();
    const c = (base.start + base.end) / 2;
    const span = (base.end - base.start) * factor;
    commit({ start: c - span / 2, end: c + span / 2 },
      { animate: true, url: 'push', stack: 'replace', discrete: false });
  }

  function home() {
    commit(rootView(), { animate: true, url: 'push', stack: 'push', discrete: true });
  }

  // The target window is C.eventWindow; when the event is already on screen the window is kept inside the
  // current view so the breadcrumb chain stays nested.
  function zoomToEvent(ev) {
    if (!ev || !Number.isFinite(ev.t)) return;
    const win = C.eventWindow(ev, nowT(), tierSpan(ev.tier));
    const base = view || rootView();
    const target = ev.t >= base.start && ev.t <= base.end ? fitInside(win, base) : win;
    commit(target, { animate: true, url: 'push', stack: 'push', discrete: true });
  }

  // ------------------------------------------------------------------
  // 5. Rendering
  // ------------------------------------------------------------------

  // Label widths come from a hidden <text> (getComputedTextLength), cached per string.
  function measure(el, kind, text) {
    const key = kind + ' ' + text;
    let w = widthCache.get(key);
    if (w === undefined) {
      w = 0;
      if (el) {
        el.textContent = text;
        try { w = el.getComputedTextLength(); } catch (err) { w = 0; }
      }
      if (!(w > 0)) w = text.length * 7;               // fallback: contract's estimate
      widthCache.set(key, w);
    }
    return w;
  }

  function measureTickLabel(text) {
    return measure(measureTickEl, 'tick', text);
  }

  function measureEventLabel(text) {
    return measure(measureLabelEl, 'label', text);
  }

  // Truncate a title with an ellipsis so it fits within maxW px.
  function fitLabel(title, maxW) {
    const full = measureEventLabel(title);
    if (full <= maxW) return title;
    // Binary search the longest prefix that fits (each probe is one cached measurement, ~6 probes).
    const cut = function (n) { return title.slice(0, n).replace(/\s+$/, '') + '…'; };
    let lo = 1;
    let hi = title.length - 1;
    let best = cut(1);
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const text = cut(mid);
      if (measureEventLabel(text) <= maxW) { best = text; lo = mid + 1; }
      else hi = mid - 1;
    }
    return best;
  }

  function measureSize() {
    size.width = Math.max(1, dom.stage.clientWidth || 1);
    size.height = Math.max(1, dom.stage.clientHeight || 1);
    // Read the HUD's position here, before any DOM writes in this frame, so renderEarth never forces a layout.
    size.hudTop = dom.hud && !dom.hud.hidden
      ? dom.hud.getBoundingClientRect().top - dom.stage.getBoundingClientRect().top
      : Infinity;
  }

  function render() {
    if (!dom || !shown) return;
    measureSize();
    const w = size.width;
    const h = size.height;
    dom.svg.setAttribute('width', w);
    dom.svg.setAttribute('height', h);
    dom.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    // On short stages the Earth layer needs room beneath the axis; the lanes above have slack, so lift the axis.
    const axisY = Math.round(h * (earthOn && h < 760 ? Math.min(AXIS_FRACTION, 0.52) : AXIS_FRACTION));
    lastAxisY = axisY;
    planReigns(shown, axisY);                           // decides rows and reserves their height before lanes are packed
    planLives(shown, axisY);
    const era = planEra(shown);
    if (era && reignReserve < ERA_RESERVE) reignReserve = ERA_RESERVE;
    renderTicks(shown, axisY);
    renderEvents(shown, axisY);
    if (livesRows.length || livesActive()) renderLives(shown); else renderReigns(shown);
    renderEarth(shown, axisY);
    renderNowMarker(shown, axisY);
    renderEra(era, axisY);
    renderLifeBand(shown, axisY);
    renderMeasure(shown, axisY);
    dom.cursorLine.setAttribute('y1', 0);
    dom.cursorLine.setAttribute('y2', h);
    if (lastMouseX !== null) updateCursor(lastMouseX);  // the date under a resting pointer changes with the view
    updateHud(shown);
    renderMinimap();
    updateOtdChip();
    updateScaleToggle();
    if (otdWanted(shown)) scheduleOtd();
    settleNext = false;
  }

  // --- Reign swimlanes: one row per office at the top of the stage ---
  function reignsActive() {
    return reignsOn && !livesOn && size.width >= REIGN_MIN_WIDTH;
  }

  // While either row layer is up, rulers stay out of the ordinary event lanes.
  function rowsActive() { return reignsActive() || livesActive(); }

  function livesActive() {
    return livesOn && size.width >= REIGN_MIN_WIDTH;
  }

  function planReigns(v, axisY) {
    reignRows = [];
    reignReserve = 0;
    if (!reignsActive() || v.end - v.start > REIGN_MAX_SPAN) return;
    const list = events();
    if (!groupOrder) {
      groupOrder = [];
      for (let i = 0; i < list.length; i++) if (list[i].group && groupOrder.indexOf(list[i].group) < 0) groupOrder.push(list[i].group);
    }
    const byGroup = new Map();
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (!ev.group || !passesFilters(ev, i)) continue;
      const tEnd = hasEnd(ev) ? ev.end : ev.t;
      if (tEnd < v.start || ev.t > v.end) continue;
      let g = byGroup.get(ev.group);
      if (!g) { g = { group: ev.group, items: [], weight: 0 }; byGroup.set(ev.group, g); }
      g.items.push(i);
      g.weight += 1 / (1 + ev.tier);                      // prominence decides who stays when rows run out
    }
    if (byGroup.size === 0) return;
    // Leave the event lanes at least four rows; swimlanes take what is left above them.
    const room = axisY - LANE_TOP_PAD - 4 * LANE_PITCH - REIGN_TOP;
    const maxRows = Math.min(REIGN_MAX_ROWS, Math.max(0, Math.floor(room / REIGN_ROW_H)));
    if (maxRows === 0) return;
    let chosen = Array.from(byGroup.values());
    if (chosen.length > maxRows) chosen = chosen.sort(function (a, b) { return b.weight - a.weight; }).slice(0, maxRows);
    chosen.sort(function (a, b) { return groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group); });
    reignRows = chosen;
    reignReserve = REIGN_TOP + chosen.length * REIGN_ROW_H + 8;
  }

  function renderReigns(v) {
    const g = dom.gReigns;
    if (!reignRows.length) { g.replaceChildren(); return; }
    const list = events();
    const w = size.width;
    const frag = document.createDocumentFragment();
    for (let r = 0; r < reignRows.length; r++) {
      const row = reignRows[r];
      const y = REIGN_TOP + r * REIGN_ROW_H;
      frag.appendChild(svgEl('line', { class: 'row-line', x1: 0, x2: w, y1: crisp(y + REIGN_ROW_H - 1), y2: crisp(y + REIGN_ROW_H - 1) }));
      const labelW = row.group.length * 6.6 + 26;         // keep names clear of the row label
      for (let k = 0; k < row.items.length; k++) {
        const i = row.items[k];
        const ev = list[i];
        const x0 = clamp(tToPx(ev.t, v), 0, w);
        const x1 = clamp(tToPx(hasEnd(ev) ? ev.end : ev.t, v), 0, w);
        const width = Math.max(2, x1 - x0);
        const seg = svgEl('g', {
          class: 'event reign cat-' + ev.category + (k % 2 ? ' alt' : '') + (i === selected ? ' selected' : ''),
          id: 'ev-' + i, 'data-index': i, tabindex: 0, role: 'button',
          'aria-label': ev.title + ', ' + eventDateLabel(ev)
        });
        seg.appendChild(svgEl('rect', { class: 'seg', x: x0, y: y + 1, width: width, height: REIGN_ROW_H - 3, rx: 2 }));
        // The row already says the office and country: "Henry II of France" -> "Henry II", "Kangxi Emperor" -> "Kangxi".
        const name = String(ev.title).split(',')[0].replace(/ of (France|England|Portugal|Spain|Russia|Prussia|Ethiopia|Japan|China|the United Kingdom)$/, '').replace(/^Emperor /, '').replace(/ Emperor$/, '').replace(/^Pope /, '');
        const lx = Math.max(x0, labelW) + 5;
        if (x0 + width - lx >= name.length * 5.9 + 4) {
          seg.appendChild(svgEl('text', { class: 'seg-label', x: lx, y: y + REIGN_ROW_H - 5 }, name));
        }
        frag.appendChild(seg);
      }
      frag.appendChild(svgEl('text', { class: 'row-label', x: 18, y: y + REIGN_ROW_H - 5 }, row.group));
    }
    g.replaceChildren(frag);
  }

  // --- Lives: the lifespans of notable people, packed into rows at the top of the stage. The most prominent
  // get a row first; whoever does not fit is left out, and the caption says how many. ---
  function planLives(v, axisY) {
    livesRows = [];
    livesStats = { shown: 0, inView: 0 };
    if (!livesActive() || v.end - v.start > LIVES_MAX_SPAN) return;
    const list = events();
    const w = size.width;
    const items = [];
    const idx = [];
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (!ev.life || ev.end < v.start || ev.t > v.end || !passesFilters(ev, i)) continue;
      const x0 = clamp(tToPx(ev.t, v), 0, w);
      const x1 = clamp(tToPx(ev.end, v), 0, w);
      items.push({ x0: x0, x1: Math.max(x1, x0 + 3), priority: i === selected ? -1 : ev.tier + (1 - Math.min(1, (ev.end - ev.t) / 125)) * 0.5 });
      idx.push(i);
    }
    livesStats.inView = items.length;
    if (!items.length) return;
    const room = axisY - LANE_TOP_PAD - 4 * LANE_PITCH - REIGN_TOP;
    const maxRows = Math.min(REIGN_MAX_ROWS, Math.max(0, Math.floor(room / REIGN_ROW_H)));
    if (maxRows === 0) return;
    const placed = HT.layout.packLanes(items, { gap: 3, maxLanes: maxRows }).placed;
    let rows = 0;
    for (let k = 0; k < placed.length; k++) {
      const lane = placed[k].lane;
      (livesRows[lane] || (livesRows[lane] = [])).push(idx[placed[k].index]);
      rows = Math.max(rows, lane + 1);
    }
    for (let r = 0; r < rows; r++) if (!livesRows[r]) livesRows[r] = [];
    livesStats.shown = placed.length;
    reignReserve = REIGN_TOP + rows * REIGN_ROW_H + 8;
  }

  function renderLives(v) {
    const g = dom.gReigns;
    const list = events();
    const w = size.width;
    const frag = document.createDocumentFragment();
    const tooWide = v.end - v.start > LIVES_MAX_SPAN;
    const caption = tooWide ? 'Lives \u00b7 zoom in to 3,000 years or less'
      : livesStats.inView ? 'Lives \u00b7 ' + livesStats.shown + ' of ' + livesStats.inView + ' alive in this view' : 'Lives \u00b7 nobody on record here';
    frag.appendChild(svgEl('text', { class: 'row-label lives-caption', x: 18, y: REIGN_TOP - 7 }, caption));
    for (let r = 0; r < livesRows.length; r++) {
      const y = REIGN_TOP + r * REIGN_ROW_H;
      const row = livesRows[r];
      for (let k = 0; k < row.length; k++) {
        const i = row[k];
        const ev = list[i];
        const x0 = clamp(tToPx(ev.t, v), 0, w);
        const x1 = clamp(tToPx(ev.end, v), 0, w);
        const width = Math.max(3, x1 - x0);
        const seg = svgEl('g', {
          class: 'event reign life cat-' + ev.category + (i === selected ? ' selected' : ''),
          id: 'ev-' + i, 'data-index': i, tabindex: 0, role: 'button',
          'aria-label': ev.title + ', ' + eventDateLabel(ev)
        });
        seg.appendChild(svgEl('rect', { class: 'seg', x: x0, y: y + 1, width: width, height: REIGN_ROW_H - 3, rx: 2 }));
        if (width >= ev.title.length * 5.9 + 10) seg.appendChild(svgEl('text', { class: 'seg-label', x: x0 + 5, y: y + REIGN_ROW_H - 5 }, ev.title));
        frag.appendChild(seg);
      }
    }
    g.replaceChildren(frag);
  }

  function setLives(on) {
    livesOn = !!on;
    if (livesOn) reignsOn = false;                        // one layer at a time up there
    try { root.localStorage.setItem(LIVES_KEY, livesOn ? '1' : '0'); if (livesOn) root.localStorage.setItem(REIGNS_KEY, '0'); } catch (err) { /* ignore */ }
    syncLayerButtons();
    if (dom && shown) { settleNext = true; render(); }
    if (dom) announce(function () { return livesOn ? 'Lives on. ' + livesStats.shown + ' of ' + livesStats.inView + ' people alive in this view are shown.' : 'Lives off.'; });
  }

  function syncLayerButtons() {
    if (!dom) return;
    if (dom.btnReigns) dom.btnReigns.setAttribute('aria-pressed', String(reignsOn));
    if (dom.btnLives) dom.btnLives.setAttribute('aria-pressed', String(livesOn));
  }

  function setReigns(on) {
    reignsOn = !!on;
    if (reignsOn && livesOn) { livesOn = false; try { root.localStorage.setItem(LIVES_KEY, '0'); } catch (err) { /* ignore */ } }
    try { root.localStorage.setItem(REIGNS_KEY, reignsOn ? '1' : '0'); } catch (err) { /* ignore */ }
    syncLayerButtons();
    if (dom && shown) { settleNext = true; render(); }
  }

  // --- Earth layer: climate sparklines beneath the axis ---
  function earthSeries() {
    const base = HT.earth && HT.earth.series ? HT.earth.series : null;
    if (!base) return null;
    if (!base.pop && HT.context && HT.context.pop) base.pop = HT.context.pop;   // world population rides with the climate series
    return base;
  }

  function earthMeta(key) {
    if (key === 'pop') return POP_META;
    return (HT.earth && HT.earth.meta && HT.earth.meta[key]) || { range: [0, 1] };
  }

  // The world's largest city at time t: [start, end, name, peak population] or null.
  function cityAt(t) {
    const segs = HT.context && HT.context.cities;
    if (!segs) return null;
    for (let i = 0; i < segs.length; i++) if (t >= segs[i][0] && t < segs[i][1]) return segs[i];
    const last = segs[segs.length - 1];
    return last && t >= last[1] && t <= nowT() ? last : null;   // the last city holds to today
  }

  function popFormat(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(1) + ' B';
    if (v >= 1e6) return Math.round(v / 1e6) + ' M';
    return Math.round(v / 1e3) + ' K';
  }

  // How long a series' last value is held past its final sample (ice cores stop before the present).
  const EARTH_HOLD = { co2: 3, temp: 150, sea: 120, pop: 5 };

  // Linear interpolation of a [t, v] series at t (null outside its range). Binary search.
  function seriesAt(arr, t, hold) {
    if (!arr || arr.length === 0 || t < arr[0][0]) return null;
    const last = arr[arr.length - 1];
    if (t > last[0]) return t - last[0] <= (hold || 0) ? last[1] : null;
    let lo = 0;
    let hi = arr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid][0] <= t) lo = mid; else hi = mid;
    }
    const a = arr[lo];
    const b = arr[hi];
    if (b[0] === a[0]) return a[1];
    return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]);
  }

  // Index of the first sample with t >= x (binary search; arr.length if none).
  function firstIndexAtOrAfter(arr, x) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid][0] < x) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function earthFormat(key, v) {
    if (v === null) return '—';
    if (key === 'pop') return popFormat(v);
    if (key === 'co2') return Math.round(v) + ' ppm';
    if (key === 'temp') return (v > 0 ? '+' : '') + v.toFixed(1) + '°';
    return (v > 0 ? '+' : '') + Math.round(v) + ' m';
  }

  function earthReadout(t) {
    const series = earthSeries();
    if (!series) return '—';
    return EARTH_ORDER.map(function (k) { return earthFormat(k, seriesAt(series[k], t, EARTH_HOLD[k])); }).join(' · ');
  }

  function renderEarth(v, axisY) {
    const series = earthSeries();
    const g = dom.gEarth;
    if (!series || !earthOn) { g.replaceChildren(); return; }
    const w = size.width;
    const h = size.height;
    const top = axisY + 46;                              // below the tick labels
    let floor = h - 108;                                 // above the HUD and dock
    if (size.hudTop > top) floor = Math.min(floor, size.hudTop - 10);
    // The city ribbon is dropped before the sparklines are: it needs CITY_H + 12 px under the band.
    const hasCities = !!(HT.context && HT.context.cities) && v.end - v.start <= CITY_MAX_SPAN && floor - top - (CITY_H + 12) >= 56;
    const bottom = Math.min(floor - (hasCities ? CITY_H + 12 : 0), top + 150);
    if (bottom - top < 40) { g.replaceChildren(); return; }
    const frag = document.createDocumentFragment();
    const step = Math.max(1, Math.floor(w / 700));       // px per sample when the view is dense
    for (let s = 0; s < EARTH_ORDER.length; s++) {
      const key = EARTH_ORDER[s];
      const arr = series[key];
      if (!arr || arr.length < 2) continue;
      const km = earthMeta(key);
      const range = km.range || [0, 1];
      const y = function (val) {
        const u = km.log ? Math.log10(Math.max(1, val)) : val;
        return bottom - clamp((u - range[0]) / (range[1] - range[0]), 0, 1) * (bottom - top);
      };
      // Points: interpolated value at each view edge plus every sample inside the view. When samples are
      // sparser than pixels we draw them all; when denser, we thin to one per `step` px.
      const pts = [];
      const tEnd = capNow(v.end);                          // the band stops at the Today line
      const xEnd = Math.min(w, tToPx(tEnd, v));
      const v0 = seriesAt(arr, v.start, EARTH_HOLD[key]);
      if (v0 !== null) pts.push([0, y(v0)]);
      let lastPx = -Infinity;
      for (let i = firstIndexAtOrAfter(arr, v.start); i < arr.length; i++) {
        const t = arr[i][0];
        if (t > tEnd) break;
        const px = tToPx(t, v);
        if (px - lastPx < step) continue;
        lastPx = px;
        pts.push([px, y(arr[i][1])]);
      }
      const v1 = seriesAt(arr, tEnd, EARTH_HOLD[key]);
      if (v1 !== null) pts.push([xEnd, y(v1)]);
      if (pts.length < 2) continue;
      const d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      if (key === 'co2') {
        frag.appendChild(svgEl('path', { class: 'earth-fill co2', d: d + ' L' + xEnd.toFixed(1) + ' ' + bottom + ' L0 ' + bottom + ' Z' }));
      }
      frag.appendChild(svgEl('path', { class: 'earth-line ' + key, d: d }));
      // Stacked legend at the band's top-left: series name and the value at the view's end.
      const label = svgEl('text', { class: 'earth-label ' + key, x: 10, y: top + 12 + s * 13, 'text-anchor': 'start' });
      const k = svgEl('tspan', { class: 'k' }, (km.label ? km.label : key) + ' ');
      const val = svgEl('tspan', { class: 'v' }, earthFormat(key, v1 !== null ? v1 : (pts.length ? null : null)));
      label.appendChild(k);
      label.appendChild(val);
      frag.appendChild(label);
    }
    frag.appendChild(svgEl('line', { class: 'earth-base', x1: 0, x2: w, y1: crisp(bottom), y2: crisp(bottom) }));
    // Largest-city ribbon beneath the band: one segment per reigning city, named where it fits.
    if (hasCities) {
      const segs = HT.context.cities;
      const ry = bottom + 8;
      let any = false;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const segEnd = i === segs.length - 1 ? nowT() : seg[1];        // the last city holds to today, never past it
        if (segEnd < v.start || seg[0] > v.end) continue;
        const x0 = clamp(tToPx(seg[0], v), 0, w);
        const x1 = clamp(tToPx(segEnd, v), 0, w);
        if (x1 - x0 < 1) continue;
        any = true;
        frag.appendChild(svgEl('rect', { class: 'city-seg' + (i % 2 ? ' alt' : ''), x: x0, y: ry, width: x1 - x0, height: CITY_H }));
        const name = seg[2];
        if (x1 - x0 >= name.length * 6.6 + 12) {
          frag.appendChild(svgEl('text', { class: 'city-label', x: (x0 + x1) / 2, y: ry + 11, 'text-anchor': 'middle' }, name));
        }
      }
      if (any) frag.appendChild(svgEl('text', { class: 'city-key', x: 10, y: ry - 3, 'text-anchor': 'start' }, 'Largest city'));
    }
    g.replaceChildren(frag);
  }

  function setEarth(on) {
    earthOn = !!on;
    try { root.localStorage.setItem(EARTH_KEY, earthOn ? '1' : '0'); } catch (err) { /* ignore */ }
    if (dom && dom.btnEarth) dom.btnEarth.setAttribute('aria-pressed', String(earthOn));
    if (dom && shown) render();
  }

  // Today's position on the axis, drawn when it is in view (the HUD beacon lights up with it).
  function renderNowMarker(v, axisY) {
    const now = nowT();
    const inView = now >= v.start && now <= v.end;
    if (!inView) { dom.gNow.replaceChildren(); return; }
    const x = crisp(tToPx(now, v));
    const w = size.width;
    const parts = [];
    if (w - x > 1) parts.push(svgEl('rect', { class: 'future-zone', x: x, y: 0, width: w - x, height: size.height }));
    parts.push(svgEl('line', { class: 'now-line', x1: x, x2: x, y1: 0, y2: size.height }));
    parts.push(svgEl('line', { class: 'now-marker', x1: x, x2: x, y1: axisY - 14, y2: axisY + 14 }));
    parts.push(svgEl('circle', { class: 'now-dot', cx: x, cy: axisY, r: 3.5, fill: 'var(--accent)' }));
    // The flag sits left of the line unless there is no room for it there.
    // The flag reads up the line, in the empty strip past it when there is one.
    const roomy = w - x >= 14;
    const lx = roomy ? x + 11 : x - 5;
    const ly = roomy ? axisY - 22 : Math.min(axisY - 22, ERA_RESERVE + 66);   // on a phone, up above the lanes
    parts.push(svgEl('text', { class: 'now-label', x: lx, y: ly, transform: 'rotate(-90 ' + lx + ' ' + ly + ')', 'text-anchor': 'start' }, 'Today'));
    dom.gNow.replaceChildren.apply(dom.gNow, parts);
  }

  // --- Recorded-history bracket: on wide views everything since writing is a sliver at the right edge, so
  // name it and make it a one-click jump. Shown on spans too wide for swimlanes while the sliver is at least 6 px. ---
  function planEra(v) {
    const now = nowT();
    if (now > v.end || RECORDED_START < v.start) return null;
    const x0 = tToPx(RECORDED_START, v);
    const x1 = tToPx(now, v);
    if (x1 - x0 < 6 || v.end - v.start <= REIGN_MAX_SPAN) return null;    // closer in, the swimlanes take over the top
    return { x0: x0, x1: x1 };
  }

  function renderEra(era, axisY) {
    if (!era) { if (dom.gEra.firstChild) dom.gEra.replaceChildren(); dom.gEra.dataset.key = ''; return; }
    const x0 = crisp(era.x0);
    const x1 = crisp(era.x1);
    const key = x0 + '|' + x1 + '|' + axisY;             // unchanged geometry: keep the node, and its focus
    if (dom.gEra.dataset.key === key) return;
    dom.gEra.dataset.key = key;
    const y = ERA_TOP + 0.5;
    const years = Math.round((nowT() - RECORDED_START) / 100) * 100;
    const long = 'Recorded history \u00b7 last ' + years.toLocaleString('en-US') + ' years \u00b7 zoom \u25b8';
    const text = x0 - 12 >= long.length * 8.2 ? long : 'Recorded history \u25b8';
    const labelW = text.length * 8.2;
    const g = svgEl('g', {
      class: 'era-jump', tabindex: 0, role: 'button',
      'aria-label': 'Zoom to recorded history, the last ' + years.toLocaleString('en-US') + ' years'
    });
    g.appendChild(svgEl('rect', { class: 'era-zone', x: x0, y: y, width: Math.max(1, x1 - x0), height: Math.max(1, axisY - y) }));
    g.appendChild(svgEl('line', { class: 'era-guide', x1: x0, x2: x0, y1: y, y2: axisY }));
    g.appendChild(svgEl('path', { class: 'era-bracket', d: 'M' + x0 + ' ' + (y + 7) + ' V' + y + ' H' + x1 + ' V' + (y + 7) }));
    g.appendChild(svgEl('text', { class: 'era-label', x: x0 - 9, y: y + 4, 'text-anchor': 'end' }, text));
    g.appendChild(svgEl('rect', { class: 'era-hit', x: x0 - 14 - labelW, y: y - 13, width: x1 - x0 + 18 + labelW, height: 26, rx: 3 }));
    dom.gEra.replaceChildren(g);
  }

  function zoomToRecorded() {
    const start = RECORDED_START - 200;
    commit({ start: start, end: endAtNow(start) }, { animate: true, url: 'push', stack: 'push', discrete: true });
  }

  // --- HUD telemetry ---
  function fmtSpan(years) {
    if (years >= 1) return Math.round(years).toLocaleString('en-US') + ' Y';
    const days = years * 365.25;
    if (days >= 1) return (days >= 10 ? Math.round(days) : days.toFixed(1)) + ' D';
    return Math.max(1, Math.round(days * 24)) + ' H';
  }

  function updateHud(v) {
    if (!dom || !dom.hudSpan) return;
    const span = v.end - v.start;
    dom.hudSpan.textContent = fmtSpan(capNow(v.end) - v.start);
    dom.hudEvents.textContent = hudStats.visible + ' / ' + hudStats.inWindow;
    dom.hudTier.textContent = '\u2264 ' + hudStats.tier;
    dom.hudScale.textContent = warped(v) > 0 ? 'Logarithmic' : '1 px = ' + fmtSpan(span / Math.max(1, size.width));
    const now = nowT();
    dom.hudNow.hidden = !(now >= v.start && now <= v.end);
    const tRead = capNow(lastMouseX !== null ? pxToT(lastMouseX - svgLeft(), v) : v.end);
    if (dom.hudEarth) dom.hudEarth.textContent = earthReadout(tRead);
    updateCityReadout(tRead);
  }

  function updateCityReadout(t) {
    if (!dom.hudCity) return;
    const c = cityAt(t);
    dom.hudCity.textContent = c ? c[2] + ' · ' + popFormat(c[3]) : '\u2014';
  }

  function tickClock() {
    if (!dom || !dom.hudClock) return;
    const d = new Date();
    const p = function (n) { return (n < 10 ? '0' : '') + n; };
    dom.hudClock.textContent = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  // --- Themes (sensor modes) ---
  function resolveTheme(name) {
    if (name !== 'auto') return name;
    const light = typeof root.matchMedia === 'function' && root.matchMedia('(prefers-color-scheme: light)').matches;
    return light ? 'paper' : 'ops';
  }

  function applyTheme() {
    if (typeof document === 'undefined') return;
    const t = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', t);
    if (dom && dom.dock) {
      const bs = dom.dock.querySelectorAll('button[data-theme]');
      for (let i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(bs[i].dataset.theme === t));
    }
    if (dom && dom.hudMode) dom.hudMode.textContent = t.toUpperCase();
  }

  function setTheme(name, opts) {
    if (name !== 'auto' && THEMES.indexOf(name) < 0) return;
    theme = name;
    try {
      if (name === 'auto') root.localStorage.removeItem(THEME_KEY);
      else root.localStorage.setItem(THEME_KEY, name);
    } catch (err) { /* storage may be unavailable */ }
    applyTheme();
    if (dom && view && !(opts && opts.silent)) writeUrl('replace');
  }

  function getTheme() { return theme; }

  // --- Axis and ticks ---
  function renderTicks(v, axisY) {
    const w = size.width;
    const minor = document.createDocumentFragment();
    const major = document.createDocumentFragment();
    const labels = document.createDocumentFragment();
    if (HT.ticks && typeof HT.ticks.computeTicks === 'function') {
      // A mostly warped view gets round ages and years placed by the warp; anything else the usual ladder.
      const ticks = warped(v) >= 0.5 ? C.logTicks(v, nowT(), w, scaleMode, measureTickLabel)
        : HT.ticks.computeTicks(v.start, v.end, w, { labelWidth: measureTickLabel });
      const labelGap = (HT.ticks.DEFAULTS && HT.ticks.DEFAULTS.labelGap) || 12;
      let prevRight = -Infinity;                        // right edge of the last label actually drawn
      const tMax = nowT() + 1e-9;                       // nothing is ticked past today
      for (let i = 0; i < ticks.minor.length; i++) {
        if (ticks.minor[i] > tMax) continue;
        const x = crisp(tToPx(ticks.minor[i], v));
        minor.appendChild(svgEl('line', { class: 'tick minor', x1: x, x2: x, y1: axisY, y2: axisY + 6 }));
      }
      for (let i = 0; i < ticks.major.length; i++) {
        const m = ticks.major[i];
        if (m.t > tMax) continue;
        const x = crisp(tToPx(m.t, v));
        major.appendChild(svgEl('line', { class: 'tick major', x1: x, x2: x, y1: axisY - 8, y2: axisY + 12 }));
        if (m.labeled) {
          const half = measureTickLabel(m.label) / 2;
          // Edge labels are nudged inside the view. That can undo the centred-label thinning done
          // by computeTicks, so re-check against the previous drawn label and drop on collision.
          const lx = half * 2 + EDGE_PAD * 2 < w ? clamp(x, half + EDGE_PAD, w - half - EDGE_PAD) : x;
          if (lx - half < prevRight + labelGap) continue;
          prevRight = lx + half;
          labels.appendChild(svgEl('text', { class: 'tick-label', x: lx, y: axisY + 28, 'text-anchor': 'middle' }, m.label));
        }
      }
    }
    dom.gMinor.replaceChildren(minor);
    dom.gMajor.replaceChildren(major);
    dom.gLabels.replaceChildren(labels);
    dom.gAxis.replaceChildren(svgEl('line', { class: 'axis', x1: 0, x2: w, y1: crisp(axisY), y2: crisp(axisY) }));
  }

  // Base visibility comes from the tier table; when a window is sparse (deep prehistory, or a
  // narrow slice of an eventful era) lower tiers are admitted until MIN_VISIBLE events are in view
  // or the tiers run out. Lane packing still trims whatever does not fit.
  function effectiveTier(list, v, span) {
    return C.effectiveTier(list, v, HT.tiers.tierForSpan(span), HT.tiers.MAX_TIER, MIN_VISIBLE, function (ev, i) {
      return !ev.life && !(ev.otd && !otdShown(v)) && passesFilters(ev, i) && !(ev.group && rowsActive());
    });
  }

  // --- Events: markers on the axis, labels packed into lanes stacked upward ---
  function renderEvents(v, axisY) {
    const w = size.width;
    const span = v.end - v.start;
    const list = events();
    const colors = (HT.tiers && HT.tiers.COLORS) || {};
    const maxLanes = clamp(Math.floor((axisY - LANE_TOP_PAD - reignReserve) / LANE_PITCH), 1, MAX_LANES);
    const maxLabelW = Math.max(60, Math.min(320, w * 0.6));
    const items = [];
    const meta = [];
    const tierLimit = effectiveTier(list, v, span);
    let inWindow = 0;
    const showOtd = otdShown(v);
    otdInView = 0;

    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (ev.life) continue;                              // lifespans live in their own layer
      if (ev.otd && (!showOtd || ev.t < v.start || ev.t > v.end)) continue;       // cheap checks first: there can be thousands
      // The open event is always drawn: it bypasses the tier ceiling here and takes the first lane below.
      if ((ev.tier > tierLimit && i !== selected) || !passesFilters(ev, i) || (ev.group && rowsActive())) continue;
      const ranged = hasEnd(ev);
      const tEnd = ranged ? ev.end : ev.t;
      if (tEnd < v.start || ev.t > v.end) continue;
      inWindow++;
      if (ev.otd) otdInView++;

      const x = tToPx(ev.t, v);
      const xEnd = ranged ? tToPx(tEnd, v) : x;
      const bx0 = clamp(x, 0, w);                       // on-screen extent of the marker/bar
      const bx1 = clamp(xEnd, 0, w);
      // Label to the right of the marker (or of the bar's visible left end); flip to the left
      // when it would overflow and the left side has room (or more room than the right). Whichever
      // side is used, the label is truncated to the room actually available so it never leaves the stage.
      const rightX = ranged ? bx0 + 2 : x + MARKER_R + LABEL_GAP;
      const leftX = ranged ? bx1 - 2 : x - MARKER_R - LABEL_GAP;
      const roomR = w - EDGE_PAD - rightX;
      const roomL = leftX - EDGE_PAD;
      const fullW = measureEventLabel(ev.title);
      let anchor = 'start';
      let ax = rightX;
      let room = roomR;
      if (fullW > roomR && (roomL >= Math.min(fullW, maxLabelW) || roomL > roomR)) {
        anchor = 'end';
        ax = leftX;
        room = roomL;
      }
      const text = fitLabel(ev.title, Math.max(24, Math.min(maxLabelW, room)));
      const lw = measureEventLabel(text);
      const lx0 = anchor === 'start' ? ax : ax - lw;
      const lx1 = lx0 + lw;
      const stemX = ranged ? bx0 : x;
      items.push({ x0: Math.min(lx0, stemX - 2), x1: Math.max(lx1, stemX + 2), priority: i === selected ? -1 : ev.otd ? ev.tier + 1 : ev.tier });   // the open event first, then bundled before on-this-day
      meta.push({ index: i, ev: ev, ranged: ranged, x: x, bx0: bx0, bx1: bx1, text: text, ax: ax, anchor: anchor, stemX: stemX });
    }

    let placed;
    if (HT.layout && typeof HT.layout.packLanes === 'function') {
      placed = HT.layout.packLanes(items, { gap: 8, maxLanes: maxLanes }).placed;
    } else {
      placed = items.map(function (_, i) { return { index: i, lane: 0 }; });
    }
    // Higher lanes first so lower-lane labels paint over stems that pass through them.
    placed = placed.slice().sort(function (a, b) { return b.lane - a.lane || a.index - b.index; });

    const frag = document.createDocumentFragment();
    for (let k = 0; k < placed.length; k++) {
      const m = meta[placed[k].index];
      const ev = m.ev;
      const lane = placed[k].lane;
      const baseline = axisY - LANE_BASE_OFFSET - lane * LANE_PITCH;
      const color = ev.otd ? 'var(--accent)' : colors[ev.category] || 'currentColor';
      const g = svgEl('g', {
        class: 'event cat-' + ev.category + ' tier-' + ev.tier + (ev.otd ? ' otd' : '') + (m.ranged ? ' ranged' : ' point') +
               (m.index === selected ? ' selected' : '') + (settleNext ? ' arrive' : ''),
        id: 'ev-' + m.index,
        'data-index': m.index,
        tabindex: 0,
        role: 'button',
        'aria-label': ev.title + ', ' + eventDateLabel(ev)
      });
      // Invisible hit areas: a generous pad around the marker/bar and the label's box, so a tap
      // does not have to land on a 10px dot (a miss would zoom instead of opening the event).
      const lw = measureEventLabel(m.text);
      g.appendChild(svgEl('rect', {
        class: 'hit', x: (m.anchor === 'start' ? m.ax : m.ax - lw) - 4, y: baseline - 13, width: lw + 8, height: 18
      }));
      if (m.ranged) {
        g.appendChild(svgEl('rect', { class: 'hit', x: m.bx0, y: axisY - 12, width: Math.max(1, m.bx1 - m.bx0), height: 24 }));
      } else {
        g.appendChild(svgEl('circle', { class: 'hit', cx: m.x, cy: axisY, r: 14 }));
      }
      const stemTop = baseline + 3;
      const stemBottom = m.ranged ? axisY - BAR_H / 2 - 1 : axisY - MARKER_R - 1;
      if (stemBottom > stemTop && (!m.ranged || m.x >= 0)) {
        g.appendChild(svgEl('line', {
          class: 'stem', x1: crisp(m.stemX), x2: crisp(m.stemX), y1: stemTop, y2: stemBottom,
          stroke: color, 'stroke-opacity': 0.4
        }));
      }
      if (settleNext) g.style.setProperty('--i', String(k));
      if (m.ranged) {
        g.appendChild(svgEl('rect', {
          class: 'bar', x: m.bx0, y: axisY - BAR_H / 2, width: Math.max(1, m.bx1 - m.bx0), height: BAR_H, rx: 1.5, fill: color
        }));
      } else {
        if (ev.tier <= 1) g.appendChild(svgEl('circle', { class: 'pulse', cx: m.x, cy: axisY, r: MARKER_R, stroke: color }));
        g.appendChild(svgEl('circle', { class: 'marker', cx: m.x, cy: axisY, r: MARKER_R, fill: color }));
      }
      g.appendChild(svgEl('text', { class: 'label', x: m.ax, y: baseline, 'text-anchor': m.anchor }, m.text));
      frag.appendChild(g);
    }
    dom.gEvents.replaceChildren(frag);
    hudStats = { visible: placed.length, inWindow: inWindow, tier: tierLimit };
  }

  // --- Cursor guide line + header readout ---
  function updateCursor(clientX) {
    if (!dom || !shown) return;
    const px = clientX - svgLeft();
    if (px < 0 || px > size.width) { hideCursor(); return; }
    dom.cursorLine.setAttribute('x1', crisp(px));
    dom.cursorLine.setAttribute('x2', crisp(px));
    dom.cursorLine.setAttribute('visibility', 'visible');
    const tCur = capNow(pxToT(px, shown));              // past the Today line the readout stays on today
    const label = cursorLabel(tCur, shown.end - shown.start);
    dom.cursorDate.textContent = label;
    if (dom.hudEarth) dom.hudEarth.textContent = earthReadout(tCur);
    updateCityReadout(tCur);
    if (dom.cursorChip) {
      if (dom.cursorChip.textContent !== label) {     // measure only when the text changes (no layout per mousemove)
        dom.cursorChip.textContent = label;
        dom.cursorChip.hidden = false;
        chipHalf = dom.cursorChip.offsetWidth / 2 + 6;
      }
      dom.cursorChip.hidden = false;
      const half = chipHalf;
      dom.cursorChip.style.left = Math.round(clamp(px, half, size.width - half)) + 'px';
      dom.cursorChip.style.top = (lastAxisY + 40) + 'px';
    }
  }

  function hideCursor() {
    if (!dom) return;
    dom.cursorLine.setAttribute('visibility', 'hidden');
    if (dom.cursorChip) dom.cursorChip.hidden = true;
  }

  // --- Breadcrumbs ---
  function renderCrumbs() {
    if (!dom) return;
    const frag = document.createDocumentFragment();
    const last = stack.length - 1;
    for (let i = 0; i < stack.length; i++) {
      const e = stack[i];
      const b = htmlEl('button', 'crumb' + (i === last ? ' current' : ''),
        i === 0 ? ROOT_CRUMB : HT.time.formatRange(e.start, capNow(e.end)));
      b.type = 'button';
      b.dataset.index = String(i);
      if (i === last) b.setAttribute('aria-current', 'page');
      frag.appendChild(b);
    }
    dom.crumbs.replaceChildren(frag);
    dom.crumbs.scrollLeft = dom.crumbs.scrollWidth;     // keep the current crumb in view when the chain is long
    dom.btnOut.disabled = stack.length <= 1 && isRoot(view);
  }

  function onCrumbClick(e) {
    const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.crumb') : null;
    if (!b) return;
    const i = Number(b.dataset.index);
    if (!(i >= 0) || i >= stack.length - 1) return;
    stack.length = i + 1;
    commit(stack[i], { animate: true, url: 'push', stack: 'keep' });
  }

  // --- Legend ---
  function renderLegend() {
    const cats = (HT.tiers && HT.tiers.CATEGORIES) || [];
    const colors = (HT.tiers && HT.tiers.COLORS) || {};
    const frag = document.createDocumentFragment();
    const actions = htmlEl('div', 'legend-actions');
    const all = htmlEl('button', '', 'All'); all.type = 'button'; all.dataset.act = 'all';
    const none = htmlEl('button', '', 'None'); none.type = 'button'; none.dataset.act = 'none';
    actions.appendChild(all); actions.appendChild(none);
    frag.appendChild(actions);
    for (let i = 0; i < cats.length; i++) {
      const item = htmlEl('button', 'legend-item');
      item.type = 'button';
      item.dataset.cat = cats[i];
      item.setAttribute('aria-pressed', String(!hiddenCats.has(cats[i])));
      item.title = 'Show or hide ' + cats[i] + ' events';
      const swatch = document.createElement('i');
      swatch.style.background = colors[cats[i]] || 'currentColor';
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(cats[i]));
      frag.appendChild(item);
    }
    // Region filter: chips plus a small map; clicking the map picks the region under the pointer.
    const reg = htmlEl('div', 'legend-regions');
    reg.appendChild(htmlEl('h3', '', 'Region'));
    const chips = htmlEl('div', 'region-chips');
    const mk = function (key, label) {
      const b = htmlEl('button', '', label); b.type = 'button'; b.dataset.region = key;
      b.setAttribute('aria-pressed', String((regionFilter || '') === key));
      return b;
    };
    chips.appendChild(mk('', 'Everywhere'));
    for (let i = 0; i < REGIONS.length; i++) chips.appendChild(mk(REGIONS[i][0], REGIONS[i][1]));
    reg.appendChild(chips);
    if (HT.map) {
      const W = HT.map.width; const H = HT.map.height;
      const svg = svgEl('svg', { id: 'region-map', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'World map: click a region to filter' });
      svg.appendChild(svgEl('path', { class: 'land', d: HT.map.land }));
      const boxes = regionFilter ? REGION_BOXES[regionFilter] : [];
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        svg.appendChild(svgEl('rect', { class: 'region-box', x: (b[2] + 180) * W / 360, y: (90 - b[1]) * H / 180, width: (b[3] - b[2]) * W / 360, height: (b[1] - b[0]) * H / 180 }));
      }
      reg.appendChild(svg);
    }
    reg.appendChild(htmlEl('div', 'region-note', 'Regions are coarse boxes. With a region chosen, only events with a known location there are shown.'));
    frag.appendChild(reg);
    dom.legend.replaceChildren(frag);
    dom.btnLegend.classList.toggle('filtered', hiddenCats.size > 0 || regionFilter !== null);
    if (dom.btnLayers) dom.btnLayers.classList.toggle('filtered', hiddenCats.size > 0 || regionFilter !== null);   // the dot survives the fold
  }

  // --- Category filters (legend buttons) ---
  function saveHidden() {
    try { root.localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(hiddenCats))); } catch (err) { /* ignore */ }
  }

  function setCategoryHidden(cat, hidden) {
    if (hidden) hiddenCats.add(cat); else hiddenCats.delete(cat);
    saveHidden();
    renderLegend();
    if (shown) { settleNext = true; render(); }
  }

  function onLegendClick(e) {
    const mapEl = e.target && typeof e.target.closest === 'function' ? e.target.closest('#region-map') : null;
    if (mapEl && HT.map) {
      const r = mapEl.getBoundingClientRect();
      const lon = (e.clientX - r.left) / r.width * 360 - 180;
      const lat = 90 - (e.clientY - r.top) / r.height * 180;
      const key = regionOf(lat, lon);
      if (key) setRegion(regionFilter === key ? null : key);
      return;
    }
    const t = e.target && typeof e.target.closest === 'function' ? e.target.closest('button') : null;
    if (!t) return;
    if (t.dataset.region !== undefined) { setRegion(t.dataset.region || null); return; }
    const cats = (HT.tiers && HT.tiers.CATEGORIES) || [];
    if (t.dataset.act === 'all') hiddenCats.clear();
    else if (t.dataset.act === 'none') cats.forEach(function (c) { hiddenCats.add(c); });
    else if (t.dataset.cat) {
      if (e.shiftKey) {                                   // shift-click: show only this category
        hiddenCats.clear();
        cats.forEach(function (c) { if (c !== t.dataset.cat) hiddenCats.add(c); });
      } else if (hiddenCats.has(t.dataset.cat)) hiddenCats.delete(t.dataset.cat);
      else hiddenCats.add(t.dataset.cat);
    } else return;
    saveHidden();
    renderLegend();
    if (shown) { settleNext = true; render(); }
  }

  // --- Search ---
  function buildSearchIndex() {
    const list = events();
    searchIndex = new Array(list.length);
    for (let i = 0; i < list.length; i++) searchIndex[i] = String(list[i].title || '').toLowerCase();
  }

  // Prefix matches first, then word-start matches, then substrings; ties go to the more significant tier.
  function searchEvents(query) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    if (!searchIndex) buildSearchIndex();
    const list = events();
    const hits = [];
    for (let i = 0; i < searchIndex.length; i++) {
      const pos = searchIndex[i].indexOf(q);
      if (pos < 0) continue;
      const rank = pos === 0 ? 0 : /[\s(\-:,]/.test(searchIndex[i].charAt(pos - 1)) ? 1 : 2;
      hits.push({ i: i, rank: rank, tier: list[i].tier });
    }
    hits.sort(function (a, b) { return a.rank - b.rank || a.tier - b.tier || a.i - b.i; });
    return hits.slice(0, SEARCH_LIMIT);
  }

  function renderSearchResults() {
    const list = events();
    const frag = document.createDocumentFragment();
    if (searchHits.length === 0 && dom.searchInput.value.trim().length >= 2) {
      frag.appendChild(htmlEl('li', 'sr-empty', 'No events match.'));
    }
    for (let k = 0; k < searchHits.length; k++) {
      const ev = list[searchHits[k].i];
      const li = htmlEl('li', 'cat-' + ev.category);
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(k === searchActive));
      li.dataset.k = String(k);
      li.appendChild(document.createElement('i'));
      li.appendChild(htmlEl('span', 'sr-title', ev.title));
      li.appendChild(htmlEl('span', 'sr-date', eventDateLabel(ev)));
      frag.appendChild(li);
    }
    dom.searchResults.replaceChildren(frag);
  }

  function toggleSearch(force) {
    const open = force === undefined ? dom.search.hidden : !!force;
    const was = !dom.search.hidden;
    if (open && !was) rememberFocus('search');
    dom.search.hidden = !open;
    if (!open && was) restoreFocus('search', dom.btnSearch);
    dom.btnSearch.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!dom.legend.hidden) toggleLegend(false);
      dom.searchInput.value = '';
      searchHits = []; searchActive = -1;
      renderSearchResults();
      try { dom.searchInput.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    }
  }

  // Lift whatever filter would hide this event, so a search hit or a shared link is never invisible.
  function revealEvent(i) {
    const ev = events()[i];
    if (!ev) return;
    if (ev.life && !livesOn) setLives(true);            // a person is only ever drawn in the Lives layer
    if (hiddenCats.has(ev.category)) { hiddenCats.delete(ev.category); saveHidden(); renderLegend(); if (shown) { settleNext = true; render(); } }
    if (regionFilter !== null && eventRegion(i) !== regionFilter) setRegion(null);
  }

  function chooseSearchHit(k) {
    const hit = searchHits[k];
    if (!hit) return;
    const ev = events()[hit.i];
    toggleSearch(false);
    revealEvent(hit.i);
    zoomToEvent(ev);
    openPanel(hit.i);
  }

  function onSearchInput() {
    searchHits = searchEvents(dom.searchInput.value);
    searchActive = searchHits.length ? 0 : -1;
    renderSearchResults();
  }

  function onSearchKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!searchHits.length) return;
      searchActive = (searchActive + (e.key === 'ArrowDown' ? 1 : -1) + searchHits.length) % searchHits.length;
      renderSearchResults();
      const el = dom.searchResults.querySelector('[aria-selected="true"]');
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
      e.preventDefault();
    } else if (e.key === 'Enter') {
      chooseSearchHit(searchActive >= 0 ? searchActive : 0);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      toggleSearch(false);
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // --- Opt-in Wikimedia image (the only network access the page ever makes, and only when switched on) ---
  function loadImageCache() {
    if (imageCache) return imageCache;
    imageCache = {};
    try { const raw = JSON.parse(root.localStorage.getItem(IMAGE_CACHE_KEY) || '{}'); if (raw && typeof raw === 'object') imageCache = raw; } catch (err) { /* ignore */ }
    try { root.localStorage.removeItem('ht-image-cache'); } catch (err) { /* the pre-summary cache, no longer read */ }
    return imageCache;
  }

  function saveImageCache() {
    try {
      const keys = Object.keys(imageCache);
      if (keys.length > IMAGE_CACHE_MAX) keys.slice(0, keys.length - IMAGE_CACHE_MAX).forEach(function (k) { delete imageCache[k]; });
      root.localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(imageCache));
    } catch (err) { /* storage full or unavailable */ }
  }

  function stripTags(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // One summary request per opened event gives both the thumbnail and a paragraph of text. The result is
  // { x?: extract, src?, page?, credit? } or 0 when the article offers neither.
  async function fetchEventSummary(title) {
    const res = await root.fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title), {
      headers: { 'Api-User-Agent': API_UA }, credentials: 'omit', referrerPolicy: 'no-referrer'
    });
    if (!res.ok) return 0;
    const sum = await res.json();
    const extract = sum && sum.type !== 'disambiguation' && typeof sum.extract === 'string' ? sum.extract.trim().slice(0, 900) : '';
    const thumb = sum && sum.thumbnail && sum.thumbnail.source;
    const orig = sum && sum.originalimage && sum.originalimage.source;
    // Only freely licensed files live on Commons; images under /wikipedia/en/ are fair-use and are not shown.
    // The file name sits after the two hash directories; "originalimage" may itself be a thumb URL with a query.
    const m = /\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^\/?#]+)/.exec(orig || '');
    if (!thumb || !m) return extract ? { x: extract } : 0;
    let file = m[1];
    try { file = decodeURIComponent(file); } catch (err) { /* keep raw */ }
    const out = { x: extract, src: thumb, page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file), credit: 'Wikimedia Commons' };
    try {
      const meta = await root.fetch('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&origin=*&titles=' +
        encodeURIComponent('File:' + file), { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (meta.ok) {
        const pages = ((await meta.json()).query || {}).pages || {};
        const info = pages[Object.keys(pages)[0]];
        const em = info && info.imageinfo && info.imageinfo[0] && info.imageinfo[0].extmetadata;
        if (em) {
          const artist = stripTags(em.Artist && em.Artist.value).slice(0, 60);
          const lic = stripTags(em.LicenseShortName && em.LicenseShortName.value).slice(0, 30);
          out.credit = [artist, lic].filter(Boolean).join(' · ') + ' · Wikimedia Commons';
        }
      }
    } catch (err) { /* keep the generic credit */ }
    return out;
  }

  function showPanelImage(img, ev) {
    if (!img || !img.src) { dom.panelImage.hidden = true; dom.panelImg.removeAttribute('src'); return; }
    dom.panelImg.src = img.src;
    dom.panelImg.alt = ev.title;
    dom.panelImgLink.href = img.page;
    dom.panelImgCredit.textContent = img.credit;
    dom.panelImage.hidden = false;
  }

  // The article's opening paragraph, shown only when it says more than the event's own detail does.
  function showPanelExtract(rec, ev) {
    if (!dom.panelExtract) return;
    const text = C.trimExtract(rec && typeof rec.x === 'string' ? rec.x : '');
    if (!text || text.length < 80 || typeof ev.link !== 'string') { dom.panelExtract.hidden = true; dom.panelExtractText.textContent = ''; return; }
    dom.panelExtractText.textContent = text;
    dom.panelExtractSrc.href = ev.link;
    dom.panelExtract.hidden = false;
  }

  function updatePanelImage(ev) {
    if (!dom.panelImage) return;
    const seq = ++imageSeq;
    showPanelImage(null, ev);
    showPanelExtract(null, ev);
    if (!imagesOn || typeof root.fetch !== 'function' || typeof ev.link !== 'string' || ev.link.indexOf(WIKI_PREFIX) !== 0) return;
    let title = ev.link.slice(WIKI_PREFIX.length);
    try { title = decodeURIComponent(title); } catch (err) { /* keep raw */ }
    const cache = loadImageCache();
    if (Object.prototype.hasOwnProperty.call(cache, title)) { showPanelImage(cache[title] || null, ev); showPanelExtract(cache[title] || null, ev); return; }
    fetchEventSummary(title).then(function (rec) {
      cache[title] = rec || 0;
      saveImageCache();
      if (seq === imageSeq && imagesOn) { showPanelImage(rec || null, ev); showPanelExtract(rec || null, ev); }
    }).catch(function () { /* offline or blocked: the panel simply has no image */ });
  }

  // --- Museum object: a text link always (no network); its image only with the opt-in ---
  function updatePanelObject(ev) {
    if (!dom.panelObject) return;
    const found = HT.objects && HT.objects[ev.title];
    const isHttps = function (u) { return typeof u === 'string' && /^https:\/\//.test(u); };
    const obj = found && isHttps(found.url) ? found : null;   // same rule as the Read more link: https only
    if (!obj) { dom.panelObject.hidden = true; dom.panelObjectImg.removeAttribute('src'); return; }
    dom.panelObjectLink.textContent = obj.title + (obj.maker ? ', ' + obj.maker : '') + (obj.date ? ' (' + obj.date + ')' : '') + ' \u2197';
    dom.panelObjectLink.href = obj.url;
    dom.panelObjectCredit.textContent = obj.credit;
    if (imagesOn && isHttps(obj.img)) {
      dom.panelObjectImg.src = obj.img;
      dom.panelObjectImg.alt = obj.title;
      dom.panelObjectImgLink.href = obj.url;
      dom.panelObjectImgLink.hidden = false;
    } else {
      dom.panelObjectImg.removeAttribute('src');
      dom.panelObjectImgLink.hidden = true;
    }
    dom.panelObject.hidden = false;
  }

  function setImages(on) {
    imagesOn = !!on;
    try { root.localStorage.setItem(IMAGES_KEY, imagesOn ? '1' : '0'); } catch (err) { /* ignore */ }
    if (dom && dom.optImages) dom.optImages.checked = imagesOn;
    if (dom && !dom.panel.hidden && selected >= 0) { updatePanelImage(events()[selected]); updatePanelObject(events()[selected]); }
    if (dom && shown) render();                          // on-this-day events appear or leave with the switch
  }

  // --- On this day (opt-in): on a view of about a month or less, Wikipedia's per-day lists fill in what the
  // bundled data cannot. Entries become ordinary point events flagged `otd`; they live in memory and in a small
  // localStorage cache, never in the bundle, and are drawn only on those deep views while the opt-in is on. ---
  function otdShown(v) { return imagesOn && v.end - v.start <= OTD_MAX_SPAN; }
  function otdWanted(v) { return otdShown(v) && typeof root.fetch === 'function' && capNow(v.end) >= 1; }

  function otdDaysInView(v) { return C.otdDays(v.start, v.end, nowT()); }

  function loadOtdCache() {
    try {
      const raw = JSON.parse(root.localStorage.getItem(OTD_CACHE_KEY) || 'null');
      if (raw && raw.v === 1 && raw.days && typeof raw.days === 'object') return raw;
    } catch (err) { /* ignore */ }
    return { v: 1, days: {} };
  }

  function saveOtdDay(key, rows) {
    try {
      const cache = loadOtdCache();
      cache.days[key] = { at: Date.now(), ev: rows };
      const keys = Object.keys(cache.days).sort(function (x, y) { return cache.days[x].at - cache.days[y].at; });
      while (keys.length > OTD_CACHE_DAYS) delete cache.days[keys.shift()];
      root.localStorage.setItem(OTD_CACHE_KEY, JSON.stringify(cache));
    } catch (err) { /* storage full or unavailable: the day is simply fetched again next time */ }
  }

  function otdKnown(titles, t) {
    if (!otdLinkIndex) {
      otdLinkIndex = new Map();
      const list = events();
      for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        if (ev.otd || typeof ev.link !== 'string' || ev.link.indexOf(WIKI_PREFIX) !== 0) continue;
        let key = ev.link.slice(WIKI_PREFIX.length);
        try { key = decodeURIComponent(key); } catch (err) { /* keep raw */ }
        if (!otdLinkIndex.has(key)) otdLinkIndex.set(key, []);
        otdLinkIndex.get(key).push(ev.t);
      }
    }
    for (let i = 0; i < titles.length; i++) {
      const ts = otdLinkIndex.get(titles[i]);
      if (ts) for (let k = 0; k < ts.length; k++) if (Math.abs(ts[k] - t) < 3 / 365) return true;
    }
    return false;
  }

  function ingestOtdDay(key, rows) {
    const fresh = C.otdEvents(key, rows, nowT(), HT.tiers.MAX_TIER, otdKnown);
    const list = events();
    for (let i = 0; i < fresh.length; i++) list.push(fresh[i]);
    return fresh.length;
  }

  // A shared link can name an on-this-day event, which exists only once its day has been loaded.
  function openPendingSlug() {
    if (!pendingSlug) return;
    const i = indexForSlug(pendingSlug);
    if (i >= 0) { pendingSlug = ''; pendingEv = i; openPanel(i, { silent: true }); }
  }

  // Load one calendar day, from the local cache when it is there. Resolves to 'done' or 'error'; concurrent
  // callers for the same day share one request.
  function loadOtdDay(key) {
    if (otdDays.get(key) === 'done') return Promise.resolve('done');
    if (otdInflight.has(key)) return otdInflight.get(key);
    const cache = loadOtdCache();
    if (cache.days[key] && Array.isArray(cache.days[key].ev)) {
      ingestOtdDay(key, cache.days[key].ev);
      otdDays.set(key, 'done');
      return Promise.resolve('done');
    }
    if (typeof root.fetch !== 'function') return Promise.resolve('error');
    otdDays.set(key, 'loading');
    // A stalled request would hold its slot for good: give each day 25 s, then count it as failed.
    const ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    const timer = ctl ? setTimeout(function () { ctl.abort(); }, 25000) : 0;
    const p = root.fetch(OTD_ENDPOINT + key, { headers: { 'Api-User-Agent': API_UA }, credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined })
      .then(function (res) { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
      .then(function (json) {
        const rows = C.otdRows(json);
        saveOtdDay(key, rows);
        ingestOtdDay(key, rows);
        otdDays.set(key, 'done');
        return 'done';
      })
      .catch(function () { otdDays.set(key, 'error'); return 'error'; })
      .then(function (state) { if (timer) clearTimeout(timer); otdInflight.delete(key); return state; });
    otdInflight.set(key, p);
    return p;
  }

  function otdDayDone() {
    otdActive = Math.max(0, otdActive - 1);
    pumpOtd();
    if (otdRenderTimer) return;
    otdRenderTimer = setTimeout(function () {             // several days usually land together: draw once
      otdRenderTimer = 0;
      openPendingSlug();
      if (shown) { settleNext = false; render(); }
    }, 120);
  }

  function pumpOtd() {
    while (otdActive < OTD_PARALLEL && otdQueue.length) {
      const key = otdQueue.shift();
      const state = otdDays.get(key);
      if (state === 'done' || state === 'loading') continue;
      otdActive++;
      loadOtdDay(key).then(otdDayDone);
    }
  }

  // Debounced: wait for the view to rest, then load the days it touches (cache first, network for the rest).
  function scheduleOtd() {
    if (otdTimer) clearTimeout(otdTimer);
    otdTimer = setTimeout(function () {
      otdTimer = 0;
      if (!view || !otdWanted(view) || anim) return;
      const keys = otdDaysInView(view);
      const cache = loadOtdCache();
      let fromCache = 0;
      otdQueue = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const state = otdDays.get(key);
        if (state === 'done' || state === 'loading') continue;
        if (cache.days[key] && Array.isArray(cache.days[key].ev)) {
          ingestOtdDay(key, cache.days[key].ev);
          otdDays.set(key, 'done');
          fromCache++;
        } else {
          if (state === 'error') otdDays.delete(key);     // a new visit retries a day that failed
          otdQueue.push(key);
        }
      }
      pumpOtd();
      if (fromCache) openPendingSlug();
      if (fromCache && shown) render(); else updateOtdChip();
    }, 350);
  }

  // The chip under the header of the stage: an offer while the opt-in is off, progress and a count while it is on.
  function updateOtdChip() {
    if (!dom || !dom.otdChip || !shown) return;
    const deep = shown.end - shown.start <= OTD_MAX_SPAN && capNow(shown.end) >= 1;
    if (!deep || tour || (!imagesOn && !otdHint)) { dom.otdChip.hidden = true; return; }
    let text;
    let offer = false;
    if (!imagesOn) { text = 'Load day-by-day events from Wikipedia'; offer = true; }
    else {
      const keys = otdDaysInView(shown);
      let done = 0; let failed = 0;
      for (let i = 0; i < keys.length; i++) { const st = otdDays.get(keys[i]); if (st === 'done') done++; else if (st === 'error') failed++; }
      if (done + failed < keys.length) text = 'Loading days from Wikipedia … ' + done + '/' + keys.length;
      else if (failed === keys.length) text = 'Wikipedia could not be reached';
      else text = otdInView + (otdInView === 1 ? ' event' : ' events') + ' from Wikipedia’s “on this day”' + (regionFilter ? ' (none have a region)' : '');
    }
    if (dom.otdAction.textContent !== text) dom.otdAction.textContent = text;
    dom.otdAction.disabled = !offer;
    dom.otdDismiss.hidden = !offer;
    dom.otdChip.hidden = false;
  }

  // --- Panel: what happened around this event, and more of its kind ---
  const fmtGap = C.fmtGap;

  function fillEventList(ul, indices, ref) {
    const list = events();
    const items = indices.map(function (i) {
      const li = htmlEl('li');
      const b = htmlEl('button', 'panel-jump');
      b.type = 'button';
      b.dataset.index = String(i);
      b.appendChild(htmlEl('span', 'when', list[i].life ? HT.time.formatYear(list[i].t) + ' \u2013 ' + HT.time.formatYear(list[i].end) : fmtGap(list[i].t - ref.t)));
      b.appendChild(htmlEl('span', 'what', list[i].title));
      li.appendChild(b);
      return li;
    });
    ul.replaceChildren.apply(ul, items);
  }

  function updatePanelNearby(index) {
    if (!dom.panelNear) return;
    const list = events();
    const ev = list[index];
    const curatedCount = HT.curatedCount || 0;         // set by the build where the hand-written data files end
    const near = ev.life ? C.pickContemporaries(list, index, 5)
      : C.pickNearby(list, index, passesFilters, curatedCount ? function (o, i) { return i < curatedCount; } : null);
    dom.panelNear.hidden = near.length === 0;
    dom.panelNear.querySelector('h3').textContent = ev.life ? 'Alive at the same time' : ev.group ? 'Before and after in this office' : 'Around this time';
    fillEventList(dom.panelNearList, near, ev);

    // More of the same category, preferring the same part of the world.
    const related = C.pickRelated(list, index, near, eventRegion);
    const labels = { namerica: 'N. America', samerica: 'S. America' };
    const region = eventRegion(index);
    dom.panelRelated.hidden = related.length === 0;
    const cat = String(ev.category || '');
    dom.panelRelatedHead.textContent = 'More in ' + cat + (region ? ' \u00b7 near ' + (labels[region] || region.charAt(0).toUpperCase() + region.slice(1)) : '');
    fillEventList(dom.panelRelatedList, related, ev);
  }

  function jumpToEvent(i) {
    const ev = events()[i];
    if (!ev) return;
    revealEvent(i);
    const inView = !ev.life && shown && ev.t >= shown.start && ev.t <= shown.end && ev.tier <= hudStats.tier && !(ev.otd && !otdShown(shown));
    if (!inView) zoomToEvent(ev);
    openPanel(i);
  }

  // Static links out: nothing is requested until one is followed.
  function updatePanelMore(ev) {
    if (!dom.panelMore) return;
    const links = [];
    const add = function (label, url) { if (/^https:\/\//.test(url)) links.push([label, url]); };
    if (Array.isArray(ev.links)) ev.links.slice(0, 6).forEach(function (l) { add(l.title, l.url); });
    const T = HT.time;
    const p = T.toParts(ev.t);
    const hy = T.histYear(ev.t);
    const yearPage = C.yearArticle(hy);
    if (yearPage) add('The year ' + T.formatYear(ev.t), WIKI_PREFIX + yearPage);
    if (hy >= 1 && !(p.month === 1 && p.day === 1)) add(MONTH_NAMES[p.month - 1] + ' ' + p.day + ' in history', WIKI_PREFIX + MONTH_NAMES[p.month - 1] + '_' + p.day);
    const c = eventCoords(ev);
    if (c) add('Open the place on a map', 'https://www.openstreetmap.org/?mlat=' + c[0] + '&mlon=' + c[1] + '#map=6/' + c[0] + '/' + c[1]);
    if (typeof ev.link === 'string' && ev.link.indexOf(WIKI_PREFIX) === 0) add('Wikidata item', 'https://www.wikidata.org/wiki/Special:ItemByTitle/enwiki/' + ev.link.slice(WIKI_PREFIX.length));
    const nodes = links.map(function (l) {
      const a = htmlEl('a', '', l[0] + ' ↗');
      a.href = l[1]; a.target = '_blank'; a.rel = 'noopener noreferrer';
      return a;
    });
    dom.panelMore.replaceChildren.apply(dom.panelMore, nodes);
    dom.panelMore.hidden = nodes.length === 0;
  }

  // --- Today in history (opt-in): the on-this-day list for the visitor's own date, as jumps into the timeline ---
  function todayKey() {
    const d = new Date();
    return { month: d.getMonth() + 1, day: d.getDate(), key: (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '/' + (d.getDate() < 10 ? '0' : '') + d.getDate() };
  }

  function renderToday(state) {
    if (!dom.today) return;
    const td = todayKey();
    const head = htmlEl('div', 'today-head');
    head.appendChild(htmlEl('h3', '', td.day + ' ' + MONTH_NAMES[td.month - 1] + ' in history'));
    const close = htmlEl('button', 'today-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Close');
    head.appendChild(close);
    const parts = [head];
    if (state === 'loading') parts.push(htmlEl('p', 'today-note', 'Loading today’s list from Wikipedia …'));
    else if (state === 'error') parts.push(htmlEl('p', 'today-note', 'Wikipedia could not be reached. Try again in a moment.'));
    else {
      const list = events();
      const hits = C.onCalendarDay(list, td.month, td.day);
      if (!hits.length) parts.push(htmlEl('p', 'today-note', 'Nothing is recorded for this date.'));
      const ul = htmlEl('ul', 'today-list');
      for (let k = hits.length - 1; k >= 0; k--) {          // most recent first
        const ev = list[hits[k]];
        const li = htmlEl('li');
        const b = htmlEl('button', 'today-item');
        b.type = 'button'; b.dataset.index = String(hits[k]);
        b.appendChild(htmlEl('span', 'when', HT.time.formatYear(ev.t)));
        b.appendChild(htmlEl('span', 'what', ev.otd ? ev.detail : ev.title));
        li.appendChild(b);
        ul.appendChild(li);
      }
      parts.push(ul);
      parts.push(htmlEl('p', 'today-note', hits.length + ' events · text from Wikipedia, CC BY-SA 4.0'));
    }
    dom.today.replaceChildren.apply(dom.today, parts);
  }

  function openToday() {
    if (!dom.today) return;
    toggleTours(false);
    if (dom.help && !dom.help.hidden) toggleHelp(false);
    if (!dom.legend.hidden) toggleLegend(false);
    if (!imagesOn) setImages(true);                       // the entry says so: this list comes from Wikipedia
    rememberFocus('today');                               // by now the card it came from has handed focus back to its button
    dom.today.hidden = false;
    renderToday('loading');
    focusFirst(dom.today, '.today-close');
    loadOtdDay(todayKey().key).then(function (state) {
      if (dom.today.hidden) return;
      renderToday(state);
      focusFirst(dom.today, '.today-item, .today-close');
      const n = dom.today.querySelectorAll('.today-item').length;
      announce(state === 'error' ? 'Wikipedia could not be reached.' : n + ' events listed for today\u2019s date, most recent first.', 100);
    });
  }

  function closeToday(opts) {
    if (!dom.today || dom.today.hidden) return;
    dom.today.hidden = true;
    if (opts && opts.keepFocus) focusBack.delete('today'); else restoreFocus('today', dom.btnTours);
  }

  // --- Scale: logarithmic on the widest views by default, or linear everywhere ---
  function setScale(mode, opts) {
    scaleMode = mode === 'lin' ? 'lin' : 'log';
    if (!(opts && opts.keep)) { try { root.localStorage.setItem(SCALE_KEY, scaleMode); } catch (err) { /* ignore */ } }
    updateScaleToggle();
    if (dom && shown) { settleNext = true; render(); if (!(opts && opts.keep) && view) writeUrl('replace'); }
  }

  // The toggle only shows where it changes anything: on views wide enough to be warped.
  function updateScaleToggle() {
    if (!dom || !dom.scaleToggle || !shown) return;
    const matters = shown.end - shown.start > C.WARP_LO;
    dom.scaleToggle.hidden = !matters;
    dom.scaleToggle.setAttribute('aria-pressed', String(scaleMode === 'log'));
    dom.scaleToggle.textContent = scaleMode === 'log' ? 'Scale \u00b7 log' : 'Scale \u00b7 linear';
  }

  // --- Measuring: pick one event, open another, and see the time between them with a comparison or two.
  // The anchor rides in the URL as from=<slug>, so a finding can be shared. ---
  function setMeasure(index) {
    measureFrom = index >= 0 && events()[index] ? index : -1;
    updateMeasureChip();
    if (selected >= 0 && !dom.panel.hidden) updatePanelMeasure(selected);
    if (shown) render();
    if (view) writeUrl('replace');
    announce(measureFrom >= 0 ? 'Measuring from ' + events()[measureFrom].title + '. Open another event to see the time between them.' : 'Stopped measuring.', 100);
  }

  function updateMeasureChip() {
    if (!dom.measureChip) return;
    dom.measureChip.hidden = measureFrom < 0;
    if (measureFrom >= 0) dom.measureChipText.textContent = 'Measuring from: ' + events()[measureFrom].title;
  }

  function updatePanelMeasure(index) {
    if (!dom.panelMeasure) return;
    const list = events();
    dom.measureLines.replaceChildren();
    dom.measureStop.hidden = measureFrom < 0;
    if (measureFrom < 0) {
      dom.measureGap.hidden = true;
      dom.measureStart.hidden = false;
      dom.measureStart.textContent = 'Measure from this event';
      return;
    }
    dom.measureGap.hidden = false;
    if (measureFrom === index) {
      dom.measureGap.textContent = 'Measuring from this event. Open any other event, or search for one, to see the time between them.';
      dom.measureStart.hidden = true;
      return;
    }
    const curatedCount = HT.curatedCount || 0;
    const facts = C.measureFacts(list, measureFrom, index, nowT(), curatedCount ? function (o, i) { return i < curatedCount; } : null);
    dom.measureStart.hidden = false;
    dom.measureStart.textContent = 'Measure from this one instead';
    if (!facts) { dom.measureGap.hidden = true; return; }
    const anchor = list[measureFrom].title;
    dom.measureGap.textContent = facts.gap > 0
      ? C.fmtDuration(facts.gap) + (facts.later === index ? ' after ' : ' before ') + '\u201c' + anchor + '\u201d'
      : 'At the same time as \u201c' + anchor + '\u201d';
    dom.measureLines.replaceChildren.apply(dom.measureLines, facts.lines.map(function (l) { return htmlEl('li', '', l); }));
    announce(dom.measureGap.textContent + '. ' + facts.lines.join(' '), 300);
  }

  // The span between the two events, drawn under the axis; an event off screen pins its end to that edge.
  function renderMeasure(v, axisY) {
    if (!dom.gSpan) return;
    const list = events();
    const a = measureFrom >= 0 ? list[measureFrom] : null;
    if (!a) { if (dom.gSpan.firstChild) dom.gSpan.replaceChildren(); return; }
    const w = size.width;
    const parts = [];
    const ax = tToPx(a.t, v);
    if (ax >= 0 && ax <= w) parts.push(svgEl('circle', { class: 'measure-anchor', cx: ax, cy: axisY, r: 10 }));
    const b = selected >= 0 && selected !== measureFrom && !dom.panel.hidden ? list[selected] : null;
    if (b) {
      const first = a.t <= b.t ? a : b; const second = first === a ? b : a;
      const gap = C.gapBetween(first, second);
      if (gap > 0) {
        const x0 = clamp(tToPx(hasEnd(first) ? first.end : first.t, v), -4, w + 4);
        const x1 = clamp(tToPx(second.t, v), -4, w + 4);
        const y = axisY + 38;
        if (x1 - x0 >= 2) {
          parts.push(svgEl('path', { class: 'measure-span', d: 'M' + x0 + ' ' + (y - 5) + ' V' + y + ' H' + x1 + ' V' + (y - 5) }));
          if (x1 - x0 >= 70) parts.push(svgEl('text', { class: 'measure-label', x: (Math.max(0, x0) + Math.min(w, x1)) / 2, y: y + 13, 'text-anchor': 'middle' }, C.fmtDuration(gap)));
        }
      }
    }
    dom.gSpan.replaceChildren.apply(dom.gSpan, parts);
  }

  // --- Layers menu (mid-width headers): the Earth, Reigns, Lives and Legend buttons folded behind one button ---
  function layersFolded() { return !!dom.btnLayers && root.getComputedStyle(dom.btnLayers).display !== 'none'; }

  function toggleLayers(force) {
    if (!dom.btnLayers || !dom.layerGroup) return;
    const was = dom.layerGroup.classList.contains('open');
    const open = force === undefined ? !was : !!force;
    if (open === was) return;
    if (open) rememberFocus('layers');
    dom.layerGroup.classList.toggle('open', open);
    dom.btnLayers.setAttribute('aria-expanded', String(open));
    if (open) focusFirst(dom.layerGroup); else restoreFocus('layers', dom.btnLayers);
  }

  // --- Accessibility helpers ---
  // Overlays take the focus when they open and hand it back to whatever had it when they close.
  const focusBack = new Map();
  function rememberFocus(key) {
    const el = document.activeElement;
    if (el && el !== document.body) focusBack.set(key, el);
  }
  function restoreFocus(key, fallback) {
    const el = focusBack.get(key);
    focusBack.delete(key);
    const target = el && el.isConnected && !el.disabled && !(el.closest && el.closest('[hidden]')) ? el : fallback;
    if (target && typeof target.focus === 'function') { try { target.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
  }
  function focusFirst(container, selector) {
    const el = container && container.querySelector(selector || 'button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (el) { try { el.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
  }

  // A polite live region says where the view has landed after a jump, and what a filter or list now holds.
  let announceTimer = 0;
  function announce(text, delay) {
    if (!dom || !dom.srStatus) return;
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { announceTimer = 0; dom.srStatus.textContent = typeof text === 'function' ? text() : text; }, delay === undefined ? 500 : delay);
  }
  function announceView() {
    if (tour) return;                                     // the tour bar narrates itself
    announce(function () {
      const v = view || shown;
      const label = isRoot(v) ? 'All of humanity, 300,000 years ago to today' : HT.time.formatRange(v.start, capNow(v.end));
      return 'Showing ' + label + '. ' + hudStats.inWindow + (hudStats.inWindow === 1 ? ' event' : ' events') + ' in view.';
    }, 700);
  }

  // --- Guided tours (HT.tours): a fixed path of events with a line of narration each. A step zooms to its
  // event and opens its panel; the step rides in the URL (tour=<id>.<n>), so Back, Forward and shared links work. ---
  function tourDefs() {
    const base = Array.isArray(HT.tours) ? HT.tours : [];
    const mine = lifetimeDef();
    return mine ? base.concat([mine]) : base;
  }

  // --- Your lifetime: a band from a birth year to today, and a tour generated from the events inside it ---
  function lifetimeDef() {
    if (birthYear === null) return null;
    if (lifeTourDef && lifeTourDef.birth === birthYear) return lifeTourDef;
    const made = C.lifetimeTour(events(), birthYear, nowT(), HT.curatedCount || 0);
    if (!made.steps.length) return null;
    const pop = HT.context && HT.context.pop;
    const co2 = HT.earth && HT.earth.series && HT.earth.series.co2;
    const p0 = pop ? seriesAt(pop, birthYear + 0.5, EARTH_HOLD.pop) : null;
    const p1 = pop ? seriesAt(pop, nowT(), EARTH_HOLD.pop) : null;
    const c0 = co2 ? seriesAt(co2, birthYear + 0.5, EARTH_HOLD.co2) : null;
    const c1 = co2 ? seriesAt(co2, nowT(), EARTH_HOLD.co2) : null;
    let note = 'You were born in ' + birthYear + '. Since then this timeline records ' + made.count.toLocaleString('en-US') + ' events';
    if (p0 && p1) note += '; the world has grown from ' + popFormat(p0).toLowerCase().replace(' b', ' billion').replace(' m', ' million') + ' to ' + popFormat(p1).toLowerCase().replace(' b', ' billion').replace(' m', ' million') + ' people';
    if (c0 && c1) note += ', and CO\u2082 in the air from ' + Math.round(c0) + ' to ' + Math.round(c1) + ' ppm';
    made.steps[0].note = note + '.';
    lifeTourDef = { id: 'your-lifetime', title: 'Your lifetime', blurb: '', steps: made.steps, birth: birthYear, generated: true };
    return lifeTourDef;
  }

  function setBirthYear(y) {
    const year = Math.floor(Number(y));
    const ok = Number.isFinite(year) && year >= 1900 && year <= Math.floor(nowT());
    birthYear = ok ? year : null;
    lifeTourDef = null;
    try { if (ok) root.localStorage.setItem(BIRTH_KEY, String(year)); else root.localStorage.removeItem(BIRTH_KEY); } catch (err) { /* ignore */ }
    if (!ok && tour && tour.def.generated) endTour();
    if (dom && shown) render();
    return ok;
  }

  function renderLifeBand(v, axisY) {
    if (!dom.gLife) return;
    if (birthYear === null || birthYear > v.end || nowT() < v.start) { if (dom.gLife.firstChild) dom.gLife.replaceChildren(); return; }
    const w = size.width;
    const x0 = clamp(tToPx(birthYear, v), 0, w);
    const x1 = clamp(tToPx(nowT(), v), 0, w);
    const parts = [];
    if (x1 - x0 >= 2 && !(x0 <= 0 && x1 >= w)) parts.push(svgEl('rect', { class: 'mylife-zone', x: x0, y: 0, width: x1 - x0, height: size.height }));
    if (x0 > 0) parts.push(svgEl('line', { class: 'mylife-line', x1: crisp(x0), x2: crisp(x0), y1: 0, y2: size.height }));
    if (x1 - x0 >= 90) parts.push(svgEl('text', { class: 'mylife-label', x: x0 + 8, y: axisY + 42 }, 'Your lifetime \u00b7 ' + Math.floor(nowT() - birthYear) + ' years'));
    dom.gLife.replaceChildren.apply(dom.gLife, parts);
  }

  function renderLifeForm() {
    const wrap = htmlEl('form', 'life-form');
    wrap.appendChild(htmlEl('h3', '', 'Your lifetime'));
    wrap.appendChild(htmlEl('p', '', 'Enter the year you were born to see your own years marked on the timeline and take a tour of what has happened in them. It stays in this browser: it is never sent anywhere or put in a link.'));
    const label = htmlEl('label', '', 'Year you were born ');
    const input = htmlEl('input');
    input.type = 'number'; input.min = '1900'; input.max = String(Math.floor(nowT())); input.step = '1'; input.inputMode = 'numeric'; input.required = true;
    input.id = 'life-year'; if (birthYear !== null) input.value = String(birthYear);
    label.appendChild(input);
    wrap.appendChild(label);
    const row = htmlEl('div', 'life-actions');
    const go = htmlEl('button', 'life-go', 'Show my lifetime'); go.type = 'submit';
    const clear = htmlEl('button', '', 'Forget it'); clear.type = 'button'; clear.hidden = birthYear === null;
    const back = htmlEl('button', '', 'Back'); back.type = 'button';
    row.appendChild(go); row.appendChild(clear); row.appendChild(back);
    wrap.appendChild(row);
    const msg = htmlEl('p', 'life-msg'); msg.setAttribute('role', 'alert');
    wrap.appendChild(msg);
    wrap.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!setBirthYear(input.value)) { msg.textContent = 'Enter a year between 1900 and ' + Math.floor(nowT()) + '.'; return; }
      toggleTours(false);
      startTour('your-lifetime', 0);
    });
    clear.addEventListener('click', function () { setBirthYear(null); announce('Your lifetime has been forgotten.'); restoreTourCard(); });
    back.addEventListener('click', restoreTourCard);
    dom.tours.replaceChildren(wrap);
    try { input.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
  }

  function restoreTourCard() {
    if (!dom.tours || !dom.toursHead) return;
    dom.tours.replaceChildren(dom.toursHead, dom.tourList);
    refreshTourLists();
    focusFirst(dom.tours);
  }

  function openLifeForm() {
    if (dom.help && !dom.help.hidden) toggleHelp(false);
    if (dom.tours.hidden) toggleTours(true);
    renderLifeForm();
  }

  function indexOfTitle(title) {
    if (!titleIndex) {
      titleIndex = new Map();
      const list = events();
      for (let i = 0; i < list.length; i++) if (!list[i].otd && !titleIndex.has(list[i].title)) titleIndex.set(list[i].title, i);
    }
    const i = titleIndex.get(title);
    return i === undefined ? -1 : i;
  }

  function renderTourBar() {
    if (!dom.tourBar) return;
    document.body.classList.toggle('touring', !!tour);
    dom.tourBar.hidden = !tour;
    // Narrow screens: the bar lives in the panel sheet while that is open, in the stage otherwise.
    const narrow = typeof root.matchMedia === 'function' && root.matchMedia('(max-width: 640px)').matches;
    const home = tour && narrow && !dom.panel.hidden ? dom.panel : dom.stage;
    if (dom.tourBar.parentNode !== home) {
      if (home === dom.panel) dom.panel.insertBefore(dom.tourBar, dom.panelCategory);
      else dom.stage.insertBefore(dom.tourBar, dom.tooltip);
    }
    if (dom.btnTours) dom.btnTours.classList.toggle('active', !!tour);
    if (!tour) return;
    const n = tour.def.steps.length;
    dom.tourTitle.textContent = tour.def.title;
    dom.tourCount.textContent = (tour.step + 1) + ' / ' + n;
    dom.tourNote.textContent = tour.def.steps[tour.step].note;
    dom.tourPrev.disabled = tour.step === 0;
    dom.tourNext.textContent = tour.step === n - 1 ? 'Finish' : 'Next ›';
    if (dom.tourEdit) dom.tourEdit.hidden = !tour.def.generated;
  }

  // Show step k: reveal the event, open its panel (so the URL written by the zoom already names it), zoom.
  function showTourStep(k) {
    if (!tour) return;
    tour.step = clamp(k, 0, tour.def.steps.length - 1);
    const step = tour.def.steps[tour.step];
    if (step.view) {                                      // a framing step with no event of its own
      if (!dom.panel.hidden) closePanel({ silent: true });
      renderTourBar();
      const was = view;
      commit(step.view, { animate: true, url: 'push', stack: 'push', discrete: true });
      if (sameView(was, view)) writeUrl('push');
      return;
    }
    const i = indexOfTitle(step.ev);
    renderTourBar();
    if (i < 0) { writeUrl('replace'); return; }           // a step whose event is gone: keep the narration, stay put
    revealEvent(i);
    openPanel(i, { silent: true });
    const ev = events()[i];
    const before = view;
    zoomToEvent(ev);
    if (sameView(before, view)) writeUrl('push');         // already framed: the zoom was a no-op, record the step anyway
  }

  function startTour(id, step) {
    const def = tourDefs().filter(function (t) { return t.id === id; })[0];
    if (!def || !def.steps || !def.steps.length) return;
    toggleTours(false);
    if (dom.help && !dom.help.hidden) toggleHelp(false);
    if (!dom.legend.hidden) toggleLegend(false);
    if (dom.search && !dom.search.hidden) toggleSearch(false);
    tour = { def: def, step: 0 };
    showTourStep(step || 0);
  }

  function tourStep(delta) {
    if (!tour) return;
    if (delta > 0 && tour.step === tour.def.steps.length - 1) { endTour(); return; }
    showTourStep(tour.step + delta);
  }

  function endTour() {
    if (!tour) return;
    tour = null;
    pendingTour = null;
    renderTourBar();
    if (view) writeUrl('replace');
    if (shown) render();                                  // the chip and dock come back
  }

  // Match the tour state to the tour= parameter last parsed from the URL, without moving the view: the same
  // URL already carries the view and the open event.
  function syncTourFromUrl() {
    if (!dom) return;
    const want = pendingTour;
    const def = want ? tourDefs().filter(function (t) { return t.id === want.id; })[0] : null;
    if (!def) { if (tour) { tour = null; renderTourBar(); } return; }
    tour = { def: def, step: clamp(want.step, 0, def.steps.length - 1) };
    renderTourBar();
  }

  // Fills a container with the Today entry and one button per tour. It can be called again at any time (the
  // date in the Today entry is refreshed whenever a list is shown); the click listener is bound only once.
  function tourButtons(container, onPick) {
    const td = todayKey();
    const todayBtn = htmlEl('button', 'tour-pick today-pick');
    todayBtn.type = 'button';
    todayBtn.dataset.tour = '@today';
    todayBtn.appendChild(htmlEl('span', 'tp-title', 'Today in history'));
    todayBtn.appendChild(htmlEl('span', 'tp-blurb', 'What happened on ' + td.day + ' ' + MONTH_NAMES[td.month - 1] + ' across two thousand years. Loads the list from Wikipedia and turns on online content.'));
    todayBtn.appendChild(htmlEl('span', 'tp-steps', td.day + ' ' + MONTH_NAMES[td.month - 1].slice(0, 3)));
    const lifeBtn = htmlEl('button', 'tour-pick today-pick');
    lifeBtn.type = 'button';
    lifeBtn.dataset.tour = '@life';
    lifeBtn.appendChild(htmlEl('span', 'tp-title', 'Your lifetime'));
    lifeBtn.appendChild(htmlEl('span', 'tp-blurb', birthYear === null ? 'Enter the year you were born to see your own years on the timeline and tour what has happened in them. Kept in this browser only.' : 'Born ' + birthYear + ': your years on the timeline, and a tour of what has happened in them.'));
    lifeBtn.appendChild(htmlEl('span', 'tp-steps', birthYear === null ? 'You' : String(birthYear)));
    const nodes = [todayBtn, lifeBtn].concat(tourDefs().filter(function (t) { return !t.generated; }).map(function (t) {
      const b = htmlEl('button', 'tour-pick');
      b.type = 'button';
      b.dataset.tour = t.id;
      b.appendChild(htmlEl('span', 'tp-title', t.title));
      b.appendChild(htmlEl('span', 'tp-blurb', t.blurb));
      b.appendChild(htmlEl('span', 'tp-steps', t.steps.length + ' steps'));
      return b;
    }));
    container.replaceChildren.apply(container, nodes);
    if (container.dataset.bound === '1') return;
    container.dataset.bound = '1';
    container.addEventListener('click', function (e) {
      const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.tour-pick') : null;
      if (!b) return;
      if (b.dataset.tour === '@today') openToday();
      else if (b.dataset.tour === '@life') { if (birthYear === null) openLifeForm(); else { toggleTours(false); if (dom.help && !dom.help.hidden) toggleHelp(false); startTour('your-lifetime', 0); } }
      else onPick(b.dataset.tour);
    });
  }

  function refreshTourLists() {
    const start = function (id) { startTour(id, 0); };
    if (dom.tourList) tourButtons(dom.tourList, start);
    if (dom.helpTours && dom.helpTourList) tourButtons(dom.helpTourList, start);
  }

  function toggleTours(force) {
    if (!dom.tours) return;
    const open = force === undefined ? dom.tours.hidden : !!force;
    if (open) {
      if (!dom.legend.hidden) toggleLegend(false);
      if (dom.search && !dom.search.hidden) toggleSearch(false);
      if (dom.help && !dom.help.hidden) toggleHelp(false);
      closeToday();
      if (dom.toursHead) dom.tours.replaceChildren(dom.toursHead, dom.tourList);   // the lifetime form may have replaced them
      refreshTourLists();
    }
    const was = !dom.tours.hidden;
    if (open && !was) rememberFocus('tours');
    dom.tours.hidden = !open;
    if (dom.btnTours) dom.btnTours.setAttribute('aria-expanded', String(open));
    if (open && !was) focusFirst(dom.tours);
    if (!open && was && !tour) restoreFocus('tours', dom.btnTours);
  }

  // --- Permalinks: ev=<slug of the title>. Titles are unique, so slugs are stable while a title is. ---
  const slugify = C.slugify;

  // Built lazily and extended when on-this-day events arrive; their slugs carry the year, since the same
  // sentence can recur across years.
  function buildSlugIndex() {
    if (!slugIndex) slugIndex = { bySlug: new Map(), byIndex: [] };
    const list = events();
    for (let i = slugIndex.byIndex.length; i < list.length; i++) {
      const ev = list[i];
      const base = slugify(ev.otd ? HT.time.toParts(ev.t).year + ' ' + ev.title : ev.title);
      let slug = base;
      for (let k = 2; slugIndex.bySlug.has(slug); k++) slug = base + '-' + k;
      slugIndex.bySlug.set(slug, i);
      slugIndex.byIndex[i] = slug;
    }
  }

  function slugFor(index) {
    if (!slugIndex || slugIndex.byIndex.length < events().length) buildSlugIndex();
    return slugIndex.byIndex[index] || '';
  }

  function indexForSlug(slug) {
    if (!slugIndex || slugIndex.byIndex.length < events().length) buildSlugIndex();
    const i = slugIndex.bySlug.get(String(slug));
    return i === undefined ? -1 : i;
  }

  // Open or close the panel to match the ev= parameter last parsed from the URL.
  function syncPanelFromUrl() {
    if (!dom) return;
    if (pendingEv >= 0) {
      if (selected !== pendingEv || dom.panel.hidden) { revealEvent(pendingEv); openPanel(pendingEv, { silent: true }); }
    }
    else if (!dom.panel.hidden) closePanel({ silent: true });
  }

  function copyEventLink() {
    const url = String(root.location.href);
    const done = function () {
      const old = dom.panelCopy.textContent;
      dom.panelCopy.textContent = 'Link copied';
      setTimeout(function () { dom.panelCopy.textContent = old; }, 1600);
    };
    if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
      root.navigator.clipboard.writeText(url).then(done, function () { root.prompt('Copy this link', url); });
    } else {
      root.prompt('Copy this link', url);
    }
  }

  // --- Regions (boxes and office mapping in HT.core) ---
  const REGIONS = C.REGIONS;
  const REGION_BOXES = C.REGION_BOXES;

  function eventRegion(i) {
    if (!regionCache) regionCache = [];
    if (regionCache[i] !== undefined) return regionCache[i];
    const ev = events()[i];
    const c = eventCoords(ev);
    const r = c ? C.regionOf(c[0], c[1]) : C.officeRegion(ev.group);
    regionCache[i] = r;
    return r;
  }

  // One gate for every layer: category filter and region filter.
  function passesFilters(ev, i) {
    if (hiddenCats.has(ev.category)) return false;
    return regionFilter === null || eventRegion(i) === regionFilter;
  }

  function setRegion(key) {
    regionFilter = key && REGION_BOXES[key] ? key : null;
    try { if (regionFilter) root.localStorage.setItem(REGION_KEY, regionFilter); else root.localStorage.removeItem(REGION_KEY); } catch (err) { /* ignore */ }
    renderLegend();
    if (shown) { settleNext = true; render(); }
    const label = regionFilter ? (REGIONS.filter(function (r) { return r[0] === regionFilter; })[0] || ['', regionFilter])[1] : 'everywhere';
    announce(function () { return 'Region: ' + label + '. ' + hudStats.inWindow + ' events in view.'; });
  }

  // --- Minimap: years before now on a log scale, so the last few thousand years get real width ---
  function mmU(t) { return C.mmU(t, nowT()); }
  function mmX(t, w) { return C.mmX(t, w, nowT()); }

  function renderMinimap() {
    if (!dom.minimap || !shown) return;
    if (!dom.minimap.clientWidth) return;                 // hidden (a short embed): nothing to draw, nothing to cache
    const w = dom.minimap.clientWidth;
    const h = Math.max(1, dom.minimap.clientHeight || 24);
    if (!mmDensity) {
      mmDensity = new Array(MM_BINS).fill(0);
      const list = events();
      const uMax = mmU(HT.time.ROOT_START);
      for (let i = 0; i < list.length; i++) if (!list[i].life) mmDensity[clamp(Math.floor((1 - mmU(list[i].t) / uMax) * MM_BINS), 0, MM_BINS - 1)]++;
    }
    if (dom.minimap.dataset.w !== String(w) || dom.minimap.dataset.h !== String(h)) {       // static parts, rebuilt on resize
      dom.minimap.dataset.w = String(w); dom.minimap.dataset.h = String(h);
      dom.minimap.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      const peak = Math.sqrt(Math.max.apply(null, mmDensity) || 1);
      let d = 'M0 ' + h;
      for (let b = 0; b < MM_BINS; b++) d += ' L' + (b / MM_BINS * w).toFixed(1) + ' ' + (h - Math.sqrt(mmDensity[b]) / peak * (h - 3)).toFixed(1);
      d += ' L' + w + ' ' + h + ' Z';
      const parts = [svgEl('path', { class: 'mm-density', d: d })];
      const ages = [[100000, '100k y ago'], [10000, '10k'], [1000, '1,000'], [100, '100'], [10, '10'], [1, '1 y']];
      for (let k = 0; k < ages.length; k++) {
        const x = crisp(mmX(nowT() - ages[k][0], w));
        parts.push(svgEl('line', { class: 'mm-tick', x1: x, x2: x, y1: 0, y2: h }));
        parts.push(svgEl('text', { class: 'mm-label', x: x + 4, y: 9 }, ages[k][1]));
      }
      dom.mmWindow = svgEl('rect', { class: 'mm-window', y: 1, height: h - 2, rx: 1 });
      parts.push(dom.mmWindow);
      dom.minimap.replaceChildren.apply(dom.minimap, parts);
    }
    const x0 = mmX(shown.start, w);
    const x1 = mmX(shown.end, w);
    dom.mmWindow.setAttribute('x', Math.min(x0, w - 3).toFixed(1));
    dom.mmWindow.setAttribute('width', Math.max(3, x1 - x0).toFixed(1));
  }

  // The window behaves like a scrollbar thumb: it keeps its width on the strip, which on a log scale
  // means the span grows with age. From the root, a press picks a window an eighth of the strip wide.
  function minimapGo(e, first) {
    const rect = dom.minimap.getBoundingClientRect();
    const uMax = mmU(HT.time.ROOT_START);
    const atRoot = isRoot(view);
    const du = atRoot ? uMax / 8 : clamp(mmU(view.start) - mmU(view.end), 0, uMax);
    const uMouse = (1 - clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1)) * uMax;
    if (first) {
      const uMid = (mmU(view.start) + mmU(view.end)) / 2;
      const inside = !atRoot && Math.abs(uMouse - uMid) <= Math.max(du / 2, 3 / Math.max(1, rect.width) * uMax);
      mmGrab = inside ? uMouse - uMid : 0;
      if (inside) return;                                 // grabbed the thumb: wait for movement
    }
    let u0 = uMouse - mmGrab - du / 2;                    // newer edge
    let u1 = u0 + du;                                     // older edge
    if (u0 < 0) { u0 = 0; u1 = du; }
    if (u1 > uMax) { u1 = uMax; u0 = uMax - du; }
    const target = { start: nowT() + 1 - Math.pow(10, u1), end: nowT() + 1 - Math.pow(10, u0) };
    if (u0 === 0) target.end = endAtNow(target.start);    // resting on the present keeps the Today margin
    if (first) commit(target, { animate: true, url: 'push', stack: 'push', discrete: true });
    else commit(target, { animate: false, url: 'replace', stack: 'replace', discrete: false });
  }

  // --- Help overlay ---
  function toggleHelp(force) {
    if (embed) return;                                  // no guide inside an iframe
    const open = force === undefined ? dom.help.hidden : !!force;
    const was = !dom.help.hidden;
    if (open && !was) rememberFocus('help');
    dom.help.hidden = !open;
    dom.btnHelp.setAttribute('aria-expanded', String(open));
    if (!open && was) restoreFocus('help', dom.btnHelp);
    if (open) {
      if (!dom.legend.hidden) toggleLegend(false);
      if (!dom.search.hidden) toggleSearch(false);
      try { dom.helpOk.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    } else {
      try { root.localStorage.setItem(HELP_KEY, '1'); } catch (err) { /* ignore */ }
    }
  }

  // --- Panel map ---
  function eventCoords(ev) {
    if (Number.isFinite(ev.lat) && Number.isFinite(ev.lon)) return [ev.lat, ev.lon, 0];
    if (HT.geo && typeof ev.link === 'string' && ev.link.indexOf(WIKI_PREFIX) === 0) {
      let key = ev.link.slice(WIKI_PREFIX.length);
      try { key = decodeURIComponent(key); } catch (err) { /* keep the raw key */ }
      const g = HT.geo[key];
      if (g) return g;
    }
    return null;
  }

  function buildPanelMap() {
    if (!dom.panelMapSvg || !HT.map) return;
    const W = HT.map.width;
    const H = HT.map.height;
    const svg = dom.panelMapSvg;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const parts = [];
    for (let lon = -120; lon <= 120; lon += 60) parts.push(svgEl('line', { class: 'grat', x1: (lon + 180) * W / 360, x2: (lon + 180) * W / 360, y1: 0, y2: H }));
    for (let lat = -60; lat <= 60; lat += 30) parts.push(svgEl('line', { class: 'grat', x1: 0, x2: W, y1: (90 - lat) * H / 180, y2: (90 - lat) * H / 180 }));
    parts.push(svgEl('path', { class: 'land', d: HT.map.land }));
    dom.mapCrossV = svgEl('line', { class: 'cross', y1: 0, y2: H });
    dom.mapCrossH = svgEl('line', { class: 'cross', x1: 0, x2: W });
    dom.mapRing = svgEl('circle', { class: 'pin-ring', r: 9 });
    dom.mapPin = svgEl('circle', { class: 'pin', r: 7 });
    parts.push(dom.mapCrossV, dom.mapCrossH, dom.mapRing, dom.mapPin);
    svg.replaceChildren.apply(svg, parts);
  }

  function updatePanelMap(ev) {
    if (!dom.panelMap || !HT.map) return;
    const c = eventCoords(ev);
    if (!c) { dom.panelMap.hidden = true; return; }
    const x = (c[1] + 180) * HT.map.width / 360;
    const y = (90 - c[0]) * HT.map.height / 180;
    dom.mapCrossV.setAttribute('x1', x); dom.mapCrossV.setAttribute('x2', x);
    dom.mapCrossH.setAttribute('y1', y); dom.mapCrossH.setAttribute('y2', y);
    dom.mapPin.setAttribute('cx', x); dom.mapPin.setAttribute('cy', y);
    dom.mapRing.setAttribute('cx', x); dom.mapRing.setAttribute('cy', y);
    const lat = Math.abs(c[0]).toFixed(1) + '°' + (c[0] >= 0 ? 'N' : 'S');
    const lon = Math.abs(c[1]).toFixed(1) + '°' + (c[1] >= 0 ? 'E' : 'W');
    dom.panelMapCap.textContent = lat + ' ' + lon + (c[2] ? ' · approximate' : '');
    dom.panelMapSvg.setAttribute('aria-label', 'Location on a world map: ' + lat + ', ' + lon);
    dom.panelMap.hidden = false;
  }

  function toggleLegend(force) {
    const open = force === undefined ? dom.legend.hidden : !!force;
    if (open && dom.tours && !dom.tours.hidden) toggleTours(false);
    const was = !dom.legend.hidden;
    if (open && !was) rememberFocus('legend');
    dom.legend.hidden = !open;
    if (open && !was) focusFirst(dom.legend);
    if (!open && was) restoreFocus('legend', dom.btnLegend);
    dom.btnLegend.setAttribute('aria-expanded', String(open));
  }

  // ------------------------------------------------------------------
  // 6. Tooltip and detail panel
  // ------------------------------------------------------------------
  function showTooltip(index, clientX, clientY) {
    const ev = events()[index];
    if (!ev) { hideTooltip(); return; }
    const tip = dom.tooltip;
    if (tip.dataset.index !== String(index)) {
      tip.replaceChildren(
        htmlEl('div', 'tt-title', ev.title),
        htmlEl('div', 'tt-date', eventDateLabel(ev)),
        htmlEl('div', 'tt-detail', ev.detail)
      );
      tip.dataset.index = String(index);
    }
    if (ev.life) {                                        // how old they were at the date under the pointer
      const t = pxToT(clientX - svgLeft(), shown);
      const age = t >= ev.t && t <= ev.end ? Math.floor(t - ev.t) : -1;
      const line = tip.querySelector('.tt-date');
      if (line) line.textContent = eventDateLabel(ev) + (age >= 0 ? ' \u00b7 aged ' + age + ' here' : '');
    }
    tip.hidden = false;
    positionTooltip(clientX, clientY);
  }

  // Near the pointer, flipped/clamped so it stays inside the stage.
  function positionTooltip(clientX, clientY) {
    const tip = dom.tooltip;
    const rect = dom.stage.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let x = clientX - rect.left + 14;
    let y = clientY - rect.top + 16;
    if (x + tw > rect.width - 8) x = clientX - rect.left - 14 - tw;
    if (y + th > rect.height - 8) y = clientY - rect.top - 12 - th;
    x = Math.max(8, Math.min(x, Math.max(8, rect.width - tw - 8)));
    y = Math.max(8, y);
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
  }

  function hideTooltip() {
    if (!dom || dom.tooltip.hidden) return;
    dom.tooltip.hidden = true;
    delete dom.tooltip.dataset.index;
  }

  function openPanel(index, opts) {
    const ev = events()[index];
    if (!ev) return;
    selected = index;
    const cat = String(ev.category || '');
    const colors = (HT.tiers && HT.tiers.COLORS) || {};
    dom.panelCategory.textContent = ev.otd ? 'On this day \u00b7 Wikipedia' : cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '';
    dom.panelCategory.className = cat ? 'cat-' + cat : '';
    dom.panelCategory.dataset.category = cat;
    dom.panelTitle.textContent = ev.title;
    dom.panelDate.textContent = eventDateLabel(ev);
    dom.panelDetail.textContent = ev.detail || '';
    updatePanelMap(ev);
    updatePanelImage(ev);
    updatePanelObject(ev);
    updatePanelMore(ev);
    updatePanelMeasure(index);
    updatePanelNearby(index);
    if (typeof ev.link === 'string' && /^https:\/\//.test(ev.link)) {
      dom.panelLink.href = ev.link;
      dom.panelLink.textContent = /^https:\/\/[a-z-]+\.wikipedia\.org\//.test(ev.link) ? 'Read more on Wikipedia ↗' : 'Read more ↗';
      dom.panelLink.hidden = false;
    } else {
      dom.panelLink.hidden = true;
      dom.panelLink.removeAttribute('href');
    }
    hideTooltip();
    const wasHidden = dom.panel.hidden;
    dom.panel.hidden = false;
    document.body.classList.add('panel-open');
    markSelected();
    if (tour) renderTourBar();
    if (measureFrom >= 0 && !wasHidden) renderMeasure(shown, lastAxisY);
    if (wasHidden) afterLayoutChange();
    try { dom.panel.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    if (!(opts && opts.silent) && view) writeUrl('replace');      // ev=<slug> makes the open event shareable
  }

  function closePanel(opts) {
    if (!dom || dom.panel.hidden) return;
    dom.panel.hidden = true;
    document.body.classList.remove('panel-open');
    const was = selected >= 0 ? dom.svg.querySelector('.event[data-index="' + selected + '"]') : null;
    if (was) { try { was.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
    selected = -1;
    markSelected();
    if (tour) renderTourBar();
    afterLayoutChange();
    if (!(opts && opts.silent) && view) writeUrl('replace');
  }

  function markSelected() {
    const nodes = dom.svg.querySelectorAll('.event');
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('selected', Number(nodes[i].dataset.index) === selected);
    }
  }

  // The panel pushes the timeline (grid reflow), so the stage size changes without a window resize.
  function afterLayoutChange() {
    if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(render);
    else render();
  }

  // ------------------------------------------------------------------
  // 7. Interaction
  // ------------------------------------------------------------------

  // --- Pointer: tap (zoom / open event), drag (pan), two-finger pinch (zoom) ---
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    hideTooltip();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { dom.svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (pointers.size === 1) {
      gesture = {
        type: 'press', id: e.pointerId, x0: e.clientX, y0: e.clientY,
        target: e.target, shift: e.shiftKey, view: shown, moved: false
      };
    } else if (pointers.size === 2) {
      startPinch();
    } else {
      gesture = null;                                   // three or more fingers: ignore the gesture
    }
    if (e.pointerType === 'mouse') e.preventDefault();  // no text selection while dragging
  }

  function onPointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (gesture && gesture.type === 'pinch') {
      if (p) updatePinch();
      return;
    }
    if (gesture && gesture.type === 'press' && p && e.pointerId === gesture.id) {
      if (!gesture.moved) {
        const dx = e.clientX - gesture.x0;
        const dy = e.clientY - gesture.y0;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          gesture.moved = true;                         // becomes a drag: no zoom on release
          cancelAnimation();                            // freeze the view where it is and pan from there
          gesture.view = shown;
          hideTooltip();
          dom.svg.classList.add('dragging');
        }
      }
      if (gesture.moved) {
        const dxPx = e.clientX - gesture.x0;               // the content follows the pointer by this many pixels
        commit(viewOfPx(-dxPx, size.width - dxPx, gesture.view, e.clientX - svgLeft()),
          { animate: false, url: 'replace', stack: 'replace', discrete: false });
        if (e.pointerType !== 'touch') updateCursor(e.clientX);
        return;
      }
    }
    if (e.pointerType !== 'touch') updateHover(e);
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    try { dom.svg.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!gesture) return;
    if (gesture.type === 'pinch') {
      if (pointers.size < 2) endPinch();
      return;
    }
    if (gesture.type === 'press' && e.pointerId === gesture.id) {
      const g = gesture;
      gesture = null;
      dom.svg.classList.remove('dragging');
      if (g.moved) {
        suppressClickUntil = root.performance.now() + 400;
        return;
      }
      if (e.type === 'pointercancel') {                 // resync if the press interrupted an animation
        if (!sameView(shown, view)) { shown = view; render(); }
        return;
      }
      handleTap(g, e);
    }
  }

  function handleTap(g, e) {
    if (closestEra(g.target)) { zoomToRecorded(); return; }
    const evG = closestEvent(g.target);
    if (evG) {                                          // event tap opens the panel and never zooms
      openPanel(Number(evG.dataset.index));
      return;
    }
    const t = pxToT(e.clientX - svgLeft(), shown);
    if (e.shiftKey || g.shift) zoomOut();
    else zoomIn(t);
  }

  // Native click events are only used to stop propagation for event markers; taps are
  // resolved in pointerup so that pointer capture cannot change the target.
  function onClick(e) {
    if (root.performance.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
    if (closestEvent(e.target) || closestEra(e.target)) e.stopPropagation();
  }

  function startPinch() {
    cancelAnimation();
    hideTooltip();
    hideCursor();
    const ids = Array.from(pointers.keys());
    const a = pointers.get(ids[0]);
    const b = pointers.get(ids[1]);
    const left = svgLeft();
    gesture = {
      type: 'pinch', ids: ids, view: shown,
      p1: a.x - left, p2: b.x - left                      // where the fingers started, in stage pixels
    };
  }

  // Keep what is under each finger under it: the fingers define a stretch-and-slide of the pixel axis
  // (x' = s*x + o), and the new view is the part of the starting view that lands on the stage.
  function updatePinch() {
    const g = gesture;
    const pa = pointers.get(g.ids[0]);
    const pb = pointers.get(g.ids[1]);
    if (!pa || !pb) return;
    const left = svgLeft();
    const q1 = pa.x - left;
    const q2 = pb.x - left;
    if (Math.abs(q2 - q1) < 10 || Math.abs(g.p2 - g.p1) < 1) return;
    const sc = (q2 - q1) / (g.p2 - g.p1);
    if (!(sc > 0)) return;                              // fingers crossed
    const o = q1 - sc * g.p1;
    commit(viewOfPx(-o / sc, (size.width - o) / sc, g.view, (q1 + q2) / 2),
      { animate: false, url: 'replace', stack: 'replace', discrete: false });
  }

  function endPinch() {
    const rest = Array.from(pointers.entries());
    if (rest.length === 1) {                            // one finger left: continue as a pan
      const id = rest[0][0];
      const p = rest[0][1];
      gesture = { type: 'press', id: id, x0: p.x, y0: p.y, target: null, shift: false, view: shown, moved: true };
      dom.svg.classList.add('dragging');
    } else {
      gesture = null;
      dom.svg.classList.remove('dragging');
    }
    suppressClickUntil = root.performance.now() + 400;
  }

  function onPointerLeave() {
    lastMouseX = null;
    hideCursor();
    hideTooltip();
  }

  function updateHover(e) {
    lastMouseX = e.clientX;
    const evG = closestEvent(e.target);
    if (evG) showTooltip(Number(evG.dataset.index), e.clientX, e.clientY);
    else hideTooltip();
    updateCursor(e.clientX);
  }

  // --- Wheel / trackpad: zoom around the cursor; horizontal delta (or Shift) pans ---
  function onWheel(e) {
    e.preventDefault();
    if (!shown) return;
    cancelAnimation();
    hideTooltip();
    let dy = e.deltaY;
    let dx = e.deltaX;
    if (e.deltaMode === 1) { dy *= 16; dx *= 16; }
    else if (e.deltaMode === 2) { dy *= size.height; dx *= size.width; }
    const v = shown;
    const px = e.clientX - svgLeft();
    let f = 1;
    let panPx = dx;
    if (e.shiftKey && !e.ctrlKey) panPx += dy;
    else f = clamp(Math.exp(dy * (e.ctrlKey ? PINCH_K : WHEEL_K)), 0.5, 2);
    // Keep the date under the pointer where it is: the new view is the stretch of the current width from
    // px - px*f to px + (W - px)*f, moved along by the pan.
    const shift = panPx * f;
    let target = viewOfPx(px - px * f + shift, px + (size.width - px) * f + shift, v, panPx ? undefined : px);
    let fly = false;
    if (f < 1 && !panPx && warped(v)) {
      // Zooming in from the log overview onto recent times: the limit at today would slide the target out
      // from under the pointer, so go straight to the view resting on today that keeps it there.
      const tA = pxToT(px, v);
      const held = clampView(target.start, target.end);
      if (Math.abs(C.tToU(tA, held, nowT(), scaleMode) - px / size.width) > 0.01) {
        const alt = C.viewAtNowWithAnchor(tA, px / size.width, nowT(), scaleMode);
        if (alt && alt.end - alt.start < held.end - held.start) { target = alt; fly = true; }
      }
    }
    commit(target, { animate: fly, url: 'replace', stack: 'replace', discrete: false });
    updateCursor(e.clientX);
  }

  // --- Keyboard ---
  function onKeyDown(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    const tag = el && el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
    switch (e.key) {
      case '?':
        toggleHelp();
        e.preventDefault();
        break;
      case '/':
        toggleSearch(true);
        e.preventDefault();
        break;
      case 'Escape':
        if (dom.layerGroup && dom.layerGroup.classList.contains('open')) { toggleLayers(false); e.preventDefault(); }
        else if (dom.help && !dom.help.hidden) { toggleHelp(false); e.preventDefault(); }
        else if (dom.search && !dom.search.hidden) { toggleSearch(false); e.preventDefault(); }
        else if (!dom.panel.hidden) { closePanel(); e.preventDefault(); }
        else if (!dom.legend.hidden) { toggleLegend(false); e.preventDefault(); }
        else if (dom.today && !dom.today.hidden) { closeToday(); e.preventDefault(); }
        else if (dom.tours && !dom.tours.hidden) { toggleTours(false); e.preventDefault(); }
        else if (tour) { endTour(); e.preventDefault(); }
        else hideTooltip();
        break;
      case 'ArrowRight':
      case 'ArrowLeft': {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (tour) { tourStep(dir); e.preventDefault(); break; }
        if (el && el.closest && el.closest('#legend, #tours, #today, #help, #panel, #search')) break;   // leave lists and cards alone
        // Pan a fifth of the view (four fifths with Shift): the keyboard's answer to dragging.
        const base = view || rootView();
        const d = (base.end - base.start) * (e.shiftKey ? 0.8 : 0.2) * dir;
        commit({ start: base.start + d, end: base.end + d }, { animate: true, url: 'replace', stack: 'replace', discrete: false });
        announceView();
        e.preventDefault();
        break;
      }
      case '-':
      case '_':
        zoomOut();
        e.preventDefault();
        break;
      case '0':
        home();
        e.preventDefault();
        break;
      case 'Enter':
      case ' ': {
        const evG = closestEvent(e.target);             // a focused event marker opens its panel
        if (evG) { openPanel(Number(evG.dataset.index)); e.preventDefault(); }
        else if (closestEra(e.target)) { zoomToRecorded(); e.preventDefault(); }
        break;
      }
      case '+':
      case '=':
        zoomIn((shown.start + shown.end) / 2);
        e.preventDefault();
        break;
      case '1': case '2': case '3': case '4': case '5': case '6':
        setTheme(THEMES[Number(e.key) - 1]);
        e.preventDefault();
        break;
      case 'r':
      case 'R':
        setReigns(!reignsOn);
        e.preventDefault();
        break;
      case 'p':
      case 'P':
        setLives(!livesOn);
        e.preventDefault();
        break;
      case 'l':
      case 'L':
        if (dom.scaleToggle && !dom.scaleToggle.hidden) { dom.scaleToggle.click(); e.preventDefault(); }
        break;
      case 'e':
      case 'E':
        setEarth(!earthOn);
        e.preventDefault();
        break;
      case 't':
      case 'T': {
        const cur = THEMES.indexOf(resolveTheme(theme));
        setTheme(THEMES[(cur + 1) % THEMES.length]);
        e.preventDefault();
        break;
      }
      default:
        break;
    }
  }

  // --- Resize: window resize and stage size changes (panel open/close), debounced 100ms ---
  function onResize() {
    if (dom && shown) {                                  // cheap part right away: keep the SVG 1:1 with its box
      measureSize();
      dom.svg.setAttribute('width', size.width);
      dom.svg.setAttribute('height', size.height);
      dom.svg.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height);
    }
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = 0;
      widthCache.clear();                               // fonts may change with the viewport
      render();
    }, RESIZE_DEBOUNCE_MS);
  }

  // --- Browser history: popstate (back/forward) and hashchange (manual edits) ---
  function onLocationChange(e) {
    discardPendingUrl();
    const target = parseHash(root.location.hash) || rootView();
    if (!root.location.hash || root.location.hash.length < 2) pendingTour = null;
    syncTourFromUrl();
    syncPanelFromUrl();
    if (sameView(target, view)) return;
    const saved = e && e.state && e.state.ht ? restoreStack(e.state.stack, target) : null;
    stack = saved || deriveStack(target);
    commit(target, { animate: true, url: 'none', stack: 'keep' });
  }

  function bindEvents() {
    const svg = dom.svg;
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    svg.addEventListener('pointerleave', onPointerLeave);
    svg.addEventListener('click', onClick);
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('dblclick', function (e) { e.preventDefault(); });
    // Safari's own pinch-zoom gesture events
    svg.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    svg.addEventListener('gesturechange', function (e) { e.preventDefault(); });

    dom.btnOut.addEventListener('click', function () { zoomOut(); });
    dom.btnHome.addEventListener('click', function () { home(); });
    dom.btnLegend.addEventListener('click', function () { if (dom.search && !dom.search.hidden) toggleSearch(false); toggleLegend(); });
    dom.legend.addEventListener('click', onLegendClick);
    if (dom.btnHelp) {
      dom.btnHelp.addEventListener('click', function () { toggleHelp(); });
      dom.helpClose.addEventListener('click', function () { toggleHelp(false); });
      dom.helpOk.addEventListener('click', function () { toggleHelp(false); });
    }
    if (dom.panelCopy) dom.panelCopy.addEventListener('click', copyEventLink);
    if (dom.minimap) {
      dom.minimap.addEventListener('pointerdown', function (e) {
        mmDrag = true;
        mmDownX = e.clientX;
        mmMoved = false;
        try { dom.minimap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        minimapGo(e, true);
        e.preventDefault();
      });
      dom.minimap.addEventListener('pointermove', function (e) {
        if (!mmDrag || isRoot(view)) return;
        if (!mmMoved && Math.abs(e.clientX - mmDownX) < 3) return;     // a click, not a drag
        mmMoved = true;
        minimapGo(e, false);
      });
      const endDrag = function () { if (mmDrag) { mmDrag = false; flushUrl(); } };
      dom.minimap.addEventListener('pointerup', endDrag);
      dom.minimap.addEventListener('pointercancel', endDrag);
    }
    if (dom.btnSearch) {
      dom.btnSearch.addEventListener('click', function () { toggleSearch(); });
      dom.searchInput.addEventListener('input', onSearchInput);
      dom.searchInput.addEventListener('keydown', onSearchKey);
      dom.searchResults.addEventListener('click', function (e) {
        const li = e.target && typeof e.target.closest === 'function' ? e.target.closest('li[data-k]') : null;
        if (li) chooseSearchHit(Number(li.dataset.k));
      });
    }
    dom.crumbs.addEventListener('click', onCrumbClick);
    dom.panelClose.addEventListener('click', closePanel);
    dom.panelZoom.addEventListener('click', function () {
      const ev = events()[selected];
      if (ev) zoomToEvent(ev);
    });

    document.addEventListener('keydown', onKeyDown);
    root.addEventListener('resize', onResize);
    root.addEventListener('popstate', onLocationChange);
    root.addEventListener('hashchange', onLocationChange);
    if (typeof root.ResizeObserver === 'function') {
      const ro = new root.ResizeObserver(onResize);
      ro.observe(dom.stage);
    }
  }

  // ------------------------------------------------------------------
  // 8. init
  // ------------------------------------------------------------------
  function buildSvgScaffold() {
    const svg = dom.svg;
    svg.style.touchAction = 'none';                     // we handle pan/pinch ourselves
    svg.style.userSelect = 'none';
    svg.style.webkitUserSelect = 'none';
    dom.gMinor = svgEl('g', { class: 'g-minor' });
    dom.gMajor = svgEl('g', { class: 'g-major' });
    dom.gLabels = svgEl('g', { class: 'g-labels' });
    dom.gAxis = svgEl('g', { class: 'g-axis' });
    dom.gEvents = svgEl('g', { class: 'g-events' });
    dom.gEarth = svgEl('g', { class: 'g-earth', 'pointer-events': 'none' });
    dom.gReigns = svgEl('g', { class: 'g-reigns' });
    dom.gNow = svgEl('g', { class: 'g-now', 'pointer-events': 'none' });
    dom.gLife = svgEl('g', { class: 'g-mylife', 'pointer-events': 'none' });
    dom.gSpan = svgEl('g', { class: 'g-span', 'pointer-events': 'none' });
    dom.gEra = svgEl('g', { class: 'g-era' });
    dom.gCursor = svgEl('g', { class: 'g-cursor', 'pointer-events': 'none' });
    dom.cursorLine = svgEl('line', { class: 'cursor-line', x1: 0, x2: 0, y1: 0, y2: 0, visibility: 'hidden' });
    dom.gCursor.appendChild(dom.cursorLine);
    const gMeasure = svgEl('g', { class: 'g-measure', visibility: 'hidden', 'pointer-events': 'none', 'aria-hidden': 'true' });
    measureTickEl = svgEl('text', { class: 'tick-label', x: -1000, y: -1000 });
    const measureEvent = svgEl('g', { class: 'event' });
    measureLabelEl = svgEl('text', { class: 'label', x: -1000, y: -1000 });
    measureEvent.appendChild(measureLabelEl);
    gMeasure.appendChild(measureTickEl);
    gMeasure.appendChild(measureEvent);
    svg.replaceChildren(dom.gLife, dom.gMinor, dom.gMajor, dom.gEarth, dom.gLabels, dom.gAxis, dom.gNow, dom.gReigns, dom.gEvents, dom.gSpan, dom.gEra, dom.gCursor, gMeasure);

    // The tooltip is positioned in stage coordinates; make sure the stage is its containing block.
    dom.tooltip.style.position = 'absolute';
    dom.tooltip.style.pointerEvents = 'none';
    if (root.getComputedStyle(dom.stage).position === 'static') dom.stage.style.position = 'relative';
    if (!dom.panel.hasAttribute('tabindex')) dom.panel.tabIndex = -1;
  }

  function init() {
    if (inited) return;
    if (typeof document === 'undefined') return;
    const $ = function (id) { return document.getElementById(id); };
    const svg = $('timeline');
    if (!svg) return;
    inited = true;
    dom = {
      app: $('app'), header: $('header'), crumbs: $('crumbs'), cursorDate: $('cursor-date'),
      btnOut: $('btn-out'), btnHome: $('btn-home'), btnLegend: $('btn-legend'),
      stage: $('stage') || svg.parentNode, svg: svg, tooltip: $('tooltip'), legend: $('legend'),
      panel: $('panel'), panelClose: $('panel-close'), panelCategory: $('panel-category'),
      panelTitle: $('panel-title'), panelDate: $('panel-date'), panelDetail: $('panel-detail'),
      panelZoom: $('panel-zoom'),
      panelLink: $('panel-link'),
      dock: $('dock'), cursorChip: $('cursor-chip'),
      hudSpan: $('hud-span'), hudEvents: $('hud-events'), hudTier: $('hud-tier'), hudScale: $('hud-scale'),
      hudMode: $('hud-mode'), hudClock: $('hud-clock'), hudNow: $('hud-now'),
      hudEarth: $('hud-earth'), hudCity: $('hud-city'), btnEarth: $('btn-earth'), hud: $('hud'),
      btnReigns: $('btn-reigns'), btnSearch: $('btn-search'), search: $('search'), searchInput: $('search-input'), searchResults: $('search-results'),
      panelMap: $('panel-map'), panelMapSvg: $('panel-map-svg'), panelMapCap: $('panel-map-cap'),
      panelImage: $('panel-image'), panelImg: $('panel-img'), panelImgLink: $('panel-img-link'), panelImgCredit: $('panel-img-credit'),
      optImages: $('opt-images'),
      panelExtract: $('panel-extract'), panelExtractText: $('panel-extract-text'), panelExtractSrc: $('panel-extract-src'),
      panelMore: $('panel-more'), panelNear: $('panel-near'), panelNearList: $('panel-near-list'),
      panelRelated: $('panel-related'), panelRelatedHead: $('panel-related-head'), panelRelatedList: $('panel-related-list'),
      otdChip: $('otd-chip'), otdAction: $('otd-action'), otdDismiss: $('otd-dismiss'),
      btnTours: $('btn-tours'), tours: $('tours'), tourBar: $('tour-bar'), tourTitle: $('tour-title'), tourCount: $('tour-count'),
      tourNote: $('tour-note'), tourPrev: $('tour-prev'), tourNext: $('tour-next'), tourExit: $('tour-exit'),
      panelMeasure: $('panel-measure'), measureGap: $('measure-gap'), measureLines: $('measure-lines'), measureStart: $('measure-start'),
      measureStop: $('measure-stop'), measureChip: $('measure-chip'), measureChipText: $('measure-chip-text'), measureChipStop: $('measure-chip-stop'),
      btnLayers: $('btn-layers'), layerGroup: $('layer-group'),
      scaleToggle: $('scale-toggle'), btnLives: $('btn-lives'), tourEdit: $('tour-edit'),
      embedOpen: $('embed-open'), srStatus: $('sr-status'), skip: $('skip'),
      helpTours: $('help-tours'), helpTourList: $('help-tour-list'), today: $('today'),
      minimap: $('minimap'), help: $('help'), helpClose: $('help-close'), helpOk: $('help-ok'), btnHelp: $('btn-help'), panelCopy: $('panel-copy'),
      panelObject: $('panel-object'), panelObjectImg: $('panel-object-img'), panelObjectImgLink: $('panel-object-imglink'),
      panelObjectLink: $('panel-object-link'), panelObjectCredit: $('panel-object-credit')
    };
    // Embed mode changes the layout, so it is settled before anything is measured or drawn.
    try { embed = /[?&]embed=(1|true)\b/.test(String(root.location.search || '')); } catch (err) { embed = false; }
    if (embed) {
      document.body.classList.add('embed');
      if (dom.embedOpen) dom.embedOpen.hidden = false;
    }
    NOW = HT.time.now();
    // Sitting office-holders are generated without an end: their reign runs to the moment the page opened.
    const all = events();
    for (let i = 0; i < all.length; i++) if (all[i].ongoing === true && !hasEnd(all[i]) && all[i].t < NOW) all[i].end = NOW;
    // Theme: URL param (read in parseHash below) > stored choice > auto.
    try { const stored = root.localStorage.getItem(THEME_KEY); if (stored && THEMES.indexOf(stored) >= 0) theme = stored; } catch (err) { /* ignore */ }
    applyTheme();
    if (typeof root.matchMedia === 'function') {
      const mq = root.matchMedia('(prefers-color-scheme: light)');
      const onScheme = function () { if (theme === 'auto') applyTheme(); };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onScheme);
      else if (typeof mq.addListener === 'function') mq.addListener(onScheme);
    }
    if (dom.dock) {
      dom.dock.addEventListener('click', function (e) {
        const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('button[data-theme]') : null;
        if (b) setTheme(b.dataset.theme);
      });
    }
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
    try { earthOn = root.localStorage.getItem(EARTH_KEY) !== '0'; } catch (err) { /* ignore */ }
    try { const by = Number(root.localStorage.getItem(BIRTH_KEY)); if (Number.isFinite(by) && by >= 1900 && by <= Math.floor(nowT())) birthYear = Math.floor(by); } catch (err) { /* ignore */ }
    try { livesOn = root.localStorage.getItem(LIVES_KEY) === '1'; if (livesOn) reignsOn = false; } catch (err) { /* ignore */ }
    try { scaleMode = root.localStorage.getItem(SCALE_KEY) === 'lin' ? 'lin' : 'log'; } catch (err) { /* ignore */ }
    try { reignsOn = root.localStorage.getItem(REIGNS_KEY) !== '0'; } catch (err) { /* ignore */ }
    try { imagesOn = root.localStorage.getItem(IMAGES_KEY) === '1'; } catch (err) { /* ignore */ }
    try { const rk = root.localStorage.getItem(REGION_KEY); if (rk && REGION_BOXES[rk]) regionFilter = rk; } catch (err) { /* ignore */ }
    if (dom.optImages) {
      dom.optImages.checked = imagesOn;
      dom.optImages.addEventListener('change', function () { setImages(dom.optImages.checked); });
    }
    if (dom.tours && tourDefs().length) {
      const head = htmlEl('h3', '', 'Guided tours');
      const list = htmlEl('div', 'tour-list');
      dom.tours.replaceChildren(head, list);
      dom.toursHead = head;
      dom.tourList = list;
      if (dom.helpTours) dom.helpTours.hidden = false;
      refreshTourLists();
      dom.btnTours.addEventListener('click', function () { toggleTours(); });
      dom.tourPrev.addEventListener('click', function () { tourStep(-1); });
      dom.tourNext.addEventListener('click', function () { tourStep(1); });
      dom.tourExit.addEventListener('click', endTour);
      if (dom.tourEdit) dom.tourEdit.addEventListener('click', function () { endTour(); openLifeForm(); });
    } else if (dom.btnTours) {
      dom.btnTours.hidden = true;
    }
    if (dom.btnLives) dom.btnLives.addEventListener('click', function () { setLives(!livesOn); });
    syncLayerButtons();
    if (dom.scaleToggle) {
      dom.scaleToggle.addEventListener('click', function () {
        setScale(scaleMode === 'log' ? 'lin' : 'log');
        announce('Scale: ' + (scaleMode === 'log' ? 'logarithmic on wide views' : 'linear'));
      });
    }
    if (dom.panelMeasure) {
      dom.measureStart.addEventListener('click', function () { if (selected >= 0) setMeasure(selected); });
      dom.measureStop.addEventListener('click', function () { setMeasure(-1); });
      dom.measureChipStop.addEventListener('click', function () { setMeasure(-1); });
    }
    if (dom.btnLayers) {
      dom.btnLayers.addEventListener('click', function (e) { e.stopPropagation(); toggleLayers(); });
      dom.btnLegend.addEventListener('click', function () { if (layersFolded()) toggleLayers(false); });   // the legend card replaces the menu
      document.addEventListener('click', function (e) {
        if (dom.layerGroup.classList.contains('open') && !dom.layerGroup.contains(e.target)) toggleLayers(false);
      });
      root.addEventListener('resize', function () { if (!layersFolded()) toggleLayers(false); });
    }
    if (dom.skip) {
      dom.skip.addEventListener('click', function () {
        const first = dom.svg.querySelector('.event');
        try { (first || dom.svg).focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      });
    }
    if (dom.today) {
      dom.today.addEventListener('click', function (e) {
        const t = e.target && typeof e.target.closest === 'function' ? e.target : null;
        if (!t) return;
        if (t.closest('.today-close')) { closeToday(); return; }
        const b = t.closest('.today-item');
        if (b) { closeToday({ keepFocus: true }); jumpToEvent(Number(b.dataset.index)); }
      });
    }
    if (dom.otdChip) {
      try { otdHint = root.localStorage.getItem(OTD_HINT_KEY) !== 'off'; } catch (err) { /* ignore */ }
      dom.otdAction.addEventListener('click', function () { if (!imagesOn) setImages(true); });
      dom.otdDismiss.addEventListener('click', function () {
        otdHint = false;
        try { root.localStorage.setItem(OTD_HINT_KEY, 'off'); } catch (err) { /* ignore */ }
        updateOtdChip();
      });
    }
    if (dom.panelNear) {
      const onJump = function (e) {
        const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.panel-jump') : null;
        if (b) jumpToEvent(Number(b.dataset.index));
      };
      dom.panelNear.addEventListener('click', onJump);
      dom.panelRelated.addEventListener('click', onJump);
    }
    if (dom.btnReigns) {
      dom.btnReigns.setAttribute('aria-pressed', String(reignsOn));
      dom.btnReigns.addEventListener('click', function () { setReigns(!reignsOn); });
    }
    if (dom.btnEarth) {
      dom.btnEarth.setAttribute('aria-pressed', String(earthOn));
      dom.btnEarth.addEventListener('click', function () { setEarth(!earthOn); });
    }
    try {
      const saved = JSON.parse(root.localStorage.getItem(HIDDEN_KEY) || '[]');
      if (Array.isArray(saved)) saved.forEach(function (c) { if (HT.tiers.CATEGORIES.indexOf(c) >= 0) hiddenCats.add(c); });
    } catch (err) { /* ignore */ }
    buildSvgScaffold();
    buildPanelMap();
    renderLegend();

    // Initial view from the hash; breadcrumb chain from history.state when a reload preserved it.
    const parsed = parseHash(root.location.hash);
    view = parsed || rootView();
    const saved = root.history && root.history.state && root.history.state.ht
      ? restoreStack(root.history.state.stack, view) : null;
    stack = saved || deriveStack(view);
    shown = view;
    stampState();
    applyTheme();                                        // parseHash may have picked a theme from the URL

    bindEvents();
    settleNext = true;
    render();
    renderCrumbs();
    renderLegend();                                       // region state may have been restored after the first build
    updateMeasureChip();
    syncTourFromUrl();
    if (pendingEv >= 0) { revealEvent(pendingEv); openPanel(pendingEv, { silent: true }); }
    // First visit without a shared link: show the guide once.
    let seen = true;
    try { seen = root.localStorage.getItem(HELP_KEY) === '1'; } catch (err) { /* ignore */ }
    if (!seen && !embed && dom.help && (!root.location.hash || root.location.hash.length < 2)) toggleHelp(true);
    if (embed) updateEmbedLink();
  }

  HT.app = {
    init: init,
    setView: setView,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    home: home,
    zoomToEvent: zoomToEvent,
    getView: getView,
    setTheme: setTheme,
    getTheme: getTheme,
    setEarth: setEarth,
    setReigns: setReigns,
    setImages: setImages,
    setRegion: setRegion,
    setLives: setLives,
    THEMES: THEMES.slice()
  };
})(typeof window !== 'undefined' ? window : globalThis);
