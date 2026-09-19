// HT.app, part 40: Axis and ticks.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Axis and ticks ---
  function renderTicks(v, axisY) {
    const w = size.width;
    const minor = document.createDocumentFragment();
    const major = document.createDocumentFragment();
    const labels = document.createDocumentFragment();
    if (HT.ticks && typeof HT.ticks.computeTicks === 'function') {
      // A mostly warped view gets round ages and years placed by the warp; anything else the usual ladder.
      const ticks = warped(v) >= 0.5 ? C.logTicks(v, nowT(), w, scaleMode, measureTickLabel)
        : HT.ticks.computeTicks(v.start, v.end, w, { labelWidth: measureTickLabel });
      const labelGap = (HT.ticks.DEFAULTS && HT.ticks.DEFAULTS.labelGap) || 12;
      let prevRight = -Infinity;                        // right edge of the last label actually drawn
      const tMax = nowT() + 1e-9;                       // nothing is ticked past today
      for (let i = 0; i < ticks.minor.length; i++) {
        if (ticks.minor[i] > tMax) continue;
        const x = crisp(tToPx(ticks.minor[i], v));
        minor.appendChild(svgEl('line', { class: 'tick minor', x1: x, x2: x, y1: axisY, y2: axisY + 6 }));
      }
      for (let i = 0; i < ticks.major.length; i++) {
        const m = ticks.major[i];
        if (m.t > tMax) continue;
        const x = crisp(tToPx(m.t, v));
        major.appendChild(svgEl('line', { class: 'tick major', x1: x, x2: x, y1: axisY - 8, y2: axisY + 12 }));
        if (m.labeled) {
          const half = measureTickLabel(m.label) / 2;
          // Edge labels are nudged inside the view. That can undo the centred-label thinning done
          // by computeTicks, so re-check against the previous drawn label and drop on collision.
          const lx = half * 2 + EDGE_PAD * 2 < w ? clamp(x, half + EDGE_PAD, w - half - EDGE_PAD) : x;
          if (lx - half < prevRight + labelGap) continue;
          prevRight = lx + half;
          labels.appendChild(svgEl('text', { class: 'tick-label', x: lx, y: axisY + 28, 'text-anchor': 'middle' }, m.label));
        }
      }
    }
    dom.gMinor.replaceChildren(minor);
    dom.gMajor.replaceChildren(major);
    dom.gLabels.replaceChildren(labels);
    dom.gAxis.replaceChildren(svgEl('line', { class: 'axis', x1: 0, x2: w, y1: crisp(axisY), y2: crisp(axisY) }));
  }

  // Base visibility comes from the tier table; when a window is sparse (deep prehistory, or a
  // narrow slice of an eventful era) lower tiers are admitted until MIN_VISIBLE events are in view
  // or the tiers run out. Lane packing still trims whatever does not fit.
  function effectiveTier(list, v, span) {
    return C.effectiveTier(list, v, HT.tiers.tierForSpan(span), HT.tiers.MAX_TIER, MIN_VISIBLE, function (ev, i) {
      return !ev.life && !(ev.otd && !otdShown(v)) && passesFilters(ev, i) && !(ev.group && rowsActive());
    });
  }
