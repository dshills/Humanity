// HT.app, part 38: Visual modes.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Themes (sensor modes) ---
  function resolveTheme(name) {
    if (name !== 'auto') return name;
    const light = typeof root.matchMedia === 'function' && root.matchMedia('(prefers-color-scheme: light)').matches;
    return light ? 'paper' : 'ops';
  }

  function applyTheme() {
    if (typeof document === 'undefined') return;
    const t = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', t);
    if (dom && dom.dock) {
      const bs = dom.dock.querySelectorAll('button[data-theme]');
      for (let i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(bs[i].dataset.theme === t));
    }
    if (dom && dom.hudMode) dom.hudMode.textContent = t.toUpperCase();
  }

  function setTheme(name, opts) {
    if (name !== 'auto' && THEMES.indexOf(name) < 0) return;
    theme = name;
    try {
      if (name === 'auto') root.localStorage.removeItem(THEME_KEY);
      else root.localStorage.setItem(THEME_KEY, name);
    } catch (err) { /* storage may be unavailable */ }
    applyTheme();
    if (dom && view && !(opts && opts.silent)) writeUrl('replace');
  }

  function getTheme() { return theme; }
