// HT.app, part 90: init and the public HT.app object.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // ------------------------------------------------------------------
  // 8. init
  // ------------------------------------------------------------------
  function buildSvgScaffold() {
    const svg = dom.svg;
    svg.style.touchAction = 'none';                     // we handle pan/pinch ourselves
    svg.style.userSelect = 'none';
    svg.style.webkitUserSelect = 'none';
    dom.gMinor = svgEl('g', { class: 'g-minor' });
    dom.gMajor = svgEl('g', { class: 'g-major' });
    dom.gLabels = svgEl('g', { class: 'g-labels' });
    dom.gAxis = svgEl('g', { class: 'g-axis' });
    dom.gEvents = svgEl('g', { class: 'g-events' });
    dom.gEarth = svgEl('g', { class: 'g-earth', 'pointer-events': 'none' });
    dom.gReigns = svgEl('g', { class: 'g-reigns' });
    dom.gNow = svgEl('g', { class: 'g-now', 'pointer-events': 'none' });
    dom.gLife = svgEl('g', { class: 'g-mylife', 'pointer-events': 'none' });
    dom.gSpan = svgEl('g', { class: 'g-span', 'pointer-events': 'none' });
    dom.gEra = svgEl('g', { class: 'g-era' });
    dom.gCursor = svgEl('g', { class: 'g-cursor', 'pointer-events': 'none' });
    dom.cursorLine = svgEl('line', { class: 'cursor-line', x1: 0, x2: 0, y1: 0, y2: 0, visibility: 'hidden' });
    dom.gCursor.appendChild(dom.cursorLine);
    const gMeasure = svgEl('g', { class: 'g-measure', visibility: 'hidden', 'pointer-events': 'none', 'aria-hidden': 'true' });
    measureTickEl = svgEl('text', { class: 'tick-label', x: -1000, y: -1000 });
    const measureEvent = svgEl('g', { class: 'event' });
    measureLabelEl = svgEl('text', { class: 'label', x: -1000, y: -1000 });
    measureEvent.appendChild(measureLabelEl);
    gMeasure.appendChild(measureTickEl);
    gMeasure.appendChild(measureEvent);
    svg.replaceChildren(dom.gLife, dom.gMinor, dom.gMajor, dom.gEarth, dom.gLabels, dom.gAxis, dom.gNow, dom.gReigns, dom.gEvents, dom.gSpan, dom.gEra, dom.gCursor, gMeasure);

    // The tooltip is positioned in stage coordinates; make sure the stage is its containing block.
    dom.tooltip.style.position = 'absolute';
    dom.tooltip.style.pointerEvents = 'none';
    if (root.getComputedStyle(dom.stage).position === 'static') dom.stage.style.position = 'relative';
    if (!dom.panel.hasAttribute('tabindex')) dom.panel.tabIndex = -1;
  }

  function init() {
    if (inited) return;
    if (typeof document === 'undefined') return;
    const $ = function (id) { return document.getElementById(id); };
    const svg = $('timeline');
    if (!svg) return;
    inited = true;
    dom = {
      app: $('app'), header: $('header'), crumbs: $('crumbs'), cursorDate: $('cursor-date'),
      btnOut: $('btn-out'), btnHome: $('btn-home'), btnLegend: $('btn-legend'),
      stage: $('stage') || svg.parentNode, svg: svg, tooltip: $('tooltip'), legend: $('legend'),
      panel: $('panel'), panelClose: $('panel-close'), panelCategory: $('panel-category'),
      panelTitle: $('panel-title'), panelDate: $('panel-date'), panelDetail: $('panel-detail'),
      panelZoom: $('panel-zoom'),
      panelLink: $('panel-link'),
      dock: $('dock'), cursorChip: $('cursor-chip'),
      hudSpan: $('hud-span'), hudEvents: $('hud-events'), hudTier: $('hud-tier'), hudScale: $('hud-scale'),
      hudMode: $('hud-mode'), hudClock: $('hud-clock'), hudNow: $('hud-now'),
      hudEarth: $('hud-earth'), hudCity: $('hud-city'), btnEarth: $('btn-earth'), hud: $('hud'),
      btnReigns: $('btn-reigns'), btnSearch: $('btn-search'), search: $('search'), searchInput: $('search-input'), searchResults: $('search-results'),
      panelMap: $('panel-map'), panelMapSvg: $('panel-map-svg'), panelMapCap: $('panel-map-cap'),
      panelImage: $('panel-image'), panelImg: $('panel-img'), panelImgLink: $('panel-img-link'), panelImgCredit: $('panel-img-credit'),
      optImages: $('opt-images'),
      panelExtract: $('panel-extract'), panelExtractText: $('panel-extract-text'), panelExtractSrc: $('panel-extract-src'),
      panelMore: $('panel-more'), panelNear: $('panel-near'), panelNearList: $('panel-near-list'),
      panelRelated: $('panel-related'), panelRelatedHead: $('panel-related-head'), panelRelatedList: $('panel-related-list'),
      otdChip: $('otd-chip'), otdAction: $('otd-action'), otdDismiss: $('otd-dismiss'),
      btnTours: $('btn-tours'), tours: $('tours'), tourBar: $('tour-bar'), tourTitle: $('tour-title'), tourCount: $('tour-count'),
      tourNote: $('tour-note'), tourPrev: $('tour-prev'), tourNext: $('tour-next'), tourExit: $('tour-exit'),
      panelMeasure: $('panel-measure'), measureGap: $('measure-gap'), measureLines: $('measure-lines'), measureStart: $('measure-start'),
      measureStop: $('measure-stop'), measureChip: $('measure-chip'), measureChipText: $('measure-chip-text'), measureChipStop: $('measure-chip-stop'),
      btnLayers: $('btn-layers'), layerGroup: $('layer-group'),
      scaleToggle: $('scale-toggle'), btnLives: $('btn-lives'), tourEdit: $('tour-edit'),
      embedOpen: $('embed-open'), srStatus: $('sr-status'), skip: $('skip'),
      helpTours: $('help-tours'), helpTourList: $('help-tour-list'), today: $('today'),
      minimap: $('minimap'), help: $('help'), helpClose: $('help-close'), helpOk: $('help-ok'), btnHelp: $('btn-help'), panelCopy: $('panel-copy'),
      panelObject: $('panel-object'), panelObjectImg: $('panel-object-img'), panelObjectImgLink: $('panel-object-imglink'),
      panelObjectLink: $('panel-object-link'), panelObjectCredit: $('panel-object-credit')
    };
    // Embed mode changes the layout, so it is settled before anything is measured or drawn.
    try { embed = /[?&]embed=(1|true)\b/.test(String(root.location.search || '')); } catch (err) { embed = false; }
    if (embed) {
      document.body.classList.add('embed');
      if (dom.embedOpen) dom.embedOpen.hidden = false;
    }
    NOW = HT.time.now();
    // Sitting office-holders are generated without an end: their reign runs to the moment the page opened.
    const all = events();
    for (let i = 0; i < all.length; i++) if (all[i].ongoing === true && !hasEnd(all[i]) && all[i].t < NOW) all[i].end = NOW;
    // Theme: URL param (read in parseHash below) > stored choice > auto.
    try { const stored = root.localStorage.getItem(THEME_KEY); if (stored && THEMES.indexOf(stored) >= 0) theme = stored; } catch (err) { /* ignore */ }
    applyTheme();
    if (typeof root.matchMedia === 'function') {
      const mq = root.matchMedia('(prefers-color-scheme: light)');
      const onScheme = function () { if (theme === 'auto') applyTheme(); };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onScheme);
      else if (typeof mq.addListener === 'function') mq.addListener(onScheme);
    }
    if (dom.dock) {
      dom.dock.addEventListener('click', function (e) {
        const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('button[data-theme]') : null;
        if (b) setTheme(b.dataset.theme);
      });
    }
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
    try { earthOn = root.localStorage.getItem(EARTH_KEY) !== '0'; } catch (err) { /* ignore */ }
    try { const by = Number(root.localStorage.getItem(BIRTH_KEY)); if (Number.isFinite(by) && by >= 1900 && by <= Math.floor(nowT())) birthYear = Math.floor(by); } catch (err) { /* ignore */ }
    try { livesOn = root.localStorage.getItem(LIVES_KEY) === '1'; if (livesOn) reignsOn = false; } catch (err) { /* ignore */ }
    try { scaleMode = root.localStorage.getItem(SCALE_KEY) === 'lin' ? 'lin' : 'log'; } catch (err) { /* ignore */ }
    try { reignsOn = root.localStorage.getItem(REIGNS_KEY) !== '0'; } catch (err) { /* ignore */ }
    try { imagesOn = root.localStorage.getItem(IMAGES_KEY) === '1'; } catch (err) { /* ignore */ }
    try { const rk = root.localStorage.getItem(REGION_KEY); if (rk && REGION_BOXES[rk]) regionFilter = rk; } catch (err) { /* ignore */ }
    if (dom.optImages) {
      dom.optImages.checked = imagesOn;
      dom.optImages.addEventListener('change', function () { setImages(dom.optImages.checked); });
    }
    if (dom.tours && tourDefs().length) {
      const head = htmlEl('h3', '', 'Guided tours');
      const list = htmlEl('div', 'tour-list');
      dom.tours.replaceChildren(head, list);
      dom.toursHead = head;
      dom.tourList = list;
      if (dom.helpTours) dom.helpTours.hidden = false;
      refreshTourLists();
      dom.btnTours.addEventListener('click', function () { toggleTours(); });
      dom.tourPrev.addEventListener('click', function () { tourStep(-1); });
      dom.tourNext.addEventListener('click', function () { tourStep(1); });
      dom.tourExit.addEventListener('click', endTour);
      if (dom.tourEdit) dom.tourEdit.addEventListener('click', function () { endTour(); openLifeForm(); });
    } else if (dom.btnTours) {
      dom.btnTours.hidden = true;
    }
    if (dom.btnLives) dom.btnLives.addEventListener('click', function () { setLives(!livesOn); });
    syncLayerButtons();
    if (dom.scaleToggle) {
      dom.scaleToggle.addEventListener('click', function () {
        setScale(scaleMode === 'log' ? 'lin' : 'log');
        announce('Scale: ' + (scaleMode === 'log' ? 'logarithmic on wide views' : 'linear'));
      });
    }
    if (dom.panelMeasure) {
      dom.measureStart.addEventListener('click', function () { if (selected >= 0) setMeasure(selected); });
      dom.measureStop.addEventListener('click', function () { setMeasure(-1); });
      dom.measureChipStop.addEventListener('click', function () { setMeasure(-1); });
    }
    if (dom.btnLayers) {
      dom.btnLayers.addEventListener('click', function (e) { e.stopPropagation(); toggleLayers(); });
      dom.btnLegend.addEventListener('click', function () { if (layersFolded()) toggleLayers(false); });   // the legend card replaces the menu
      document.addEventListener('click', function (e) {
        if (dom.layerGroup.classList.contains('open') && !dom.layerGroup.contains(e.target)) toggleLayers(false);
      });
      root.addEventListener('resize', function () { if (!layersFolded()) toggleLayers(false); });
    }
    if (dom.skip) {
      dom.skip.addEventListener('click', function () {
        const first = dom.svg.querySelector('.event');
        try { (first || dom.svg).focus({ preventScroll: true }); } catch (err) { /* ignore */ }
      });
    }
    if (dom.today) {
      dom.today.addEventListener('click', function (e) {
        const t = e.target && typeof e.target.closest === 'function' ? e.target : null;
        if (!t) return;
        if (t.closest('.today-close')) { closeToday(); return; }
        const b = t.closest('.today-item');
        if (b) { closeToday({ keepFocus: true }); jumpToEvent(Number(b.dataset.index)); }
      });
    }
    if (dom.otdChip) {
      try { otdHint = root.localStorage.getItem(OTD_HINT_KEY) !== 'off'; } catch (err) { /* ignore */ }
      dom.otdAction.addEventListener('click', function () { if (!imagesOn) setImages(true); });
      dom.otdDismiss.addEventListener('click', function () {
        otdHint = false;
        try { root.localStorage.setItem(OTD_HINT_KEY, 'off'); } catch (err) { /* ignore */ }
        updateOtdChip();
      });
    }
    if (dom.panelNear) {
      const onJump = function (e) {
        const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.panel-jump') : null;
        if (b) jumpToEvent(Number(b.dataset.index));
      };
      dom.panelNear.addEventListener('click', onJump);
      dom.panelRelated.addEventListener('click', onJump);
    }
    if (dom.btnReigns) {
      dom.btnReigns.setAttribute('aria-pressed', String(reignsOn));
      dom.btnReigns.addEventListener('click', function () { setReigns(!reignsOn); });
    }
    if (dom.btnEarth) {
      dom.btnEarth.setAttribute('aria-pressed', String(earthOn));
      dom.btnEarth.addEventListener('click', function () { setEarth(!earthOn); });
    }
    try {
      const saved = JSON.parse(root.localStorage.getItem(HIDDEN_KEY) || '[]');
      if (Array.isArray(saved)) saved.forEach(function (c) { if (HT.tiers.CATEGORIES.indexOf(c) >= 0) hiddenCats.add(c); });
    } catch (err) { /* ignore */ }
    buildSvgScaffold();
    buildPanelMap();
    renderLegend();

    // Initial view from the hash; breadcrumb chain from history.state when a reload preserved it.
    const parsed = parseHash(root.location.hash);
    view = parsed || rootView();
    const saved = root.history && root.history.state && root.history.state.ht
      ? restoreStack(root.history.state.stack, view) : null;
    stack = saved || deriveStack(view);
    shown = view;
    stampState();
    applyTheme();                                        // parseHash may have picked a theme from the URL

    bindEvents();
    settleNext = true;
    render();
    renderCrumbs();
    renderLegend();                                       // region state may have been restored after the first build
    updateMeasureChip();
    syncTourFromUrl();
    if (pendingEv >= 0) { revealEvent(pendingEv); openPanel(pendingEv, { silent: true }); }
    // First visit without a shared link: show the guide once.
    let seen = true;
    try { seen = root.localStorage.getItem(HELP_KEY) === '1'; } catch (err) { /* ignore */ }
    if (!seen && !embed && dom.help && (!root.location.hash || root.location.hash.length < 2)) toggleHelp(true);
    if (embed) updateEmbedLink();
  }

  HT.app = {
    init: init,
    setView: setView,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    home: home,
    zoomToEvent: zoomToEvent,
    getView: getView,
    setTheme: setTheme,
    getTheme: getTheme,
    setEarth: setEarth,
    setReigns: setReigns,
    setImages: setImages,
    setRegion: setRegion,
    setLives: setLives,
    THEMES: THEMES.slice()
  };
