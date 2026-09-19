// HT.app, part 62: Guided tours and Your lifetime.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Guided tours (HT.tours): a fixed path of events with a line of narration each. A step zooms to its
  // event and opens its panel; the step rides in the URL (tour=<id>.<n>), so Back, Forward and shared links work. ---
  function tourDefs() {
    const base = Array.isArray(HT.tours) ? HT.tours : [];
    const mine = lifetimeDef();
    return mine ? base.concat([mine]) : base;
  }

  // --- Your lifetime: a band from a birth year to today, and a tour generated from the events inside it ---
  function lifetimeDef() {
    if (birthYear === null) return null;
    if (lifeTourDef && lifeTourDef.birth === birthYear) return lifeTourDef;
    const made = C.lifetimeTour(events(), birthYear, nowT(), HT.curatedCount || 0);
    if (!made.steps.length) return null;
    const pop = HT.context && HT.context.pop;
    const co2 = HT.earth && HT.earth.series && HT.earth.series.co2;
    const p0 = pop ? seriesAt(pop, birthYear + 0.5, EARTH_HOLD.pop) : null;
    const p1 = pop ? seriesAt(pop, nowT(), EARTH_HOLD.pop) : null;
    const c0 = co2 ? seriesAt(co2, birthYear + 0.5, EARTH_HOLD.co2) : null;
    const c1 = co2 ? seriesAt(co2, nowT(), EARTH_HOLD.co2) : null;
    let note = 'You were born in ' + birthYear + '. Since then this timeline records ' + made.count.toLocaleString('en-US') + ' events';
    if (p0 && p1) note += '; the world has grown from ' + popFormat(p0).toLowerCase().replace(' b', ' billion').replace(' m', ' million') + ' to ' + popFormat(p1).toLowerCase().replace(' b', ' billion').replace(' m', ' million') + ' people';
    if (c0 && c1) note += ', and CO\u2082 in the air from ' + Math.round(c0) + ' to ' + Math.round(c1) + ' ppm';
    made.steps[0].note = note + '.';
    lifeTourDef = { id: 'your-lifetime', title: 'Your lifetime', blurb: '', steps: made.steps, birth: birthYear, generated: true };
    return lifeTourDef;
  }

  function setBirthYear(y) {
    const year = Math.floor(Number(y));
    const ok = Number.isFinite(year) && year >= 1900 && year <= Math.floor(nowT());
    birthYear = ok ? year : null;
    lifeTourDef = null;
    try { if (ok) root.localStorage.setItem(BIRTH_KEY, String(year)); else root.localStorage.removeItem(BIRTH_KEY); } catch (err) { /* ignore */ }
    if (!ok && tour && tour.def.generated) endTour();
    if (dom && shown) render();
    return ok;
  }

  function renderLifeBand(v, axisY) {
    if (!dom.gLife) return;
    if (birthYear === null || birthYear > v.end || nowT() < v.start) { if (dom.gLife.firstChild) dom.gLife.replaceChildren(); return; }
    const w = size.width;
    const x0 = clamp(tToPx(birthYear, v), 0, w);
    const x1 = clamp(tToPx(nowT(), v), 0, w);
    const parts = [];
    if (x1 - x0 >= 2 && !(x0 <= 0 && x1 >= w)) parts.push(svgEl('rect', { class: 'mylife-zone', x: x0, y: 0, width: x1 - x0, height: size.height }));
    if (x0 > 0) parts.push(svgEl('line', { class: 'mylife-line', x1: crisp(x0), x2: crisp(x0), y1: 0, y2: size.height }));
    if (x1 - x0 >= 90) parts.push(svgEl('text', { class: 'mylife-label', x: x0 + 8, y: axisY + 42 }, 'Your lifetime \u00b7 ' + Math.floor(nowT() - birthYear) + ' years'));
    dom.gLife.replaceChildren.apply(dom.gLife, parts);
  }

  function renderLifeForm() {
    const wrap = htmlEl('form', 'life-form');
    wrap.appendChild(htmlEl('h3', '', 'Your lifetime'));
    wrap.appendChild(htmlEl('p', '', 'Enter the year you were born to see your own years marked on the timeline and take a tour of what has happened in them. It stays in this browser: it is never sent anywhere or put in a link.'));
    const label = htmlEl('label', '', 'Year you were born ');
    const input = htmlEl('input');
    input.type = 'number'; input.min = '1900'; input.max = String(Math.floor(nowT())); input.step = '1'; input.inputMode = 'numeric'; input.required = true;
    input.id = 'life-year'; if (birthYear !== null) input.value = String(birthYear);
    label.appendChild(input);
    wrap.appendChild(label);
    const row = htmlEl('div', 'life-actions');
    const go = htmlEl('button', 'life-go', 'Show my lifetime'); go.type = 'submit';
    const clear = htmlEl('button', '', 'Forget it'); clear.type = 'button'; clear.hidden = birthYear === null;
    const back = htmlEl('button', '', 'Back'); back.type = 'button';
    row.appendChild(go); row.appendChild(clear); row.appendChild(back);
    wrap.appendChild(row);
    const msg = htmlEl('p', 'life-msg'); msg.setAttribute('role', 'alert');
    wrap.appendChild(msg);
    wrap.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!setBirthYear(input.value)) { msg.textContent = 'Enter a year between 1900 and ' + Math.floor(nowT()) + '.'; return; }
      toggleTours(false);
      startTour('your-lifetime', 0);
    });
    clear.addEventListener('click', function () { setBirthYear(null); announce('Your lifetime has been forgotten.'); restoreTourCard(); });
    back.addEventListener('click', restoreTourCard);
    dom.tours.replaceChildren(wrap);
    try { input.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
  }

  function restoreTourCard() {
    if (!dom.tours || !dom.toursHead) return;
    dom.tours.replaceChildren(dom.toursHead, dom.tourList);
    refreshTourLists();
    focusFirst(dom.tours);
  }

  function openLifeForm() {
    if (dom.help && !dom.help.hidden) toggleHelp(false);
    if (dom.tours.hidden) toggleTours(true);
    renderLifeForm();
  }

  function indexOfTitle(title) {
    if (!titleIndex) {
      titleIndex = new Map();
      const list = events();
      for (let i = 0; i < list.length; i++) if (!list[i].otd && !titleIndex.has(list[i].title)) titleIndex.set(list[i].title, i);
    }
    const i = titleIndex.get(title);
    return i === undefined ? -1 : i;
  }

  function renderTourBar() {
    if (!dom.tourBar) return;
    document.body.classList.toggle('touring', !!tour);
    dom.tourBar.hidden = !tour;
    // Narrow screens: the bar lives in the panel sheet while that is open, in the stage otherwise.
    const narrow = typeof root.matchMedia === 'function' && root.matchMedia('(max-width: 640px)').matches;
    const home = tour && narrow && !dom.panel.hidden ? dom.panel : dom.stage;
    if (dom.tourBar.parentNode !== home) {
      if (home === dom.panel) dom.panel.insertBefore(dom.tourBar, dom.panelCategory);
      else dom.stage.insertBefore(dom.tourBar, dom.tooltip);
    }
    if (dom.btnTours) dom.btnTours.classList.toggle('active', !!tour);
    if (!tour) return;
    const n = tour.def.steps.length;
    dom.tourTitle.textContent = tour.def.title;
    dom.tourCount.textContent = (tour.step + 1) + ' / ' + n;
    dom.tourNote.textContent = tour.def.steps[tour.step].note;
    dom.tourPrev.disabled = tour.step === 0;
    dom.tourNext.textContent = tour.step === n - 1 ? 'Finish' : 'Next ›';
    if (dom.tourEdit) dom.tourEdit.hidden = !tour.def.generated;
  }

  // Show step k: reveal the event, open its panel (so the URL written by the zoom already names it), zoom.
  function showTourStep(k) {
    if (!tour) return;
    tour.step = clamp(k, 0, tour.def.steps.length - 1);
    const step = tour.def.steps[tour.step];
    if (step.view) {                                      // a framing step with no event of its own
      if (!dom.panel.hidden) closePanel({ silent: true });
      renderTourBar();
      const was = view;
      commit(step.view, { animate: true, url: 'push', stack: 'push', discrete: true });
      if (sameView(was, view)) writeUrl('push');
      return;
    }
    const i = indexOfTitle(step.ev);
    renderTourBar();
    if (i < 0) { writeUrl('replace'); return; }           // a step whose event is gone: keep the narration, stay put
    revealEvent(i);
    openPanel(i, { silent: true });
    const ev = events()[i];
    const before = view;
    zoomToEvent(ev);
    if (sameView(before, view)) writeUrl('push');         // already framed: the zoom was a no-op, record the step anyway
  }

  function startTour(id, step) {
    const def = tourDefs().filter(function (t) { return t.id === id; })[0];
    if (!def || !def.steps || !def.steps.length) return;
    toggleTours(false);
    if (dom.help && !dom.help.hidden) toggleHelp(false);
    if (!dom.legend.hidden) toggleLegend(false);
    if (dom.search && !dom.search.hidden) toggleSearch(false);
    tour = { def: def, step: 0 };
    showTourStep(step || 0);
  }

  function tourStep(delta) {
    if (!tour) return;
    if (delta > 0 && tour.step === tour.def.steps.length - 1) { endTour(); return; }
    showTourStep(tour.step + delta);
  }

  function endTour() {
    if (!tour) return;
    tour = null;
    pendingTour = null;
    renderTourBar();
    if (view) writeUrl('replace');
    if (shown) render();                                  // the chip and dock come back
  }

  // Match the tour state to the tour= parameter last parsed from the URL, without moving the view: the same
  // URL already carries the view and the open event.
  function syncTourFromUrl() {
    if (!dom) return;
    const want = pendingTour;
    const def = want ? tourDefs().filter(function (t) { return t.id === want.id; })[0] : null;
    if (!def) { if (tour) { tour = null; renderTourBar(); } return; }
    tour = { def: def, step: clamp(want.step, 0, def.steps.length - 1) };
    renderTourBar();
  }

  // Fills a container with the Today entry and one button per tour. It can be called again at any time (the
  // date in the Today entry is refreshed whenever a list is shown); the click listener is bound only once.
  function tourButtons(container, onPick) {
    const td = todayKey();
    const todayBtn = htmlEl('button', 'tour-pick today-pick');
    todayBtn.type = 'button';
    todayBtn.dataset.tour = '@today';
    todayBtn.appendChild(htmlEl('span', 'tp-title', 'Today in history'));
    todayBtn.appendChild(htmlEl('span', 'tp-blurb', 'What happened on ' + td.day + ' ' + MONTH_NAMES[td.month - 1] + ' across two thousand years. Loads the list from Wikipedia and turns on online content.'));
    todayBtn.appendChild(htmlEl('span', 'tp-steps', td.day + ' ' + MONTH_NAMES[td.month - 1].slice(0, 3)));
    const lifeBtn = htmlEl('button', 'tour-pick today-pick');
    lifeBtn.type = 'button';
    lifeBtn.dataset.tour = '@life';
    lifeBtn.appendChild(htmlEl('span', 'tp-title', 'Your lifetime'));
    lifeBtn.appendChild(htmlEl('span', 'tp-blurb', birthYear === null ? 'Enter the year you were born to see your own years on the timeline and tour what has happened in them. Kept in this browser only.' : 'Born ' + birthYear + ': your years on the timeline, and a tour of what has happened in them.'));
    lifeBtn.appendChild(htmlEl('span', 'tp-steps', birthYear === null ? 'You' : String(birthYear)));
    const nodes = [todayBtn, lifeBtn].concat(tourDefs().filter(function (t) { return !t.generated; }).map(function (t) {
      const b = htmlEl('button', 'tour-pick');
      b.type = 'button';
      b.dataset.tour = t.id;
      b.appendChild(htmlEl('span', 'tp-title', t.title));
      b.appendChild(htmlEl('span', 'tp-blurb', t.blurb));
      b.appendChild(htmlEl('span', 'tp-steps', t.steps.length + ' steps'));
      return b;
    }));
    container.replaceChildren.apply(container, nodes);
    if (container.dataset.bound === '1') return;
    container.dataset.bound = '1';
    container.addEventListener('click', function (e) {
      const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.tour-pick') : null;
      if (!b) return;
      if (b.dataset.tour === '@today') openToday();
      else if (b.dataset.tour === '@life') { if (birthYear === null) openLifeForm(); else { toggleTours(false); if (dom.help && !dom.help.hidden) toggleHelp(false); startTour('your-lifetime', 0); } }
      else onPick(b.dataset.tour);
    });
  }

  function refreshTourLists() {
    const start = function (id) { startTour(id, 0); };
    if (dom.tourList) tourButtons(dom.tourList, start);
    if (dom.helpTours && dom.helpTourList) tourButtons(dom.helpTourList, start);
  }

  function toggleTours(force) {
    if (!dom.tours) return;
    const open = force === undefined ? dom.tours.hidden : !!force;
    if (open) {
      if (!dom.legend.hidden) toggleLegend(false);
      if (dom.search && !dom.search.hidden) toggleSearch(false);
      if (dom.help && !dom.help.hidden) toggleHelp(false);
      closeToday();
      if (dom.toursHead) dom.tours.replaceChildren(dom.toursHead, dom.tourList);   // the lifetime form may have replaced them
      refreshTourLists();
    }
    const was = !dom.tours.hidden;
    if (open && !was) rememberFocus('tours');
    dom.tours.hidden = !open;
    if (dom.btnTours) dom.btnTours.setAttribute('aria-expanded', String(open));
    if (open && !was) focusFirst(dom.tours);
    if (!open && was && !tour) restoreFocus('tours', dom.btnTours);
  }
