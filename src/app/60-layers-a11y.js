// HT.app, part 60: Layers menu and accessibility helpers.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Layers menu (mid-width headers): the Earth, Reigns, Lives and Legend buttons folded behind one button ---
  function layersFolded() { return !!dom.btnLayers && root.getComputedStyle(dom.btnLayers).display !== 'none'; }

  function toggleLayers(force) {
    if (!dom.btnLayers || !dom.layerGroup) return;
    const was = dom.layerGroup.classList.contains('open');
    const open = force === undefined ? !was : !!force;
    if (open === was) return;
    if (open) rememberFocus('layers');
    dom.layerGroup.classList.toggle('open', open);
    dom.btnLayers.setAttribute('aria-expanded', String(open));
    if (open) focusFirst(dom.layerGroup); else restoreFocus('layers', dom.btnLayers);
  }

  // --- Accessibility helpers ---
  // Overlays take the focus when they open and hand it back to whatever had it when they close.
  const focusBack = new Map();
  function rememberFocus(key) {
    const el = document.activeElement;
    if (el && el !== document.body) focusBack.set(key, el);
  }
  function restoreFocus(key, fallback) {
    const el = focusBack.get(key);
    focusBack.delete(key);
    const target = el && el.isConnected && !el.disabled && !(el.closest && el.closest('[hidden]')) ? el : fallback;
    if (target && typeof target.focus === 'function') { try { target.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
  }
  function focusFirst(container, selector) {
    const el = container && container.querySelector(selector || 'button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (el) { try { el.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
  }

  // A polite live region says where the view has landed after a jump, and what a filter or list now holds.
  let announceTimer = 0;
  function announce(text, delay) {
    if (!dom || !dom.srStatus) return;
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { announceTimer = 0; dom.srStatus.textContent = typeof text === 'function' ? text() : text; }, delay === undefined ? 500 : delay);
  }
  function announceView() {
    if (tour) return;                                     // the tour bar narrates itself
    announce(function () {
      const v = view || shown;
      const label = isRoot(v) ? 'All of humanity, 300,000 years ago to today' : HT.time.formatRange(v.start, capNow(v.end));
      return 'Showing ' + label + '. ' + hudStats.inWindow + (hudStats.inWindow === 1 ? ' event' : ' events') + ' in view.';
    }, 700);
  }
