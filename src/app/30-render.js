// HT.app, part 30: Render loop and stage measurement.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

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
