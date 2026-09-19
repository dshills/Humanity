// HT.app, part 36: Recorded-history bracket and HUD telemetry.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

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
