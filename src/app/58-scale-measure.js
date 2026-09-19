// HT.app, part 58: Scale toggle and the measuring tool.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Scale: logarithmic on the widest views by default, or linear everywhere ---
  function setScale(mode, opts) {
    scaleMode = mode === 'lin' ? 'lin' : 'log';
    if (!(opts && opts.keep)) { try { root.localStorage.setItem(SCALE_KEY, scaleMode); } catch (err) { /* ignore */ } }
    updateScaleToggle();
    if (dom && shown) { settleNext = true; render(); if (!(opts && opts.keep) && view) writeUrl('replace'); }
  }

  // The toggle only shows where it changes anything: on views wide enough to be warped.
  function updateScaleToggle() {
    if (!dom || !dom.scaleToggle || !shown) return;
    const matters = shown.end - shown.start > C.WARP_LO;
    dom.scaleToggle.hidden = !matters;
    dom.scaleToggle.setAttribute('aria-pressed', String(scaleMode === 'log'));
    dom.scaleToggle.textContent = scaleMode === 'log' ? 'Scale \u00b7 log' : 'Scale \u00b7 linear';
  }

  // --- Measuring: pick one event, open another, and see the time between them with a comparison or two.
  // The anchor rides in the URL as from=<slug>, so a finding can be shared. ---
  function setMeasure(index) {
    measureFrom = index >= 0 && events()[index] ? index : -1;
    updateMeasureChip();
    if (selected >= 0 && !dom.panel.hidden) updatePanelMeasure(selected);
    if (shown) render();
    if (view) writeUrl('replace');
    announce(measureFrom >= 0 ? 'Measuring from ' + events()[measureFrom].title + '. Open another event to see the time between them.' : 'Stopped measuring.', 100);
  }

  function updateMeasureChip() {
    if (!dom.measureChip) return;
    dom.measureChip.hidden = measureFrom < 0;
    if (measureFrom >= 0) dom.measureChipText.textContent = 'Measuring from: ' + events()[measureFrom].title;
  }

  function updatePanelMeasure(index) {
    if (!dom.panelMeasure) return;
    const list = events();
    dom.measureLines.replaceChildren();
    dom.measureStop.hidden = measureFrom < 0;
    if (measureFrom < 0) {
      dom.measureGap.hidden = true;
      dom.measureStart.hidden = false;
      dom.measureStart.textContent = 'Measure from this event';
      return;
    }
    dom.measureGap.hidden = false;
    if (measureFrom === index) {
      dom.measureGap.textContent = 'Measuring from this event. Open any other event, or search for one, to see the time between them.';
      dom.measureStart.hidden = true;
      return;
    }
    const curatedCount = HT.curatedCount || 0;
    const facts = C.measureFacts(list, measureFrom, index, nowT(), curatedCount ? function (o, i) { return i < curatedCount; } : null);
    dom.measureStart.hidden = false;
    dom.measureStart.textContent = 'Measure from this one instead';
    if (!facts) { dom.measureGap.hidden = true; return; }
    const anchor = list[measureFrom].title;
    dom.measureGap.textContent = facts.gap > 0
      ? C.fmtDuration(facts.gap) + (facts.later === index ? ' after ' : ' before ') + '\u201c' + anchor + '\u201d'
      : 'At the same time as \u201c' + anchor + '\u201d';
    dom.measureLines.replaceChildren.apply(dom.measureLines, facts.lines.map(function (l) { return htmlEl('li', '', l); }));
    announce(dom.measureGap.textContent + '. ' + facts.lines.join(' '), 300);
  }

  // The span between the two events, drawn under the axis; an event off screen pins its end to that edge.
  function renderMeasure(v, axisY) {
    if (!dom.gSpan) return;
    const list = events();
    const a = measureFrom >= 0 ? list[measureFrom] : null;
    if (!a) { if (dom.gSpan.firstChild) dom.gSpan.replaceChildren(); return; }
    const w = size.width;
    const parts = [];
    const ax = tToPx(a.t, v);
    if (ax >= 0 && ax <= w) parts.push(svgEl('circle', { class: 'measure-anchor', cx: ax, cy: axisY, r: 10 }));
    const b = selected >= 0 && selected !== measureFrom && !dom.panel.hidden ? list[selected] : null;
    if (b) {
      const first = a.t <= b.t ? a : b; const second = first === a ? b : a;
      const gap = C.gapBetween(first, second);
      if (gap > 0) {
        const x0 = clamp(tToPx(hasEnd(first) ? first.end : first.t, v), -4, w + 4);
        const x1 = clamp(tToPx(second.t, v), -4, w + 4);
        const y = axisY + 38;
        if (x1 - x0 >= 2) {
          parts.push(svgEl('path', { class: 'measure-span', d: 'M' + x0 + ' ' + (y - 5) + ' V' + y + ' H' + x1 + ' V' + (y - 5) }));
          if (x1 - x0 >= 70) parts.push(svgEl('text', { class: 'measure-label', x: (Math.max(0, x0) + Math.min(w, x1)) / 2, y: y + 13, 'text-anchor': 'middle' }, C.fmtDuration(gap)));
        }
      }
    }
    dom.gSpan.replaceChildren.apply(dom.gSpan, parts);
  }
