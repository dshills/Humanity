// HT.app, part 52: On this day: the opt-in day-by-day layer.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

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
