// HT.app, part 34: Earth layer: climate, population and the largest-city ribbon; the Today marker.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

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
