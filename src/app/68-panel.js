// HT.app, part 68: Panel map, tooltip and the detail panel.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

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
