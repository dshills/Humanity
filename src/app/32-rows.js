// HT.app, part 32: Row layers at the top of the stage: Reigns and Lives.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Reign swimlanes: one row per office at the top of the stage ---
  function reignsActive() {
    return reignsOn && !livesOn && size.width >= REIGN_MIN_WIDTH;
  }

  // While either row layer is up, rulers stay out of the ordinary event lanes.
  function rowsActive() { return reignsActive() || livesActive(); }

  function livesActive() {
    return livesOn && size.width >= REIGN_MIN_WIDTH;
  }

  function planReigns(v, axisY) {
    reignRows = [];
    reignReserve = 0;
    if (!reignsActive() || v.end - v.start > REIGN_MAX_SPAN) return;
    const list = events();
    if (!groupOrder) {
      groupOrder = [];
      for (let i = 0; i < list.length; i++) if (list[i].group && groupOrder.indexOf(list[i].group) < 0) groupOrder.push(list[i].group);
    }
    const byGroup = new Map();
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (!ev.group || !passesFilters(ev, i)) continue;
      const tEnd = hasEnd(ev) ? ev.end : ev.t;
      if (tEnd < v.start || ev.t > v.end) continue;
      let g = byGroup.get(ev.group);
      if (!g) { g = { group: ev.group, items: [], weight: 0 }; byGroup.set(ev.group, g); }
      g.items.push(i);
      g.weight += 1 / (1 + ev.tier);                      // prominence decides who stays when rows run out
    }
    if (byGroup.size === 0) return;
    // Leave the event lanes at least four rows; swimlanes take what is left above them.
    const room = axisY - LANE_TOP_PAD - 4 * LANE_PITCH - REIGN_TOP;
    const maxRows = Math.min(REIGN_MAX_ROWS, Math.max(0, Math.floor(room / REIGN_ROW_H)));
    if (maxRows === 0) return;
    let chosen = Array.from(byGroup.values());
    if (chosen.length > maxRows) chosen = chosen.sort(function (a, b) { return b.weight - a.weight; }).slice(0, maxRows);
    chosen.sort(function (a, b) { return groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group); });
    reignRows = chosen;
    reignReserve = REIGN_TOP + chosen.length * REIGN_ROW_H + 8;
  }

  function renderReigns(v) {
    const g = dom.gReigns;
    if (!reignRows.length) { g.replaceChildren(); return; }
    const list = events();
    const w = size.width;
    const frag = document.createDocumentFragment();
    for (let r = 0; r < reignRows.length; r++) {
      const row = reignRows[r];
      const y = REIGN_TOP + r * REIGN_ROW_H;
      frag.appendChild(svgEl('line', { class: 'row-line', x1: 0, x2: w, y1: crisp(y + REIGN_ROW_H - 1), y2: crisp(y + REIGN_ROW_H - 1) }));
      const labelW = row.group.length * 6.6 + 26;         // keep names clear of the row label
      for (let k = 0; k < row.items.length; k++) {
        const i = row.items[k];
        const ev = list[i];
        const x0 = clamp(tToPx(ev.t, v), 0, w);
        const x1 = clamp(tToPx(hasEnd(ev) ? ev.end : ev.t, v), 0, w);
        const width = Math.max(2, x1 - x0);
        const seg = svgEl('g', {
          class: 'event reign cat-' + ev.category + (k % 2 ? ' alt' : '') + (i === selected ? ' selected' : ''),
          id: 'ev-' + i, 'data-index': i, tabindex: 0, role: 'button',
          'aria-label': ev.title + ', ' + eventDateLabel(ev)
        });
        seg.appendChild(svgEl('rect', { class: 'seg', x: x0, y: y + 1, width: width, height: REIGN_ROW_H - 3, rx: 2 }));
        // The row already says the office and country: "Henry II of France" -> "Henry II", "Kangxi Emperor" -> "Kangxi".
        const name = String(ev.title).split(',')[0].replace(/ of (France|England|Portugal|Spain|Russia|Prussia|Ethiopia|Japan|China|the United Kingdom)$/, '').replace(/^Emperor /, '').replace(/ Emperor$/, '').replace(/^Pope /, '');
        const lx = Math.max(x0, labelW) + 5;
        if (x0 + width - lx >= name.length * 5.9 + 4) {
          seg.appendChild(svgEl('text', { class: 'seg-label', x: lx, y: y + REIGN_ROW_H - 5 }, name));
        }
        frag.appendChild(seg);
      }
      frag.appendChild(svgEl('text', { class: 'row-label', x: 18, y: y + REIGN_ROW_H - 5 }, row.group));
    }
    g.replaceChildren(frag);
  }

  // --- Lives: the lifespans of notable people, packed into rows at the top of the stage. The most prominent
  // get a row first; whoever does not fit is left out, and the caption says how many. ---
  function planLives(v, axisY) {
    livesRows = [];
    livesStats = { shown: 0, inView: 0 };
    if (!livesActive() || v.end - v.start > LIVES_MAX_SPAN) return;
    const list = events();
    const w = size.width;
    const items = [];
    const idx = [];
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (!ev.life || ev.end < v.start || ev.t > v.end || !passesFilters(ev, i)) continue;
      const x0 = clamp(tToPx(ev.t, v), 0, w);
      const x1 = clamp(tToPx(ev.end, v), 0, w);
      items.push({ x0: x0, x1: Math.max(x1, x0 + 3), priority: i === selected ? -1 : ev.tier + (1 - Math.min(1, (ev.end - ev.t) / 125)) * 0.5 });
      idx.push(i);
    }
    livesStats.inView = items.length;
    if (!items.length) return;
    const room = axisY - LANE_TOP_PAD - 4 * LANE_PITCH - REIGN_TOP;
    const maxRows = Math.min(REIGN_MAX_ROWS, Math.max(0, Math.floor(room / REIGN_ROW_H)));
    if (maxRows === 0) return;
    const placed = HT.layout.packLanes(items, { gap: 3, maxLanes: maxRows }).placed;
    let rows = 0;
    for (let k = 0; k < placed.length; k++) {
      const lane = placed[k].lane;
      (livesRows[lane] || (livesRows[lane] = [])).push(idx[placed[k].index]);
      rows = Math.max(rows, lane + 1);
    }
    for (let r = 0; r < rows; r++) if (!livesRows[r]) livesRows[r] = [];
    livesStats.shown = placed.length;
    reignReserve = REIGN_TOP + rows * REIGN_ROW_H + 8;
  }

  function renderLives(v) {
    const g = dom.gReigns;
    const list = events();
    const w = size.width;
    const frag = document.createDocumentFragment();
    const tooWide = v.end - v.start > LIVES_MAX_SPAN;
    const caption = tooWide ? 'Lives \u00b7 zoom in to 3,000 years or less'
      : livesStats.inView ? 'Lives \u00b7 ' + livesStats.shown + ' of ' + livesStats.inView + ' alive in this view' : 'Lives \u00b7 nobody on record here';
    frag.appendChild(svgEl('text', { class: 'row-label lives-caption', x: 18, y: REIGN_TOP - 7 }, caption));
    for (let r = 0; r < livesRows.length; r++) {
      const y = REIGN_TOP + r * REIGN_ROW_H;
      const row = livesRows[r];
      for (let k = 0; k < row.length; k++) {
        const i = row[k];
        const ev = list[i];
        const x0 = clamp(tToPx(ev.t, v), 0, w);
        const x1 = clamp(tToPx(ev.end, v), 0, w);
        const width = Math.max(3, x1 - x0);
        const seg = svgEl('g', {
          class: 'event reign life cat-' + ev.category + (i === selected ? ' selected' : ''),
          id: 'ev-' + i, 'data-index': i, tabindex: 0, role: 'button',
          'aria-label': ev.title + ', ' + eventDateLabel(ev)
        });
        seg.appendChild(svgEl('rect', { class: 'seg', x: x0, y: y + 1, width: width, height: REIGN_ROW_H - 3, rx: 2 }));
        if (width >= ev.title.length * 5.9 + 10) seg.appendChild(svgEl('text', { class: 'seg-label', x: x0 + 5, y: y + REIGN_ROW_H - 5 }, ev.title));
        frag.appendChild(seg);
      }
    }
    g.replaceChildren(frag);
  }

  function setLives(on) {
    livesOn = !!on;
    if (livesOn) reignsOn = false;                        // one layer at a time up there
    try { root.localStorage.setItem(LIVES_KEY, livesOn ? '1' : '0'); if (livesOn) root.localStorage.setItem(REIGNS_KEY, '0'); } catch (err) { /* ignore */ }
    syncLayerButtons();
    if (dom && shown) { settleNext = true; render(); }
    if (dom) announce(function () { return livesOn ? 'Lives on. ' + livesStats.shown + ' of ' + livesStats.inView + ' people alive in this view are shown.' : 'Lives off.'; });
  }

  function syncLayerButtons() {
    if (!dom) return;
    if (dom.btnReigns) dom.btnReigns.setAttribute('aria-pressed', String(reignsOn));
    if (dom.btnLives) dom.btnLives.setAttribute('aria-pressed', String(livesOn));
  }

  function setReigns(on) {
    reignsOn = !!on;
    if (reignsOn && livesOn) { livesOn = false; try { root.localStorage.setItem(LIVES_KEY, '0'); } catch (err) { /* ignore */ } }
    try { root.localStorage.setItem(REIGNS_KEY, reignsOn ? '1' : '0'); } catch (err) { /* ignore */ }
    syncLayerButtons();
    if (dom && shown) { settleNext = true; render(); }
  }
