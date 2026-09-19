// HT.app, part 66: Overview strip and the guide.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

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
