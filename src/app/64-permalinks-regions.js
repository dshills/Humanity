// HT.app, part 64: Permalinks and the region filter.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Permalinks: ev=<slug of the title>. Titles are unique, so slugs are stable while a title is. ---
  const slugify = C.slugify;

  // Built lazily and extended when on-this-day events arrive; their slugs carry the year, since the same
  // sentence can recur across years.
  function buildSlugIndex() {
    if (!slugIndex) slugIndex = { bySlug: new Map(), byIndex: [] };
    const list = events();
    for (let i = slugIndex.byIndex.length; i < list.length; i++) {
      const ev = list[i];
      const base = slugify(ev.otd ? HT.time.toParts(ev.t).year + ' ' + ev.title : ev.title);
      let slug = base;
      for (let k = 2; slugIndex.bySlug.has(slug); k++) slug = base + '-' + k;
      slugIndex.bySlug.set(slug, i);
      slugIndex.byIndex[i] = slug;
    }
  }

  function slugFor(index) {
    if (!slugIndex || slugIndex.byIndex.length < events().length) buildSlugIndex();
    return slugIndex.byIndex[index] || '';
  }

  function indexForSlug(slug) {
    if (!slugIndex || slugIndex.byIndex.length < events().length) buildSlugIndex();
    const i = slugIndex.bySlug.get(String(slug));
    return i === undefined ? -1 : i;
  }

  // Open or close the panel to match the ev= parameter last parsed from the URL.
  function syncPanelFromUrl() {
    if (!dom) return;
    if (pendingEv >= 0) {
      if (selected !== pendingEv || dom.panel.hidden) { revealEvent(pendingEv); openPanel(pendingEv, { silent: true }); }
    }
    else if (!dom.panel.hidden) closePanel({ silent: true });
  }

  function copyEventLink() {
    const url = String(root.location.href);
    const done = function () {
      const old = dom.panelCopy.textContent;
      dom.panelCopy.textContent = 'Link copied';
      setTimeout(function () { dom.panelCopy.textContent = old; }, 1600);
    };
    if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
      root.navigator.clipboard.writeText(url).then(done, function () { root.prompt('Copy this link', url); });
    } else {
      root.prompt('Copy this link', url);
    }
  }

  // --- Regions (boxes and office mapping in HT.core) ---
  const REGIONS = C.REGIONS;
  const REGION_BOXES = C.REGION_BOXES;

  function eventRegion(i) {
    if (!regionCache) regionCache = [];
    if (regionCache[i] !== undefined) return regionCache[i];
    const ev = events()[i];
    const c = eventCoords(ev);
    const r = c ? C.regionOf(c[0], c[1]) : C.officeRegion(ev.group);
    regionCache[i] = r;
    return r;
  }

  // One gate for every layer: category filter and region filter.
  function passesFilters(ev, i) {
    if (hiddenCats.has(ev.category)) return false;
    return regionFilter === null || eventRegion(i) === regionFilter;
  }

  function setRegion(key) {
    regionFilter = key && REGION_BOXES[key] ? key : null;
    try { if (regionFilter) root.localStorage.setItem(REGION_KEY, regionFilter); else root.localStorage.removeItem(REGION_KEY); } catch (err) { /* ignore */ }
    renderLegend();
    if (shown) { settleNext = true; render(); }
    const label = regionFilter ? (REGIONS.filter(function (r) { return r[0] === regionFilter; })[0] || ['', regionFilter])[1] : 'everywhere';
    announce(function () { return 'Region: ' + label + '. ' + hudStats.inWindow + ' events in view.'; });
  }
