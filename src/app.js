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

  // ------------------------------------------------------------------
  // 1. Constants and state
  // ------------------------------------------------------------------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ZOOM_FACTOR = 4;
  const ANIM_MS = 250;
  const MIN_SPAN = 1 / 365;               // one day in years (>= one calendar day in common and leap years)
  const MIN_VISIBLE = 8;                  // admit lower tiers until this many events are in view
  const THEMES = ['ops', 'crt', 'nvg', 'ironbow', 'noir', 'paper'];
  const THEME_KEY = 'ht-theme';
  const EARTH_KEY = 'ht-earth';
  const HIDDEN_KEY = 'ht-hidden-cats';
  const REIGNS_KEY = 'ht-reigns';
  const REIGN_ROW_H = 17;                 // px per swimlane row
  const REIGN_TOP = 22;                   // px from the top of the stage to the first row (clears the corner bracket)
  const REIGN_MAX_ROWS = 12;
  const REIGN_MIN_WIDTH = 640;            // narrower stages keep reigns as ordinary events
  const WIKI_PREFIX = 'https://en.wikipedia.org/wiki/';
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
  const HASH_DECIMALS = 9;
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
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function nowT() {
    if (NOW === null) NOW = HT.time.now();
    return NOW;
  }

  function rootView() {
    return { start: HT.time.ROOT_START, end: nowT() };
  }

  function rootEntry() {
    const r = rootView();
    return { start: r.start, end: r.end, discrete: true };
  }

  // Equality at URL precision (9 decimals).
  function sameView(a, b) {
    return !!a && !!b && Math.abs(a.start - b.start) < 5e-10 && Math.abs(a.end - b.end) < 5e-10;
  }

  function contains(outer, inner) {
    const eps = 5e-10;
    return outer.start - eps <= inner.start && inner.end <= outer.end + eps;
  }

  function isRoot(v) {
    return sameView(v, rootView());
  }

  // Clamp a candidate view to [ROOT_START, now] with span in [1 day, root span].
  function clampView(start, end) {
    const r = rootView();
    const rootSpan = r.end - r.start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return r;
    // Snap edges that sit on (or within an hour of) the root bounds onto them so a view written by
    // an earlier page load, when "now" was a little earlier, is still recognised as the root.
    if (start < r.start + 1e-6) start = r.start;
    if (end > r.end - MIN_SPAN / 24) end = r.end;
    let span = end - start;
    if (!(span > 0)) span = MIN_SPAN;
    if (span >= rootSpan - 1e-9) return r;
    if (span < MIN_SPAN) span = MIN_SPAN;
    const c = (start + end) / 2;
    start = c - span / 2;
    end = c + span / 2;
    if (start < r.start) { start = r.start; end = start + span; }
    if (end > r.end) { end = r.end; start = end - span; }
    return { start: start, end: end };
  }

  function tToPx(t, v) {
    return (t - v.start) / (v.end - v.start) * size.width;
  }

  function pxToT(px, v) {
    return v.start + px / size.width * (v.end - v.start);
  }

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

  function hasEnd(ev) {
    return Number.isFinite(ev.end) && ev.end > ev.t;
  }

  // Date text for tooltips/panel. Ranges use formatRange (year-precision ranges read
  // "3100 BCE – 2900 BCE" instead of two "Jan 1" dates); points use formatDateFull, except
  // that pre-1900 events dated exactly Jan 1 (year precision by the data rules) show just the year.
  function eventDateLabel(ev) {
    const T = HT.time;
    if (hasEnd(ev)) return T.formatRange(ev.t, ev.end);
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

  // --- URL hash: #s=<start>&e=<end>, up to 9 decimals, trailing zeros trimmed ---
  function fmtNum(x) {
    return String(Number(x.toFixed(HASH_DECIMALS)));
  }

  // The root's end is written as the token "now" so a shared or reloaded root link is still the
  // root when the page is opened later (a numeric "now" would be seconds to days stale).
  function encodeHash(v) {
    const end = Math.abs(v.end - nowT()) < 5e-10 ? 'now' : fmtNum(v.end);
    return '#s=' + fmtNum(v.start) + '&e=' + end + (theme !== 'auto' ? '&m=' + theme : '');
  }

  function parseHash(hash) {
    if (!hash || hash.length < 2) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const m = params.get('m');
    if (m && THEMES.indexOf(m) >= 0 && m !== theme) setTheme(m, { silent: true });
    const s = parseFloat(params.get('s'));
    const e = params.get('e') === 'now' ? nowT() : parseFloat(params.get('e'));
    if (!Number.isFinite(s) || !Number.isFinite(e) || !(e > s)) return null;
    return clampView(s, e);
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
      return [e.start, Math.abs(e.end - nowT()) < 5e-10 ? 'now' : e.end, e.discrete ? 1 : 0];
    });
  }

  // Rebuild a stack saved in history.state; null when it is not a valid chain ending at `target`.
  function restoreStack(arr, target) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const s = [];
    for (let i = 0; i < arr.length; i++) {
      const x = arr[i];
      if (!Array.isArray(x)) return null;
      const e = { start: Number(x[0]), end: x[1] === 'now' ? nowT() : Number(x[1]), discrete: !!x[2] };
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
    const span = Math.max(MIN_SPAN, baseSpan / factor);
    commit(fitInside({ start: tCenter - span / 2, end: tCenter + span / 2 }, base),
      { animate: true, url: 'push', stack: 'push', discrete: true });
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

  // Ranged: fit [t, end] with 15% padding each side. Point: span = max(1 day, tierSpan(tier) / 10) centered on t.
  function zoomToEvent(ev) {
    if (!ev || !Number.isFinite(ev.t)) return;
    let start, end;
    if (hasEnd(ev)) {
      const pad = (ev.end - ev.t) * 0.15;
      start = ev.t - pad;
      end = ev.end + pad;
    } else {
      // A tenth of the tier's span keeps the event visible with context; recent events are capped at 8% of
      // their age (at least a decade) so a search for Apollo 11 lands in the 1960s, not in a 10,000-year view.
      const span = Math.max(MIN_SPAN, Math.min(tierSpan(ev.tier) / 10, Math.max(10, (nowT() - ev.t) * 0.08)));
      start = ev.t - span / 2;
      end = ev.t + span / 2;
    }
    const base = view || rootView();
    const target = ev.t >= base.start && ev.t <= base.end ? fitInside({ start: start, end: end }, base) : { start: start, end: end };
    commit(target, { animate: true, url: 'push', stack: 'push', discrete: true });
  }

  // Shift a window so it lies inside `outer` when it is narrower than it; a zoom-in near an edge
  // then slides inward instead of overhanging the parent view (which would break the breadcrumb chain).
  function fitInside(win, outer) {
    const span = win.end - win.start;
    if (span >= outer.end - outer.start) return win;
    let start = win.start;
    let end = win.end;
    if (start < outer.start) { start = outer.start; end = start + span; }
    if (end > outer.end) { end = outer.end; start = end - span; }
    return { start: start, end: end };
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
    renderTicks(shown, axisY);
    renderEvents(shown, axisY);
    renderReigns(shown);
    renderEarth(shown, axisY);
    renderNowMarker(shown, axisY);
    dom.cursorLine.setAttribute('y1', 0);
    dom.cursorLine.setAttribute('y2', h);
    if (lastMouseX !== null) updateCursor(lastMouseX);  // the date under a resting pointer changes with the view
    updateHud(shown);
    settleNext = false;
  }

  // --- Reign swimlanes: one row per office at the top of the stage ---
  function reignsActive() {
    return reignsOn && size.width >= REIGN_MIN_WIDTH;
  }

  function planReigns(v, axisY) {
    reignRows = [];
    reignReserve = 0;
    if (!reignsActive()) return;
    const list = events();
    if (!groupOrder) {
      groupOrder = [];
      for (let i = 0; i < list.length; i++) if (list[i].group && groupOrder.indexOf(list[i].group) < 0) groupOrder.push(list[i].group);
    }
    const byGroup = new Map();
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (!ev.group || hiddenCats.has(ev.category)) continue;
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

  function setReigns(on) {
    reignsOn = !!on;
    try { root.localStorage.setItem(REIGNS_KEY, reignsOn ? '1' : '0'); } catch (err) { /* ignore */ }
    if (dom && dom.btnReigns) dom.btnReigns.setAttribute('aria-pressed', String(reignsOn));
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
    return null;
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
    const hasCities = !!(HT.context && HT.context.cities) && floor - top - (CITY_H + 12) >= 56;
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
      const v0 = seriesAt(arr, v.start, EARTH_HOLD[key]);
      if (v0 !== null) pts.push([0, y(v0)]);
      let lastPx = -Infinity;
      for (let i = firstIndexAtOrAfter(arr, v.start); i < arr.length; i++) {
        const t = arr[i][0];
        if (t > v.end) break;
        const px = tToPx(t, v);
        if (px - lastPx < step) continue;
        lastPx = px;
        pts.push([px, y(arr[i][1])]);
      }
      const v1 = seriesAt(arr, v.end, EARTH_HOLD[key]);
      if (v1 !== null) pts.push([w, y(v1)]);
      if (pts.length < 2) continue;
      const d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      if (key === 'co2') {
        frag.appendChild(svgEl('path', { class: 'earth-fill co2', d: d + ' L' + w + ' ' + bottom + ' L0 ' + bottom + ' Z' }));
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
        if (seg[1] < v.start || seg[0] > v.end) continue;
        const x0 = clamp(tToPx(seg[0], v), 0, w);
        const x1 = clamp(tToPx(seg[1], v), 0, w);
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
    dom.gNow.replaceChildren(
      svgEl('line', { class: 'now-marker', x1: x, x2: x, y1: axisY - 14, y2: axisY + 14 }),
      svgEl('circle', { class: 'now-dot', cx: x, cy: axisY, r: 3, fill: 'var(--accent)' })
    );
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
    dom.hudSpan.textContent = fmtSpan(span);
    dom.hudEvents.textContent = hudStats.visible + ' / ' + hudStats.inWindow;
    dom.hudTier.textContent = '\u2264 ' + hudStats.tier;
    dom.hudScale.textContent = '1 px = ' + fmtSpan(span / Math.max(1, size.width));
    const now = nowT();
    dom.hudNow.hidden = !(now >= v.start && now <= v.end);
    const tRead = lastMouseX !== null ? pxToT(lastMouseX - svgLeft(), v) : v.end;
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
      const ticks = HT.ticks.computeTicks(v.start, v.end, w, { labelWidth: measureTickLabel });
      const labelGap = (HT.ticks.DEFAULTS && HT.ticks.DEFAULTS.labelGap) || 12;
      let prevRight = -Infinity;                        // right edge of the last label actually drawn
      for (let i = 0; i < ticks.minor.length; i++) {
        const x = crisp(tToPx(ticks.minor[i], v));
        minor.appendChild(svgEl('line', { class: 'tick minor', x1: x, x2: x, y1: axisY, y2: axisY + 6 }));
      }
      for (let i = 0; i < ticks.major.length; i++) {
        const m = ticks.major[i];
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
    const maxTier = HT.tiers.MAX_TIER;
    const base = HT.tiers.tierForSpan(span);
    const counts = [];
    for (let k = 0; k <= maxTier; k++) counts.push(0);
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (hiddenCats.has(ev.category) || (ev.group && reignsActive())) continue;
      const tEnd = hasEnd(ev) ? ev.end : ev.t;
      if (tEnd < v.start || ev.t > v.end) continue;
      counts[clamp(ev.tier, 0, maxTier)]++;
    }
    let n = 0;
    for (let k = 0; k <= base; k++) n += counts[k];
    let tier = base;
    while (n < MIN_VISIBLE && tier < maxTier) { tier++; n += counts[tier]; }
    return tier;
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

    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (ev.tier > tierLimit || hiddenCats.has(ev.category) || (ev.group && reignsActive())) continue;
      const ranged = hasEnd(ev);
      const tEnd = ranged ? ev.end : ev.t;
      if (tEnd < v.start || ev.t > v.end) continue;
      inWindow++;

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
      items.push({ x0: Math.min(lx0, stemX - 2), x1: Math.max(lx1, stemX + 2), priority: ev.tier });
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
      const color = colors[ev.category] || 'currentColor';
      const g = svgEl('g', {
        class: 'event cat-' + ev.category + ' tier-' + ev.tier + (m.ranged ? ' ranged' : ' point') +
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
    const label = cursorLabel(pxToT(px, shown), shown.end - shown.start);
    dom.cursorDate.textContent = label;
    if (dom.hudEarth) dom.hudEarth.textContent = earthReadout(pxToT(px, shown));
    updateCityReadout(pxToT(px, shown));
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
        i === 0 ? ROOT_CRUMB : HT.time.formatRange(e.start, e.end));
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
    dom.legend.replaceChildren(frag);
    dom.btnLegend.classList.toggle('filtered', hiddenCats.size > 0);
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
    const t = e.target && typeof e.target.closest === 'function' ? e.target.closest('button') : null;
    if (!t) return;
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
    dom.search.hidden = !open;
    dom.btnSearch.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!dom.legend.hidden) toggleLegend(false);
      dom.searchInput.value = '';
      searchHits = []; searchActive = -1;
      renderSearchResults();
      try { dom.searchInput.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    }
  }

  function chooseSearchHit(k) {
    const hit = searchHits[k];
    if (!hit) return;
    const ev = events()[hit.i];
    toggleSearch(false);
    if (hiddenCats.has(ev.category)) { hiddenCats.delete(ev.category); saveHidden(); renderLegend(); }
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
    dom.legend.hidden = !open;
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

  function openPanel(index) {
    const ev = events()[index];
    if (!ev) return;
    selected = index;
    const cat = String(ev.category || '');
    const colors = (HT.tiers && HT.tiers.COLORS) || {};
    dom.panelCategory.textContent = cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '';
    dom.panelCategory.className = cat ? 'cat-' + cat : '';
    dom.panelCategory.dataset.category = cat;
    dom.panelTitle.textContent = ev.title;
    dom.panelDate.textContent = eventDateLabel(ev);
    dom.panelDetail.textContent = ev.detail || '';
    updatePanelMap(ev);
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
    if (wasHidden) afterLayoutChange();
    try { dom.panel.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
  }

  function closePanel() {
    if (!dom || dom.panel.hidden) return;
    dom.panel.hidden = true;
    document.body.classList.remove('panel-open');
    const was = selected >= 0 ? dom.svg.querySelector('.event[data-index="' + selected + '"]') : null;
    if (was) { try { was.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
    selected = -1;
    markSelected();
    afterLayoutChange();
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
        const v = gesture.view;
        const dt = (e.clientX - gesture.x0) / size.width * (v.end - v.start);
        commit({ start: v.start - dt, end: v.end - dt },
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
    if (closestEvent(e.target)) e.stopPropagation();
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
      t1: pxToT(a.x - left, shown), t2: pxToT(b.x - left, shown)
    };
  }

  // Keep the t under each finger fixed: solve the linear px = (t - start) * scale.
  function updatePinch() {
    const g = gesture;
    const pa = pointers.get(g.ids[0]);
    const pb = pointers.get(g.ids[1]);
    if (!pa || !pb) return;
    const left = svgLeft();
    const q1 = pa.x - left;
    const q2 = pb.x - left;
    if (Math.abs(q2 - q1) < 10 || g.t2 === g.t1) return;
    const scale = (q2 - q1) / (g.t2 - g.t1);           // px per year
    if (!(scale > 0)) return;                           // fingers crossed
    const start = g.t1 - q1 / scale;
    commit({ start: start, end: start + size.width / scale },
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
    const left = svgLeft();
    const tc = pxToT(e.clientX - left, v);
    let f = 1;
    let panPx = dx;
    if (e.shiftKey && !e.ctrlKey) panPx += dy;
    else f = clamp(Math.exp(dy * (e.ctrlKey ? PINCH_K : WHEEL_K)), 0.5, 2);
    let start = tc - (tc - v.start) * f;
    let end = tc + (v.end - tc) * f;
    const dt = panPx / size.width * (end - start);
    start += dt;
    end += dt;
    commit({ start: start, end: end }, { animate: false, url: 'replace', stack: 'replace', discrete: false });
    updateCursor(e.clientX);
  }

  // --- Keyboard ---
  function onKeyDown(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    const tag = el && el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
    switch (e.key) {
      case '/':
        toggleSearch(true);
        e.preventDefault();
        break;
      case 'Escape':
        if (dom.search && !dom.search.hidden) { toggleSearch(false); e.preventDefault(); }
        else if (!dom.panel.hidden) { closePanel(); e.preventDefault(); }
        else if (!dom.legend.hidden) { toggleLegend(false); e.preventDefault(); }
        else hideTooltip();
        break;
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
    svg.replaceChildren(dom.gMinor, dom.gMajor, dom.gEarth, dom.gLabels, dom.gAxis, dom.gNow, dom.gReigns, dom.gEvents, dom.gCursor, gMeasure);

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
      panelMap: $('panel-map'), panelMapSvg: $('panel-map-svg'), panelMapCap: $('panel-map-cap')
    };
    NOW = HT.time.now();
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
    try { reignsOn = root.localStorage.getItem(REIGNS_KEY) !== '0'; } catch (err) { /* ignore */ }
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
    THEMES: THEMES.slice()
  };
})(typeof window !== 'undefined' ? window : globalThis);
