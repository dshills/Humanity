// HT.app, part 42: Events: tier selection, markers, labels and lanes.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Events: markers on the axis, labels packed into lanes stacked upward ---
  function renderEvents(v, axisY) {
    const w = size.width;
    const span = v.end - v.start;
    const list = events();
    const colors = (HT.tiers && HT.tiers.COLORS) || {};
    const maxLanes = clamp(Math.floor((axisY - LANE_TOP_PAD - reignReserve) / LANE_PITCH), 1, MAX_LANES);
    const maxLabelW = Math.max(60, Math.min(320, w * 0.6));
    const items = [];
    const meta = [];
    const tierLimit = effectiveTier(list, v, span);
    let inWindow = 0;
    const showOtd = otdShown(v);
    otdInView = 0;

    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (ev.life) continue;                              // lifespans live in their own layer
      if (ev.otd && (!showOtd || ev.t < v.start || ev.t > v.end)) continue;       // cheap checks first: there can be thousands
      // The open event is always drawn: it bypasses the tier ceiling here and takes the first lane below.
      if ((ev.tier > tierLimit && i !== selected) || !passesFilters(ev, i) || (ev.group && rowsActive())) continue;
      const ranged = hasEnd(ev);
      const tEnd = ranged ? ev.end : ev.t;
      if (tEnd < v.start || ev.t > v.end) continue;
      inWindow++;
      if (ev.otd) otdInView++;

      const x = tToPx(ev.t, v);
      const xEnd = ranged ? tToPx(tEnd, v) : x;
      const bx0 = clamp(x, 0, w);                       // on-screen extent of the marker/bar
      const bx1 = clamp(xEnd, 0, w);
      // Label to the right of the marker (or of the bar's visible left end); flip to the left
      // when it would overflow and the left side has room (or more room than the right). Whichever
      // side is used, the label is truncated to the room actually available so it never leaves the stage.
      const rightX = ranged ? bx0 + 2 : x + MARKER_R + LABEL_GAP;
      const leftX = ranged ? bx1 - 2 : x - MARKER_R - LABEL_GAP;
      const roomR = w - EDGE_PAD - rightX;
      const roomL = leftX - EDGE_PAD;
      const fullW = measureEventLabel(ev.title);
      let anchor = 'start';
      let ax = rightX;
      let room = roomR;
      if (fullW > roomR && (roomL >= Math.min(fullW, maxLabelW) || roomL > roomR)) {
        anchor = 'end';
        ax = leftX;
        room = roomL;
      }
      const text = fitLabel(ev.title, Math.max(24, Math.min(maxLabelW, room)));
      const lw = measureEventLabel(text);
      const lx0 = anchor === 'start' ? ax : ax - lw;
      const lx1 = lx0 + lw;
      const stemX = ranged ? bx0 : x;
      items.push({ x0: Math.min(lx0, stemX - 2), x1: Math.max(lx1, stemX + 2), priority: i === selected ? -1 : ev.otd ? ev.tier + 1 : ev.tier });   // the open event first, then bundled before on-this-day
      meta.push({ index: i, ev: ev, ranged: ranged, x: x, bx0: bx0, bx1: bx1, text: text, ax: ax, anchor: anchor, stemX: stemX });
    }

    let placed;
    if (HT.layout && typeof HT.layout.packLanes === 'function') {
      placed = HT.layout.packLanes(items, { gap: 8, maxLanes: maxLanes }).placed;
    } else {
      placed = items.map(function (_, i) { return { index: i, lane: 0 }; });
    }
    // Higher lanes first so lower-lane labels paint over stems that pass through them.
    placed = placed.slice().sort(function (a, b) { return b.lane - a.lane || a.index - b.index; });

    const frag = document.createDocumentFragment();
    for (let k = 0; k < placed.length; k++) {
      const m = meta[placed[k].index];
      const ev = m.ev;
      const lane = placed[k].lane;
      const baseline = axisY - LANE_BASE_OFFSET - lane * LANE_PITCH;
      const color = ev.otd ? 'var(--accent)' : colors[ev.category] || 'currentColor';
      const g = svgEl('g', {
        class: 'event cat-' + ev.category + ' tier-' + ev.tier + (ev.otd ? ' otd' : '') + (m.ranged ? ' ranged' : ' point') +
               (m.index === selected ? ' selected' : '') + (settleNext ? ' arrive' : ''),
        id: 'ev-' + m.index,
        'data-index': m.index,
        tabindex: 0,
        role: 'button',
        'aria-label': ev.title + ', ' + eventDateLabel(ev)
      });
      // Invisible hit areas: a generous pad around the marker/bar and the label's box, so a tap
      // does not have to land on a 10px dot (a miss would zoom instead of opening the event).
      const lw = measureEventLabel(m.text);
      g.appendChild(svgEl('rect', {
        class: 'hit', x: (m.anchor === 'start' ? m.ax : m.ax - lw) - 4, y: baseline - 13, width: lw + 8, height: 18
      }));
      if (m.ranged) {
        g.appendChild(svgEl('rect', { class: 'hit', x: m.bx0, y: axisY - 12, width: Math.max(1, m.bx1 - m.bx0), height: 24 }));
      } else {
        g.appendChild(svgEl('circle', { class: 'hit', cx: m.x, cy: axisY, r: 14 }));
      }
      const stemTop = baseline + 3;
      const stemBottom = m.ranged ? axisY - BAR_H / 2 - 1 : axisY - MARKER_R - 1;
      if (stemBottom > stemTop && (!m.ranged || m.x >= 0)) {
        g.appendChild(svgEl('line', {
          class: 'stem', x1: crisp(m.stemX), x2: crisp(m.stemX), y1: stemTop, y2: stemBottom,
          stroke: color, 'stroke-opacity': 0.4
        }));
      }
      if (settleNext) g.style.setProperty('--i', String(k));
      if (m.ranged) {
        g.appendChild(svgEl('rect', {
          class: 'bar', x: m.bx0, y: axisY - BAR_H / 2, width: Math.max(1, m.bx1 - m.bx0), height: BAR_H, rx: 1.5, fill: color
        }));
      } else {
        if (ev.tier <= 1) g.appendChild(svgEl('circle', { class: 'pulse', cx: m.x, cy: axisY, r: MARKER_R, stroke: color }));
        g.appendChild(svgEl('circle', { class: 'marker', cx: m.x, cy: axisY, r: MARKER_R, fill: color }));
      }
      g.appendChild(svgEl('text', { class: 'label', x: m.ax, y: baseline, 'text-anchor': m.anchor }, m.text));
      frag.appendChild(g);
    }
    dom.gEvents.replaceChildren(frag);
    hudStats = { visible: placed.length, inWindow: inWindow, tier: tierLimit };
  }
