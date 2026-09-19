// HT.app, part 20: View model: URL hash, breadcrumb stack, history, animation, commit().
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

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
