// HT.app, part 70: Interaction: pointer, wheel, keyboard, resize, history.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // ------------------------------------------------------------------
  // 7. Interaction
  // ------------------------------------------------------------------

  // --- Pointer: tap (zoom / open event), drag (pan), two-finger pinch (zoom) ---
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    hideTooltip();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { dom.svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (pointers.size === 1) {
      gesture = {
        type: 'press', id: e.pointerId, x0: e.clientX, y0: e.clientY,
        target: e.target, shift: e.shiftKey, view: shown, moved: false
      };
    } else if (pointers.size === 2) {
      startPinch();
    } else {
      gesture = null;                                   // three or more fingers: ignore the gesture
    }
    if (e.pointerType === 'mouse') e.preventDefault();  // no text selection while dragging
  }

  function onPointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (gesture && gesture.type === 'pinch') {
      if (p) updatePinch();
      return;
    }
    if (gesture && gesture.type === 'press' && p && e.pointerId === gesture.id) {
      if (!gesture.moved) {
        const dx = e.clientX - gesture.x0;
        const dy = e.clientY - gesture.y0;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          gesture.moved = true;                         // becomes a drag: no zoom on release
          cancelAnimation();                            // freeze the view where it is and pan from there
          gesture.view = shown;
          hideTooltip();
          dom.svg.classList.add('dragging');
        }
      }
      if (gesture.moved) {
        const dxPx = e.clientX - gesture.x0;               // the content follows the pointer by this many pixels
        commit(viewOfPx(-dxPx, size.width - dxPx, gesture.view, e.clientX - svgLeft()),
          { animate: false, url: 'replace', stack: 'replace', discrete: false });
        if (e.pointerType !== 'touch') updateCursor(e.clientX);
        return;
      }
    }
    if (e.pointerType !== 'touch') updateHover(e);
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    try { dom.svg.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!gesture) return;
    if (gesture.type === 'pinch') {
      if (pointers.size < 2) endPinch();
      return;
    }
    if (gesture.type === 'press' && e.pointerId === gesture.id) {
      const g = gesture;
      gesture = null;
      dom.svg.classList.remove('dragging');
      if (g.moved) {
        suppressClickUntil = root.performance.now() + 400;
        return;
      }
      if (e.type === 'pointercancel') {                 // resync if the press interrupted an animation
        if (!sameView(shown, view)) { shown = view; render(); }
        return;
      }
      handleTap(g, e);
    }
  }

  function handleTap(g, e) {
    if (closestEra(g.target)) { zoomToRecorded(); return; }
    const evG = closestEvent(g.target);
    if (evG) {                                          // event tap opens the panel and never zooms
      openPanel(Number(evG.dataset.index));
      return;
    }
    const t = pxToT(e.clientX - svgLeft(), shown);
    if (e.shiftKey || g.shift) zoomOut();
    else zoomIn(t);
  }

  // Native click events are only used to stop propagation for event markers; taps are
  // resolved in pointerup so that pointer capture cannot change the target.
  function onClick(e) {
    if (root.performance.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
    if (closestEvent(e.target) || closestEra(e.target)) e.stopPropagation();
  }

  function startPinch() {
    cancelAnimation();
    hideTooltip();
    hideCursor();
    const ids = Array.from(pointers.keys());
    const a = pointers.get(ids[0]);
    const b = pointers.get(ids[1]);
    const left = svgLeft();
    gesture = {
      type: 'pinch', ids: ids, view: shown,
      p1: a.x - left, p2: b.x - left                      // where the fingers started, in stage pixels
    };
  }

  // Keep what is under each finger under it: the fingers define a stretch-and-slide of the pixel axis
  // (x' = s*x + o), and the new view is the part of the starting view that lands on the stage.
  function updatePinch() {
    const g = gesture;
    const pa = pointers.get(g.ids[0]);
    const pb = pointers.get(g.ids[1]);
    if (!pa || !pb) return;
    const left = svgLeft();
    const q1 = pa.x - left;
    const q2 = pb.x - left;
    if (Math.abs(q2 - q1) < 10 || Math.abs(g.p2 - g.p1) < 1) return;
    const sc = (q2 - q1) / (g.p2 - g.p1);
    if (!(sc > 0)) return;                              // fingers crossed
    const o = q1 - sc * g.p1;
    commit(viewOfPx(-o / sc, (size.width - o) / sc, g.view, (q1 + q2) / 2),
      { animate: false, url: 'replace', stack: 'replace', discrete: false });
  }

  function endPinch() {
    const rest = Array.from(pointers.entries());
    if (rest.length === 1) {                            // one finger left: continue as a pan
      const id = rest[0][0];
      const p = rest[0][1];
      gesture = { type: 'press', id: id, x0: p.x, y0: p.y, target: null, shift: false, view: shown, moved: true };
      dom.svg.classList.add('dragging');
    } else {
      gesture = null;
      dom.svg.classList.remove('dragging');
    }
    suppressClickUntil = root.performance.now() + 400;
  }

  function onPointerLeave() {
    lastMouseX = null;
    hideCursor();
    hideTooltip();
  }

  function updateHover(e) {
    lastMouseX = e.clientX;
    const evG = closestEvent(e.target);
    if (evG) showTooltip(Number(evG.dataset.index), e.clientX, e.clientY);
    else hideTooltip();
    updateCursor(e.clientX);
  }

  // --- Wheel / trackpad: zoom around the cursor; horizontal delta (or Shift) pans ---
  function onWheel(e) {
    e.preventDefault();
    if (!shown) return;
    cancelAnimation();
    hideTooltip();
    let dy = e.deltaY;
    let dx = e.deltaX;
    if (e.deltaMode === 1) { dy *= 16; dx *= 16; }
    else if (e.deltaMode === 2) { dy *= size.height; dx *= size.width; }
    const v = shown;
    const px = e.clientX - svgLeft();
    let f = 1;
    let panPx = dx;
    if (e.shiftKey && !e.ctrlKey) panPx += dy;
    else f = clamp(Math.exp(dy * (e.ctrlKey ? PINCH_K : WHEEL_K)), 0.5, 2);
    // Keep the date under the pointer where it is: the new view is the stretch of the current width from
    // px - px*f to px + (W - px)*f, moved along by the pan.
    const shift = panPx * f;
    let target = viewOfPx(px - px * f + shift, px + (size.width - px) * f + shift, v, panPx ? undefined : px);
    let fly = false;
    if (f < 1 && !panPx && warped(v)) {
      // Zooming in from the log overview onto recent times: the limit at today would slide the target out
      // from under the pointer, so go straight to the view resting on today that keeps it there.
      const tA = pxToT(px, v);
      const held = clampView(target.start, target.end);
      if (Math.abs(C.tToU(tA, held, nowT(), scaleMode) - px / size.width) > 0.01) {
        const alt = C.viewAtNowWithAnchor(tA, px / size.width, nowT(), scaleMode);
        if (alt && alt.end - alt.start < held.end - held.start) { target = alt; fly = true; }
      }
    }
    commit(target, { animate: fly, url: 'replace', stack: 'replace', discrete: false });
    updateCursor(e.clientX);
  }

  // --- Keyboard ---
  function onKeyDown(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    const tag = el && el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
    switch (e.key) {
      case '?':
        toggleHelp();
        e.preventDefault();
        break;
      case '/':
        toggleSearch(true);
        e.preventDefault();
        break;
      case 'Escape':
        if (dom.layerGroup && dom.layerGroup.classList.contains('open')) { toggleLayers(false); e.preventDefault(); }
        else if (dom.help && !dom.help.hidden) { toggleHelp(false); e.preventDefault(); }
        else if (dom.search && !dom.search.hidden) { toggleSearch(false); e.preventDefault(); }
        else if (!dom.panel.hidden) { closePanel(); e.preventDefault(); }
        else if (!dom.legend.hidden) { toggleLegend(false); e.preventDefault(); }
        else if (dom.today && !dom.today.hidden) { closeToday(); e.preventDefault(); }
        else if (dom.tours && !dom.tours.hidden) { toggleTours(false); e.preventDefault(); }
        else if (tour) { endTour(); e.preventDefault(); }
        else hideTooltip();
        break;
      case 'ArrowRight':
      case 'ArrowLeft': {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (tour) { tourStep(dir); e.preventDefault(); break; }
        if (el && el.closest && el.closest('#legend, #tours, #today, #help, #panel, #search')) break;   // leave lists and cards alone
        // Pan a fifth of the view (four fifths with Shift): the keyboard's answer to dragging.
        const base = view || rootView();
        const d = (base.end - base.start) * (e.shiftKey ? 0.8 : 0.2) * dir;
        commit({ start: base.start + d, end: base.end + d }, { animate: true, url: 'replace', stack: 'replace', discrete: false });
        announceView();
        e.preventDefault();
        break;
      }
      case '-':
      case '_':
        zoomOut();
        e.preventDefault();
        break;
      case '0':
        home();
        e.preventDefault();
        break;
      case 'Enter':
      case ' ': {
        const evG = closestEvent(e.target);             // a focused event marker opens its panel
        if (evG) { openPanel(Number(evG.dataset.index)); e.preventDefault(); }
        else if (closestEra(e.target)) { zoomToRecorded(); e.preventDefault(); }
        break;
      }
      case '+':
      case '=':
        zoomIn((shown.start + shown.end) / 2);
        e.preventDefault();
        break;
      case '1': case '2': case '3': case '4': case '5': case '6':
        setTheme(THEMES[Number(e.key) - 1]);
        e.preventDefault();
        break;
      case 'r':
      case 'R':
        setReigns(!reignsOn);
        e.preventDefault();
        break;
      case 'p':
      case 'P':
        setLives(!livesOn);
        e.preventDefault();
        break;
      case 'l':
      case 'L':
        if (dom.scaleToggle && !dom.scaleToggle.hidden) { dom.scaleToggle.click(); e.preventDefault(); }
        break;
      case 'e':
      case 'E':
        setEarth(!earthOn);
        e.preventDefault();
        break;
      case 't':
      case 'T': {
        const cur = THEMES.indexOf(resolveTheme(theme));
        setTheme(THEMES[(cur + 1) % THEMES.length]);
        e.preventDefault();
        break;
      }
      default:
        break;
    }
  }

  // --- Resize: window resize and stage size changes (panel open/close), debounced 100ms ---
  function onResize() {
    if (dom && shown) {                                  // cheap part right away: keep the SVG 1:1 with its box
      measureSize();
      dom.svg.setAttribute('width', size.width);
      dom.svg.setAttribute('height', size.height);
      dom.svg.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height);
    }
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = 0;
      widthCache.clear();                               // fonts may change with the viewport
      render();
    }, RESIZE_DEBOUNCE_MS);
  }

  // --- Browser history: popstate (back/forward) and hashchange (manual edits) ---
  function onLocationChange(e) {
    discardPendingUrl();
    const target = parseHash(root.location.hash) || rootView();
    if (!root.location.hash || root.location.hash.length < 2) pendingTour = null;
    syncTourFromUrl();
    syncPanelFromUrl();
    if (sameView(target, view)) return;
    const saved = e && e.state && e.state.ht ? restoreStack(e.state.stack, target) : null;
    stack = saved || deriveStack(target);
    commit(target, { animate: true, url: 'none', stack: 'keep' });
  }

  function bindEvents() {
    const svg = dom.svg;
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    svg.addEventListener('pointerleave', onPointerLeave);
    svg.addEventListener('click', onClick);
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('dblclick', function (e) { e.preventDefault(); });
    // Safari's own pinch-zoom gesture events
    svg.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    svg.addEventListener('gesturechange', function (e) { e.preventDefault(); });

    dom.btnOut.addEventListener('click', function () { zoomOut(); });
    dom.btnHome.addEventListener('click', function () { home(); });
    dom.btnLegend.addEventListener('click', function () { if (dom.search && !dom.search.hidden) toggleSearch(false); toggleLegend(); });
    dom.legend.addEventListener('click', onLegendClick);
    if (dom.btnHelp) {
      dom.btnHelp.addEventListener('click', function () { toggleHelp(); });
      dom.helpClose.addEventListener('click', function () { toggleHelp(false); });
      dom.helpOk.addEventListener('click', function () { toggleHelp(false); });
    }
    if (dom.panelCopy) dom.panelCopy.addEventListener('click', copyEventLink);
    if (dom.minimap) {
      dom.minimap.addEventListener('pointerdown', function (e) {
        mmDrag = true;
        mmDownX = e.clientX;
        mmMoved = false;
        try { dom.minimap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        minimapGo(e, true);
        e.preventDefault();
      });
      dom.minimap.addEventListener('pointermove', function (e) {
        if (!mmDrag || isRoot(view)) return;
        if (!mmMoved && Math.abs(e.clientX - mmDownX) < 3) return;     // a click, not a drag
        mmMoved = true;
        minimapGo(e, false);
      });
      const endDrag = function () { if (mmDrag) { mmDrag = false; flushUrl(); } };
      dom.minimap.addEventListener('pointerup', endDrag);
      dom.minimap.addEventListener('pointercancel', endDrag);
    }
    if (dom.btnSearch) {
      dom.btnSearch.addEventListener('click', function () { toggleSearch(); });
      dom.searchInput.addEventListener('input', onSearchInput);
      dom.searchInput.addEventListener('keydown', onSearchKey);
      dom.searchResults.addEventListener('click', function (e) {
        const li = e.target && typeof e.target.closest === 'function' ? e.target.closest('li[data-k]') : null;
        if (li) chooseSearchHit(Number(li.dataset.k));
      });
    }
    dom.crumbs.addEventListener('click', onCrumbClick);
    dom.panelClose.addEventListener('click', closePanel);
    dom.panelZoom.addEventListener('click', function () {
      const ev = events()[selected];
      if (ev) zoomToEvent(ev);
    });

    document.addEventListener('keydown', onKeyDown);
    root.addEventListener('resize', onResize);
    root.addEventListener('popstate', onLocationChange);
    root.addEventListener('hashchange', onLocationChange);
    if (typeof root.ResizeObserver === 'function') {
      const ro = new root.ResizeObserver(onResize);
      ro.observe(dom.stage);
    }
  }
