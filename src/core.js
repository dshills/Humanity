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
  // Scale. Narrow views are linear in time. On the widest ones a linear axis leaves all of recorded history in
  // the last 2% of the width, so there the axis is warped: position follows -log10(age + WARP_C), which is
  // close to linear for ages well under WARP_C years and logarithmic beyond. The warp fades in between spans of
  // WARP_LO and WARP_HI years, so click-zooming from the root is back on a linear axis within two steps.
  // Any part of a view that lies past `now` (the Today margin) keeps its linear share of the width.
  // Positions are fractions u of the stage width: 0 at the view's start, 1 at its end, and defined outside
  // that range too, which is what lets gestures be expressed as "show the stretch from u = a to u = b".
  // ------------------------------------------------------------------
  const WARP_C = 2000;
  const WARP_LO = 60000;
  const WARP_HI = 120000;

  function warpWeight(span, mode) {
    if (mode === 'lin' || !(span > WARP_LO)) return 0;
    if (span >= WARP_HI) return 1;
    const x = (span - WARP_LO) / (WARP_HI - WARP_LO);
    return x * x * (3 - 2 * x);
  }

  function tToU(t, v, now, mode) {
    const span = v.end - v.start;
    const lin = (t - v.start) / span;
    const w = warpWeight(span, mode);
    if (w === 0) return lin;
    const F = function (x) { return -Math.log10(now - x + WARP_C); };
    const tEnd = Math.min(v.end, now);
    const phi = (v.end - tEnd) / span;                    // share of the view that is the future
    const g = (F(Math.min(t, now)) - F(v.start)) / (F(tEnd) - F(v.start));
    const warped = (1 - phi) * g + Math.max(0, t - now) / span;
    return lin + w * (warped - lin);
  }

  // Inverse of tToU. Closed form when the view is linear, bisection otherwise (the map is strictly increasing).
  function uToT(u, v, now, mode) {
    const span = v.end - v.start;
    if (warpWeight(span, mode) === 0) return v.start + u * span;
    let lo = v.start - 50 * span;
    let hi = v.end + 50 * span;
    if (u <= tToU(lo, v, now, mode)) return lo;
    if (u >= tToU(hi, v, now, mode)) return hi;
    for (let i = 0; i < 64; i++) {
      const mid = (lo + hi) / 2;
      if (tToU(mid, v, now, mode) < u) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // The view that shows the stretch of `v` between fractions a and b of its width.
  function viewFromU(a, b, v, now, mode) {
    return { start: uToT(a, v, now, mode), end: uToT(b, v, now, mode) };
  }

  // A view's warp depends on its own span, so the view cut out of another one does not quite keep a date where
  // it was on screen. Slide it until `tAnchor` sits at fraction `uAnchor` again (a no-op on linear views).
  function anchorView(v, tAnchor, uAnchor, now, mode) {
    for (let i = 0; i < 6; i++) {
      if (!(v.end > v.start)) break;
      const off = tToU(tAnchor, v, now, mode) - uAnchor;
      if (Math.abs(off) < 1e-5) break;
      v = viewFromU(off, 1 + off, v, now, mode);
    }
    return v;
  }

  // The one view resting on the present that has `tAnchor` at fraction `uAnchor` of its width, or null when
  // there is none inside the root. Zooming in from the log overview onto recent times needs it: once the warp
  // fades, no view of the requested span can keep a recent date that far from the right edge, and clamping a
  // view that tries would slide the target away from the pointer. Widening a view that ends at now moves every
  // date to the right.
  function viewAtNowWithAnchor(tAnchor, uAnchor, now, mode) {
    if (!(tAnchor < now) || !(uAnchor > 0) || !(uAnchor < 1 - FUTURE_FRAC)) return null;
    const rootStart = HT.time.ROOT_START;
    const make = function (start) { return { start: Math.max(rootStart, start), end: endAtNow(Math.max(rootStart, start), now) }; };
    const uAt = function (start) { return tToU(tAnchor, make(start), now, mode); };
    // Walk outwards from the narrowest view that holds the anchor (where it sits at the left edge) until it has
    // moved right past uAnchor, then bisect between the last two starts. Across the warp transition the position
    // is not guaranteed to be monotonic, so the first crossing, the narrowest such view, is the one taken.
    let inner = tAnchor - MIN_SPAN;
    let age = Math.max(now - tAnchor, MIN_SPAN);
    for (let k = 0; k < 400; k++) {
      age *= 1.1;
      const outer = now - age;
      if (uAt(outer) >= uAnchor) {
        let lo = outer; let hi = inner;
        for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (uAt(mid) >= uAnchor) lo = mid; else hi = mid; }
        return make((lo + hi) / 2);
      }
      if (outer <= rootStart) break;
      inner = outer;
    }
    return null;
  }

  // Ticks for a warped view: round ages and round calendar years, thinned so labels never touch. Same shape as
  // HT.ticks.computeTicks: { major: [{ t, label, labeled }], minor: [t] }. `measure(label)` gives a width in px.
  function logTicks(v, now, width, mode, measure) {
    const T = HT.time;
    const cands = [];
    const ages = [[500000, 2], [300000, 1], [200000, 1], [100000, 0], [50000, 1], [20000, 1], [10000, 0]];
    for (let i = 0; i < ages.length; i++) cands.push({ t: T.ya(ages[i][0]), rank: ages[i][1], label: T.formatAgo(T.ya(ages[i][0])) });
    const years = [[-4999, 1], [-2999, 0], [-1999, 2], [-999, 1], [1, 0], [500, 2], [1000, 1], [1500, 1], [1800, 2], [1900, 2], [2000, 1]];
    for (let i = 0; i < years.length; i++) cands.push({ t: years[i][0], rank: years[i][1], label: T.formatYear(years[i][0]) });
    const gap = 14;
    const live = cands.filter(function (c) { return c.t >= v.start && c.t <= Math.min(v.end, now); });
    for (let i = 0; i < live.length; i++) {
      live[i].x = tToU(live[i].t, v, now, mode) * width;
      live[i].half = (measure ? measure(live[i].label) : live[i].label.length * 7) / 2;
    }
    const placed = [];
    live.slice().sort(function (a, b) { return a.rank - b.rank || a.t - b.t; }).forEach(function (c) {
      const x0 = Math.max(0, c.x - c.half); const x1 = Math.min(width, c.x + c.half);
      for (let k = 0; k < placed.length; k++) if (x0 < placed[k][1] + gap && x1 > placed[k][0] - gap) return;
      placed.push([x0, x1]);
      c.labeled = true;
    });
    live.sort(function (a, b) { return a.t - b.t; });
    return {
      major: live.filter(function (c) { return c.labeled; }).map(function (c) { return { t: c.t, label: c.label, labeled: true }; }),
      minor: live.filter(function (c) { return !c.labeled; }).map(function (c) { return c.t; })
    };
  }

  // ------------------------------------------------------------------
  // URL hash: #s=<start>&e=<end|now>&m=<theme>&ev=<slug>&tour=<id>.<step>, up to 9 decimals, trailing zeros trimmed. A view at
  // the at-now limit writes the token "now", so a shared or reloaded link still rests on the present later on.
  // ------------------------------------------------------------------
  function fmtNum(x) {
    return String(Number(x.toFixed(HASH_DECIMALS)));
  }

  // `tour` is { id, step } with a zero-based step; it is written one-based, as tour=<id>.<n>.
  function encodeHash(v, now, theme, slug, tour, scale, from) {
    return '#s=' + fmtNum(v.start) + '&e=' + (atNow(v, now) ? 'now' : fmtNum(v.end)) +
      (theme && theme !== 'auto' ? '&m=' + theme : '') + (slug ? '&ev=' + slug : '') +
      (tour && tour.id ? '&tour=' + tour.id + '.' + (tour.step + 1) : '') + (scale === 'lin' ? '&sc=lin' : '') +
      (from ? '&from=' + from : '');
  }

  // { view | null, theme | '', ev | '', tour | null, scale: 'lin' | '' }: the view is null when s/e are missing or do not describe a span.
  function parseHash(hash, now) {
    const out = { view: null, theme: '', ev: '', tour: null, scale: '', from: '' };
    if (!hash || hash.length < 2) return out;
    const params = new URLSearchParams(String(hash).replace(/^#/, ''));
    out.theme = params.get('m') || '';
    out.ev = params.get('ev') || '';
    out.scale = params.get('sc') === 'lin' ? 'lin' : '';
    out.from = /^[a-z0-9-]{1,80}$/.test(params.get('from') || '') ? params.get('from') : '';
    const tm = /^([a-z0-9-]{1,40})\.(\d{1,3})$/.exec(params.get('tour') || '');
    if (tm && Number(tm[2]) >= 1) out.tour = { id: tm[1], step: Number(tm[2]) - 1 };
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

  // Indices of the events that fall on a calendar day in any year, oldest first. Only day-precise dates count:
  // an event known to the year sits on 1 January by convention, and one known to the month on the 1st of it,
  // so on the 1st of a month only on-this-day entries (which always carry a real date) are returned.
  // Rulers and ranged events are left out.
  function onCalendarDay(list, month, day) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (ev.group || ev.life || hasEnd(ev) || !(ev.t >= 1)) continue;
      if (day === 1 && !ev.otd) continue;
      const p = HT.time.toParts(ev.t);
      if (p.month === month && p.day === day) out.push(i);
    }
    return out.sort(function (x, y) { return list[x].t - list[y].t || x - y; });
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
      if (i === index || o.group || o.otd || o.life || o.tier > cap || (passes && !passes(o, i))) continue;
      const d = Math.abs(o.t - ev.t) * (curated && !curated(o, i) ? 3 : 1);
      (o.t < ev.t ? before : after).push({ i: i, d: d });
    }
    const byDistance = function (x, y) { return x.d - y.d || x.i - y.i; };
    const byTime = function (x, y) { return list[x].t - list[y].t || x - y; };
    const take = function (side) { return side.sort(byDistance).slice(0, 2).map(function (x) { return x.i; }).sort(byTime); };
    return take(before).concat(take(after));
  }

  // --- Measuring. The gap between two events is the time between their nearest ends: zero when one lies inside
  // the other or they overlap (a life and something that happened during it). ---
  function gapBetween(a, b) {
    const a0 = a.t; const a1 = hasEnd(a) ? a.end : a.t;
    const b0 = b.t; const b1 = hasEnd(b) ? b.end : b.t;
    if (a1 < b0) return b0 - a1;
    if (b1 < a0) return a0 - b1;
    return 0;
  }

  function fmtDuration(years) {
    const y = Math.abs(years);
    if (y < 1.5 / 365) return 'less than a day';
    if (y < 60 / 365) return Math.round(y * 365) + ' days';
    if (y < 2) return Math.round(y * 12) + ' months';
    return Math.round(y).toLocaleString('en-US') + ' years';
  }

  // What to say about two events. `gap` in years, `earlier`/`later` as indices, and up to two comparison lines of
  // the kind "X is closer in time to Y than to Z": for the earlier event, the best-known landmark before it that
  // is nevertheless further away than the later event; for the later one, the same looking forward, or today.
  // Landmarks are hand-curated point events of tier 0-2 (`curated(ev, i)`), the nearest qualifying one being the
  // most surprising. Returns { gap, earlier, later, lines: [string] }.
  function measureFacts(list, i, j, now, curated) {
    const A = list[i]; const B = list[j];
    if (!A || !B || i === j) return null;
    const first = A.t <= B.t ? i : j;
    const second = first === i ? j : i;
    const E = list[first]; const L = list[second];
    const gap = gapBetween(E, L);
    const out = { gap: gap, earlier: first, later: second, lines: [] };
    if (gap <= 0) { out.lines.push('They overlap in time.'); return out; }
    const name = function (ev) { return '\u201c' + ev.title + '\u201d'; };
    let before = -1; let after = -1;
    for (let k = 0; k < list.length; k++) {
      const o = list[k];
      if (k === i || k === j || o.group || o.life || o.otd || o.tier > 2 || (curated && !curated(o, k))) continue;
      const dBefore = gapBetween(o, E);
      if (o.t < E.t && dBefore > gap && (before < 0 || dBefore < gapBetween(list[before], E))) before = k;
      const dAfter = gapBetween(L, o);
      if (o.t > L.t && dAfter > gap && (after < 0 || dAfter < gapBetween(L, list[after]))) after = k;
    }
    if (before >= 0) out.lines.push(name(E) + ' is closer in time to ' + name(L) + ' than to ' + name(list[before]) + ', ' + fmtDuration(gapBetween(list[before], E)) + ' before it.');
    const lEnd = hasEnd(L) ? L.end : L.t;
    if (after >= 0) out.lines.push(name(L) + ' is closer to ' + name(E) + ' than to ' + name(list[after]) + ', ' + fmtDuration(gapBetween(L, list[after])) + ' after it.');
    else if (now - lEnd > gap) out.lines.push(name(L) + ' is closer to ' + name(E) + ' than to today, ' + fmtDuration(now - lEnd) + ' on.');
    else if (now - lEnd < gap && now - lEnd > 0) out.lines.push(name(L) + ' is closer to today (' + fmtDuration(now - lEnd) + ') than to ' + name(E) + '.');
    return out;
  }

  // "Your lifetime": a tour made on the spot from a birth year. The first step frames the whole life; the rest
  // are up to nine events spread across it, one per equal slice of the years, each slice giving its most
  // significant event (lowest tier, hand-curated before generated, then nearest the middle of the slice).
  // Returns { steps: [{ view } | { ev, note }], count } where count is every event on record since the birth.
  function lifetimeTour(list, birthYear, now, curatedCount) {
    const out = { steps: [], count: 0 };
    if (!Number.isFinite(birthYear) || !(birthYear < now)) return out;
    const start = Math.floor(birthYear);
    const years = now - start;
    const pool = [];
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (ev.group || ev.life || ev.otd || ev.t < start || ev.t > now) continue;
      out.count++;
      if (ev.tier <= 5) pool.push(i);
    }
    const pad = Math.max(1, years * 0.06);
    out.steps.push({ view: { start: start - pad, end: endAtNow(start - pad, now) }, note: '' });
    const slices = Math.max(1, Math.min(9, Math.floor(years / 2)));
    const taken = new Set();
    for (let k = 0; k < slices; k++) {
      const a = start + (years * k) / slices;
      const b = start + (years * (k + 1)) / slices;
      let best = -1; let bestScore = Infinity;
      for (let j = 0; j < pool.length; j++) {
        const i = pool[j]; const ev = list[i];
        if (taken.has(i) || ev.t < a || ev.t >= b) continue;
        const score = ev.tier * 10 + (i < curatedCount ? 0 : 5) + Math.abs(ev.t - (a + b) / 2) / (b - a);
        if (score < bestScore) { bestScore = score; best = i; }
      }
      if (best < 0) continue;
      taken.add(best);
      const age = Math.floor(list[best].t - start);
      out.steps.push({ ev: list[best].title, note: age < 1 ? 'This happened in the year you were born.' : 'You were about ' + age + ' when this happened.' });
    }
    return out;
  }

  // For a life: up to `n` other lives that overlapped it by five years or more, the most prominent first
  // (lower tier, then longer overlap), returned in order of birth.
  function pickContemporaries(list, index, n) {
    const ev = list[index];
    if (!ev || !ev.life || !hasEnd(ev)) return [];
    const pool = [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (i === index || !o.life || !hasEnd(o)) continue;
      const overlap = Math.min(ev.end, o.end) - Math.max(ev.t, o.t);
      if (overlap >= 5) pool.push({ i: i, tier: o.tier, overlap: overlap });
    }
    pool.sort(function (a, b) { return a.tier - b.tier || b.overlap - a.overlap || a.i - b.i; });
    return pool.slice(0, n || 5).map(function (x) { return x.i; }).sort(function (a, b) { return list[a].t - list[b].t || a - b; });
  }

  // Three nearest events of the same category, in time order; distance counts six-fold outside the event's region.
  function pickRelated(list, index, exclude, regionAt) {
    const ev = list[index];
    if (!ev || ev.group || ev.otd || ev.life) return [];
    const region = regionAt ? regionAt(index) : '';
    const pool = [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (i === index || (exclude && exclude.indexOf(i) >= 0) || o.group || o.otd || o.life || o.category !== ev.category || o.tier > Math.max(ev.tier + 2, 5)) continue;
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
    WARP_LO: WARP_LO, WARP_HI: WARP_HI, warpWeight: warpWeight, tToU: tToU, uToT: uToT, viewFromU: viewFromU, anchorView: anchorView, viewAtNowWithAnchor: viewAtNowWithAnchor, logTicks: logTicks,
    fmtNum: fmtNum, encodeHash: encodeHash, parseHash: parseHash, slugify: slugify,
    regionOf: regionOf, officeRegion: officeRegion, mmU: mmU, mmX: mmX, mmT: mmT, effectiveTier: effectiveTier,
    otdDays: otdDays, onCalendarDay: onCalendarDay, otdRows: otdRows, otdMainTitle: otdMainTitle, otdEvents: otdEvents, wikiUrl: wikiUrl, clipWords: clipWords,
    fmtGap: fmtGap, trimExtract: trimExtract, yearArticle: yearArticle, pickNearby: pickNearby, pickRelated: pickRelated, gapBetween: gapBetween, fmtDuration: fmtDuration, measureFacts: measureFacts, pickContemporaries: pickContemporaries, lifetimeTour: lifetimeTour
  };
})(typeof window !== 'undefined' ? window : globalThis);
