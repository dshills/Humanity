// HT.app, part 46: Legend, category filters and search.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Legend ---
  function renderLegend() {
    const cats = (HT.tiers && HT.tiers.CATEGORIES) || [];
    const colors = (HT.tiers && HT.tiers.COLORS) || {};
    const frag = document.createDocumentFragment();
    const actions = htmlEl('div', 'legend-actions');
    const all = htmlEl('button', '', 'All'); all.type = 'button'; all.dataset.act = 'all';
    const none = htmlEl('button', '', 'None'); none.type = 'button'; none.dataset.act = 'none';
    actions.appendChild(all); actions.appendChild(none);
    frag.appendChild(actions);
    for (let i = 0; i < cats.length; i++) {
      const item = htmlEl('button', 'legend-item');
      item.type = 'button';
      item.dataset.cat = cats[i];
      item.setAttribute('aria-pressed', String(!hiddenCats.has(cats[i])));
      item.title = 'Show or hide ' + cats[i] + ' events';
      const swatch = document.createElement('i');
      swatch.style.background = colors[cats[i]] || 'currentColor';
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(cats[i]));
      frag.appendChild(item);
    }
    // Region filter: chips plus a small map; clicking the map picks the region under the pointer.
    const reg = htmlEl('div', 'legend-regions');
    reg.appendChild(htmlEl('h3', '', 'Region'));
    const chips = htmlEl('div', 'region-chips');
    const mk = function (key, label) {
      const b = htmlEl('button', '', label); b.type = 'button'; b.dataset.region = key;
      b.setAttribute('aria-pressed', String((regionFilter || '') === key));
      return b;
    };
    chips.appendChild(mk('', 'Everywhere'));
    for (let i = 0; i < REGIONS.length; i++) chips.appendChild(mk(REGIONS[i][0], REGIONS[i][1]));
    reg.appendChild(chips);
    if (HT.map) {
      const W = HT.map.width; const H = HT.map.height;
      const svg = svgEl('svg', { id: 'region-map', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'World map: click a region to filter' });
      svg.appendChild(svgEl('path', { class: 'land', d: HT.map.land }));
      const boxes = regionFilter ? REGION_BOXES[regionFilter] : [];
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        svg.appendChild(svgEl('rect', { class: 'region-box', x: (b[2] + 180) * W / 360, y: (90 - b[1]) * H / 180, width: (b[3] - b[2]) * W / 360, height: (b[1] - b[0]) * H / 180 }));
      }
      reg.appendChild(svg);
    }
    reg.appendChild(htmlEl('div', 'region-note', 'Regions are coarse boxes. With a region chosen, only events with a known location there are shown.'));
    frag.appendChild(reg);
    dom.legend.replaceChildren(frag);
    dom.btnLegend.classList.toggle('filtered', hiddenCats.size > 0 || regionFilter !== null);
    if (dom.btnLayers) dom.btnLayers.classList.toggle('filtered', hiddenCats.size > 0 || regionFilter !== null);   // the dot survives the fold
  }

  // --- Category filters (legend buttons) ---
  function saveHidden() {
    try { root.localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(hiddenCats))); } catch (err) { /* ignore */ }
  }

  function setCategoryHidden(cat, hidden) {
    if (hidden) hiddenCats.add(cat); else hiddenCats.delete(cat);
    saveHidden();
    renderLegend();
    if (shown) { settleNext = true; render(); }
  }

  function onLegendClick(e) {
    const mapEl = e.target && typeof e.target.closest === 'function' ? e.target.closest('#region-map') : null;
    if (mapEl && HT.map) {
      const r = mapEl.getBoundingClientRect();
      const lon = (e.clientX - r.left) / r.width * 360 - 180;
      const lat = 90 - (e.clientY - r.top) / r.height * 180;
      const key = regionOf(lat, lon);
      if (key) setRegion(regionFilter === key ? null : key);
      return;
    }
    const t = e.target && typeof e.target.closest === 'function' ? e.target.closest('button') : null;
    if (!t) return;
    if (t.dataset.region !== undefined) { setRegion(t.dataset.region || null); return; }
    const cats = (HT.tiers && HT.tiers.CATEGORIES) || [];
    if (t.dataset.act === 'all') hiddenCats.clear();
    else if (t.dataset.act === 'none') cats.forEach(function (c) { hiddenCats.add(c); });
    else if (t.dataset.cat) {
      if (e.shiftKey) {                                   // shift-click: show only this category
        hiddenCats.clear();
        cats.forEach(function (c) { if (c !== t.dataset.cat) hiddenCats.add(c); });
      } else if (hiddenCats.has(t.dataset.cat)) hiddenCats.delete(t.dataset.cat);
      else hiddenCats.add(t.dataset.cat);
    } else return;
    saveHidden();
    renderLegend();
    if (shown) { settleNext = true; render(); }
  }

  // --- Search ---
  function buildSearchIndex() {
    const list = events();
    searchIndex = new Array(list.length);
    for (let i = 0; i < list.length; i++) searchIndex[i] = String(list[i].title || '').toLowerCase();
  }

  // Prefix matches first, then word-start matches, then substrings; ties go to the more significant tier.
  function searchEvents(query) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    if (!searchIndex) buildSearchIndex();
    const list = events();
    const hits = [];
    for (let i = 0; i < searchIndex.length; i++) {
      const pos = searchIndex[i].indexOf(q);
      if (pos < 0) continue;
      const rank = pos === 0 ? 0 : /[\s(\-:,]/.test(searchIndex[i].charAt(pos - 1)) ? 1 : 2;
      hits.push({ i: i, rank: rank, tier: list[i].tier });
    }
    hits.sort(function (a, b) { return a.rank - b.rank || a.tier - b.tier || a.i - b.i; });
    return hits.slice(0, SEARCH_LIMIT);
  }

  function renderSearchResults() {
    const list = events();
    const frag = document.createDocumentFragment();
    if (searchHits.length === 0 && dom.searchInput.value.trim().length >= 2) {
      frag.appendChild(htmlEl('li', 'sr-empty', 'No events match.'));
    }
    for (let k = 0; k < searchHits.length; k++) {
      const ev = list[searchHits[k].i];
      const li = htmlEl('li', 'cat-' + ev.category);
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(k === searchActive));
      li.dataset.k = String(k);
      li.appendChild(document.createElement('i'));
      li.appendChild(htmlEl('span', 'sr-title', ev.title));
      li.appendChild(htmlEl('span', 'sr-date', eventDateLabel(ev)));
      frag.appendChild(li);
    }
    dom.searchResults.replaceChildren(frag);
  }

  function toggleSearch(force) {
    const open = force === undefined ? dom.search.hidden : !!force;
    const was = !dom.search.hidden;
    if (open && !was) rememberFocus('search');
    dom.search.hidden = !open;
    if (!open && was) restoreFocus('search', dom.btnSearch);
    dom.btnSearch.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!dom.legend.hidden) toggleLegend(false);
      dom.searchInput.value = '';
      searchHits = []; searchActive = -1;
      renderSearchResults();
      try { dom.searchInput.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    }
  }

  // Lift whatever filter would hide this event, so a search hit or a shared link is never invisible.
  function revealEvent(i) {
    const ev = events()[i];
    if (!ev) return;
    if (ev.life && !livesOn) setLives(true);            // a person is only ever drawn in the Lives layer
    if (hiddenCats.has(ev.category)) { hiddenCats.delete(ev.category); saveHidden(); renderLegend(); if (shown) { settleNext = true; render(); } }
    if (regionFilter !== null && eventRegion(i) !== regionFilter) setRegion(null);
  }

  function chooseSearchHit(k) {
    const hit = searchHits[k];
    if (!hit) return;
    const ev = events()[hit.i];
    toggleSearch(false);
    revealEvent(hit.i);
    zoomToEvent(ev);
    openPanel(hit.i);
  }

  function onSearchInput() {
    searchHits = searchEvents(dom.searchInput.value);
    searchActive = searchHits.length ? 0 : -1;
    renderSearchResults();
  }

  function onSearchKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!searchHits.length) return;
      searchActive = (searchActive + (e.key === 'ArrowDown' ? 1 : -1) + searchHits.length) % searchHits.length;
      renderSearchResults();
      const el = dom.searchResults.querySelector('[aria-selected="true"]');
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
      e.preventDefault();
    } else if (e.key === 'Enter') {
      chooseSearchHit(searchActive >= 0 ? searchActive : 0);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      toggleSearch(false);
      e.preventDefault();
      e.stopPropagation();
    }
  }
