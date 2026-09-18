(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});

  // Pure logic behind src/app.js: view limits, the URL hash, regions, slugs, the overview scale, "on this day"
  // parsing and the panel's neighbour lists. Nothing here touches the DOM, storage, the network or a clock:
  // "now" is always passed in, so every function can be exercised from Node (test/core.test.js).

  const MIN_SPAN = 1 / 365;            // one calendar day
  const FUTURE_FRAC = 0.035;           // share of a view that may lie past today
  const HASH_DECIMALS = 9;
  const EPS = 5e-10;                   // equality at URL precision
  const OTD_MAX_SPAN = 35 / 365;       // about a month: the widest view that loads "on this day" lists
  const WIKI_PREFIX = 'https://en.wikipedia.org/wiki/';

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // ------------------------------------------------------------------
  // Views. A view may run a little past the present so "today" is a visible line instead of the clipped right
  // edge: up to FUTURE_FRAC of its own span. A view resting on that limit is "at now".
  // ------------------------------------------------------------------
  function maxEnd(span, now) { return now + FUTURE_FRAC * span; }
  function endAtNow(start, now) { return (now - FUTURE_FRAC * start) / (1 - FUTURE_FRAC); }
  function atNow(v, now) { return Math.abs(v.end - maxEnd(v.end - v.start, now)) < EPS; }

  function rootView(now) {
    return { start: HT.time.ROOT_START, end: endAtNow(HT.time.ROOT_START, now) };
  }

  function sameView(a, b) {
    return !!a && !!b && Math.abs(a.start - b.start) < EPS && Math.abs(a.end - b.end) < EPS;
  }

  function contains(outer, inner) {
    return outer.start - EPS <= inner.start && inner.end <= outer.end + EPS;
  }

  // Clamp a candidate view to [ROOT_START, the at-now limit] with span in [1 day, root span].
  function clampView(start, end, now) {
    const r = rootView(now);
    const rootSpan = r.end - r.start;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return r;
    // Snap edges that sit within a hair of the root start, or within an hour of the at-now limit, onto them,
    // so a view written by an earlier page load (when "now" was a little earlier) still rests on the present.
    // Anything further out is an overhang, which is shifted back inside below: trimming it instead would
    // shrink the span, and a drag against either end of time would zoom in rather than stop.
    if (Math.abs(start - r.start) < 1e-6) start = r.start;
    if (Math.abs(end - maxEnd(end - start, now)) < MIN_SPAN / 24) end = endAtNow(start, now);
    let span = end - start;
    if (!(span > 0)) span = MIN_SPAN;
    if (span >= rootSpan - 1e-9) return r;
    if (span < MIN_SPAN) span = MIN_SPAN;
    const c = (start + end) / 2;
    start = c - span / 2;
    end = c + span / 2;
    if (start < r.start) { start = r.start; end = start + span; }
    if (end > maxEnd(span, now)) { end = maxEnd(span, now); start = end - span; }
    return { start: start, end: end };
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

  function hasEnd(ev) {
    return Number.isFinite(ev.end) && ev.end > ev.t;
  }

  // The window "Zoom to this event" aims for. Ranged: [t, end] with 15% padding each side. Point: a tenth of
  // the tier's span, capped for recent events at 8% of their age (at least a decade) so Apollo 11 lands in the
  // 1960s, not in a 10,000-year view. On-this-day events only exist on views of a month or less, so they get 20 days.
  function eventWindow(ev, now, tierSpan) {
    if (hasEnd(ev)) {
      const pad = (ev.end - ev.t) * 0.15;
      return { start: ev.t - pad, end: ev.end + pad };
    }
    const span = ev.otd ? 20 / 365 : Math.max(MIN_SPAN, Math.min(tierSpan / 10, Math.max(10, (now - ev.t) * 0.08)));
    return { start: ev.t - span / 2, end: ev.t + span / 2 };
  }

  // ------------------------------------------------------------------
  // URL hash: #s=<start>&e=<end|now>&m=<theme>&ev=<slug>, up to 9 decimals, trailing zeros trimmed. A view at
  // the at-now limit writes the token "now", so a shared or reloaded link still rests on the present later on.
  // ------------------------------------------------------------------
  function fmtNum(x) {
    return String(Number(x.toFixed(HASH_DECIMALS)));
  }

  function encodeHash(v, now, theme, slug) {
    return '#s=' + fmtNum(v.start) + '&e=' + (atNow(v, now) ? 'now' : fmtNum(v.end)) +
      (theme && theme !== 'auto' ? '&m=' + theme : '') + (slug ? '&ev=' + slug : '');
  }

  // { view | null, theme | '', ev | '' }: the view is null when s/e are missing or do not describe a span.
  function parseHash(hash, now) {
    const out = { view: null, theme: '', ev: '' };
    if (!hash || hash.length < 2) return out;
    const params = new URLSearchParams(String(hash).replace(/^#/, ''));
    out.theme = params.get('m') || '';
    out.ev = params.get('ev') || '';
    const s = parseFloat(params.get('s'));
    const e = params.get('e') === 'now' ? (Number.isFinite(s) ? endAtNow(s, now) : NaN) : parseFloat(params.get('e'));
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) out.view = clampView(s, e, now);
    return out;
  }

  // ------------------------------------------------------------------
  // Slugs: lowercase ASCII with dashes, 64 characters at most, never ending in a dash.
  // ------------------------------------------------------------------
  function slugify(title) {
    let t = String(title || '').toLowerCase();
    if (typeof t.normalize === 'function') t = t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 64).replace(/-+$/, '') || 'event';
  }

  // ------------------------------------------------------------------
  // Regions: coarse boxes over lat/lon, first match wins. Good enough for a filter, not for geography.
  // ------------------------------------------------------------------
  const REGIONS = [
    ['africa', 'Africa'], ['europe', 'Europe'], ['asia', 'Asia'], ['namerica', 'N. America'], ['samerica', 'S. America'], ['oceania', 'Oceania']
  ];
  const REGION_BOXES = {   // [latMin, latMax, lonMin, lonMax], drawn on the legend map
    africa: [[-36, 37.5, -19, 52]], europe: [[35, 72, -25, 45]], asia: [[-11, 78, 45, 180], [12, 42, 34, 63]],
    namerica: [[7, 84, -170, -50]], samerica: [[-56, 13, -82, -34]], oceania: [[-50, 0, 110, 180], [-30, 25, -180, -130], [0, 21, 130, 180], [-28, -26, -110, -108]]
  };
  const OFFICE_REGION = [
    [/tlatoani/, 'namerica'],
    [/pharaoh|Egypt|Ethiopia|Benin/, 'africa'],
    [/Japan|China|Chinese|Mughal|India|khagan|Assyria|Babylon|Abbasid|Ottoman/, 'asia'],
    [/United States/, 'namerica'],
    [/Inca/, 'samerica'],
    [/./, 'europe']
  ];

  function regionOf(lat, lon) {
    if (lat >= 12 && lat <= 42 && lon >= 34 && lon <= 63) return 'asia';                 // Middle East before Africa
    if (lat >= 35 && lat <= 72 && lon >= -25 && lon < 45) return 'europe';
    if (lat >= -36 && lat < 37.5 && lon >= -19 && lon <= 52) return 'africa';
    if (lon >= 110 && lat >= -50 && lat < -10) return 'oceania';
    if (lon >= 140 && lat >= -12 && lat < 0) return 'oceania';                            // New Guinea
    if (lon <= -130 && lat >= -30 && lat <= 25) return 'oceania';                         // Polynesia, Hawaii
    if (lon >= -110 && lon <= -108 && lat >= -28 && lat <= -26) return 'oceania';         // Rapa Nui, far east of the rest
    if (lon >= 130 && lat >= 0 && lat <= 21) return 'oceania';                            // Micronesia, before Asia claims it
    if (lon >= 45 && lat >= -11 && lat <= 78) return 'asia';
    if (lon >= -82 && lon <= -34 && lat >= -56 && lat < 12.5) return 'samerica';
    if (lon >= -170 && lon <= -50 && lat >= 7 && lat <= 84) return 'namerica';
    return '';
  }

  // Rulers carry no coordinates: place them by the name of their office.
  function officeRegion(group) {
    const g = String(group || '');
    if (!g) return '';
    for (let k = 0; k < OFFICE_REGION.length; k++) if (OFFICE_REGION[k][0].test(g)) return OFFICE_REGION[k][1];
    return '';
  }

  // ------------------------------------------------------------------
  // Overview strip: years before now on a log scale, so the last few thousand years get real width.
  // ------------------------------------------------------------------
  function mmU(t, now) { return Math.log10(Math.max(1, now - t + 1)); }
  function mmX(t, w, now) { return (1 - mmU(t, now) / mmU(HT.time.ROOT_START, now)) * w; }
  function mmT(x, w, now) { return now + 1 - Math.pow(10, (1 - clamp(x / w, 0, 1)) * mmU(HT.time.ROOT_START, now)); }

  // ------------------------------------------------------------------
  // Tiers: base visibility comes from the tier table; when a window is sparse lower tiers are admitted until
  // `minVisible` events are in view or the tiers run out. `include(ev, i)` applies the caller's filters.
  // ------------------------------------------------------------------
  function effectiveTier(list, v, base, maxTier, minVisible, include) {
    const counts = [];
    for (let k = 0; k <= maxTier; k++) counts.push(0);
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (include && !include(ev, i)) continue;
      const tEnd = hasEnd(ev) ? ev.end : ev.t;
      if (tEnd < v.start || ev.t > v.end) continue;
      counts[clamp(ev.tier, 0, maxTier)]++;
    }
    let n = 0;
    for (let k = 0; k <= base; k++) n += counts[k];
    let tier = base;
    while (n < minVisible && tier < maxTier) { tier++; n += counts[tier]; }
    return tier;
  }

  // ------------------------------------------------------------------
  // On this day
  // ------------------------------------------------------------------
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Calendar days ('MM/DD') touched by [start, end], nearest the centre first. Nothing before 1 CE or after now.
  function otdDays(start, end, now) {
    const T = HT.time;
    const a = Math.max(1, start);
    const b = Math.min(end, now);
    if (!(b >= a)) return [];
    const mid = (a + b) / 2;
    const seen = new Map();
    for (let t = a; t <= b + 1 / 366; t += 1 / 366) {
      const p = T.toParts(Math.min(t, b));
      const key = pad2(p.month) + '/' + pad2(p.day);
      if (!seen.has(key)) seen.set(key, Math.abs(t - mid));
    }
    return Array.from(seen.keys()).sort(function (x, y) { return seen.get(x) - seen.get(y); });
  }

  // [year, text, [article titles]] rows from the feed's JSON; everything else in the 600 KB response is dropped.
  function otdRows(json) {
    const out = [];
    const list = json && Array.isArray(json.events) ? json.events : [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const year = Number(e && e.year);
      const text = e && typeof e.text === 'string' ? e.text.replace(/\s+/g, ' ').trim() : '';
      if (!Number.isInteger(year) || year < 1 || text.length < 12) continue;
      const titles = [];
      const pages = Array.isArray(e.pages) ? e.pages : [];
      for (let k = 0; k < pages.length && titles.length < 6; k++) {
        const c = pages[k] && pages[k].titles && pages[k].titles.canonical;
        if (typeof c === 'string' && c && titles.indexOf(c) < 0) titles.push(c);
      }
      out.push([year, text.slice(0, 400), titles]);
    }
    return out;
  }

  function wikiUrl(title) {
    return WIKI_PREFIX + encodeURIComponent(title).replace(/%2F/gi, '/').replace(/%3A/gi, ':').replace(/%2C/gi, ',');
  }

  // The sentence's first link is often a person or a country; prefer the article that is about the event.
  function otdMainTitle(titles, year) {
    const eventish = /battle|siege|war\b|treaty|act\b|revolt|revolution|rebellion|massacre|coup|crisis|election|earthquake|eruption|flight|disaster|bombing|attack|expedition|conference|congress|accord|agreement|mission|launch|assassination|coronation|trial|riots?|strike|summit|games/i;
    for (let i = 0; i < titles.length; i++) if (titles[i].indexOf(String(year)) >= 0) return titles[i];
    for (let i = 0; i < titles.length; i++) if (eventish.test(titles[i].replace(/_/g, ' '))) return titles[i];
    return titles[0] || '';
  }

  function clipWords(text, n) {
    if (text.length <= n) return text.replace(/[.\s]+$/, '');
    return text.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[,;:.\s]+$/, '') + '\u2026';
  }

  // Events for one cached day. `known(titles, t)` says a bundled event already covers the entry.
  function otdEvents(key, rows, now, maxTier, known) {
    const month = Number(key.slice(0, 2));
    const day = Number(key.slice(3, 5));
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const year = rows[i][0];
      const text = rows[i][1];
      const titles = rows[i][2] || [];
      if (month === 2 && day === 29 && !HT.time.isLeap(year)) continue;
      const t = HT.time.ymd(year, month, day);
      if (t > now || (known && known(titles, t))) continue;
      const main = otdMainTitle(titles, year);
      out.push({
        t: t, title: clipWords(text, 72), detail: text, tier: maxTier, category: 'daily', otd: true,
        link: main ? wikiUrl(main) : undefined,
        links: titles.filter(function (x) { return x !== main; }).map(function (x) { return { title: x.replace(/_/g, ' '), url: wikiUrl(x) }; })
      });
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Panel
  // ------------------------------------------------------------------
  function fmtGap(dt) {
    const a = Math.abs(dt);
    let text;
    if (a < 1.5 / 365) return 'the same day';
    if (a < 60 / 365) text = Math.round(a * 365) + ' days';
    else if (a < 2) text = Math.round(a * 12) + ' months';
    else text = Math.round(a).toLocaleString('en-US') + ' years';
    return text + (dt < 0 ? ' earlier' : ' later');
  }

  // The article's opening paragraph cut to whole sentences within about 560 characters.
  function trimExtract(text) {
    text = String(text || '');
    if (text.length <= 560) return text;
    const cut = text.slice(0, 560);
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
    return stop > 200 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '\u2026';
  }

  // Wikipedia's article for a historical year, back to about 800 BCE ('' before that): "1969", "AD 66", "44 BC".
  function yearArticle(hy) {
    if (!(hy >= -800) || hy === 0) return '';
    return hy >= 101 ? String(hy) : hy >= 1 ? 'AD_' + hy : Math.abs(hy) + '_BC';
  }

  // Indices of the events either side of list[index]. A reign gets the previous and next holder of its office.
  // Anything else gets two before and two after of comparable weight (tier <= max(tier + 1, 4)), so a
  // landmark's neighbours are not simply the nearest tremor. Hand-curated events are preferred to generated
  // ones (a conflict's start date, a launch): `curated(ev, i)` marks them, and a generated event must be more
  // than three times closer in time to displace one. Without `curated`, distance alone decides.
  function pickNearby(list, index, passes, curated) {
    const ev = list[index];
    const near = [];
    if (!ev) return near;
    if (ev.group) {
      let prev = -1; let next = -1;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (i === index || o.group !== ev.group) continue;
        if (o.t < ev.t && (prev < 0 || o.t > list[prev].t)) prev = i;
        if (o.t > ev.t && (next < 0 || o.t < list[next].t)) next = i;
      }
      if (prev >= 0) near.push(prev);
      if (next >= 0) near.push(next);
      return near;
    }
    const cap = Math.max(ev.tier + 1, 4);
    const before = []; const after = [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (i === index || o.group || o.otd || o.tier > cap || (passes && !passes(o, i))) continue;
      const d = Math.abs(o.t - ev.t) * (curated && !curated(o, i) ? 3 : 1);
      (o.t < ev.t ? before : after).push({ i: i, d: d });
    }
    const byDistance = function (x, y) { return x.d - y.d || x.i - y.i; };
    const byTime = function (x, y) { return list[x].t - list[y].t || x - y; };
    const take = function (side) { return side.sort(byDistance).slice(0, 2).map(function (x) { return x.i; }).sort(byTime); };
    return take(before).concat(take(after));
  }

  // Three nearest events of the same category, in time order; distance counts six-fold outside the event's region.
  function pickRelated(list, index, exclude, regionAt) {
    const ev = list[index];
    if (!ev || ev.group || ev.otd) return [];
    const region = regionAt ? regionAt(index) : '';
    const pool = [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (i === index || (exclude && exclude.indexOf(i) >= 0) || o.group || o.otd || o.category !== ev.category || o.tier > Math.max(ev.tier + 2, 5)) continue;
      pool.push({ i: i, d: Math.abs(o.t - ev.t) * (region && regionAt(i) === region ? 1 : 6) });
    }
    pool.sort(function (x, y) { return x.d - y.d; });
    return pool.slice(0, 3).sort(function (x, y) { return list[x.i].t - list[y.i].t; }).map(function (x) { return x.i; });
  }

  HT.core = {
    MIN_SPAN: MIN_SPAN, FUTURE_FRAC: FUTURE_FRAC, OTD_MAX_SPAN: OTD_MAX_SPAN, WIKI_PREFIX: WIKI_PREFIX,
    REGIONS: REGIONS, REGION_BOXES: REGION_BOXES,
    clamp: clamp, maxEnd: maxEnd, endAtNow: endAtNow, atNow: atNow, rootView: rootView, sameView: sameView,
    contains: contains, clampView: clampView, fitInside: fitInside, hasEnd: hasEnd, eventWindow: eventWindow,
    fmtNum: fmtNum, encodeHash: encodeHash, parseHash: parseHash, slugify: slugify,
    regionOf: regionOf, officeRegion: officeRegion, mmU: mmU, mmX: mmX, mmT: mmT, effectiveTier: effectiveTier,
    otdDays: otdDays, otdRows: otdRows, otdMainTitle: otdMainTitle, otdEvents: otdEvents, wikiUrl: wikiUrl, clipWords: clipWords,
    fmtGap: fmtGap, trimExtract: trimExtract, yearArticle: yearArticle, pickNearby: pickNearby, pickRelated: pickRelated
  };
})(typeof window !== 'undefined' ? window : globalThis);
