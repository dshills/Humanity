// HT.app, part 56: Today in history.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Today in history (opt-in): the on-this-day list for the visitor's own date, as jumps into the timeline ---
  function todayKey() {
    const d = new Date();
    return { month: d.getMonth() + 1, day: d.getDate(), key: (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '/' + (d.getDate() < 10 ? '0' : '') + d.getDate() };
  }

  function renderToday(state) {
    if (!dom.today) return;
    const td = todayKey();
    const head = htmlEl('div', 'today-head');
    head.appendChild(htmlEl('h3', '', td.day + ' ' + MONTH_NAMES[td.month - 1] + ' in history'));
    const close = htmlEl('button', 'today-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Close');
    head.appendChild(close);
    const parts = [head];
    if (state === 'loading') parts.push(htmlEl('p', 'today-note', 'Loading today’s list from Wikipedia …'));
    else if (state === 'error') parts.push(htmlEl('p', 'today-note', 'Wikipedia could not be reached. Try again in a moment.'));
    else {
      const list = events();
      const hits = C.onCalendarDay(list, td.month, td.day);
      if (!hits.length) parts.push(htmlEl('p', 'today-note', 'Nothing is recorded for this date.'));
      const ul = htmlEl('ul', 'today-list');
      for (let k = hits.length - 1; k >= 0; k--) {          // most recent first
        const ev = list[hits[k]];
        const li = htmlEl('li');
        const b = htmlEl('button', 'today-item');
        b.type = 'button'; b.dataset.index = String(hits[k]);
        b.appendChild(htmlEl('span', 'when', HT.time.formatYear(ev.t)));
        b.appendChild(htmlEl('span', 'what', ev.otd ? ev.detail : ev.title));
        li.appendChild(b);
        ul.appendChild(li);
      }
      parts.push(ul);
      parts.push(htmlEl('p', 'today-note', hits.length + ' events · text from Wikipedia, CC BY-SA 4.0'));
    }
    dom.today.replaceChildren.apply(dom.today, parts);
  }

  function openToday() {
    if (!dom.today) return;
    toggleTours(false);
    if (dom.help && !dom.help.hidden) toggleHelp(false);
    if (!dom.legend.hidden) toggleLegend(false);
    if (!imagesOn) setImages(true);                       // the entry says so: this list comes from Wikipedia
    rememberFocus('today');                               // by now the card it came from has handed focus back to its button
    dom.today.hidden = false;
    renderToday('loading');
    focusFirst(dom.today, '.today-close');
    loadOtdDay(todayKey().key).then(function (state) {
      if (dom.today.hidden) return;
      renderToday(state);
      focusFirst(dom.today, '.today-item, .today-close');
      const n = dom.today.querySelectorAll('.today-item').length;
      announce(state === 'error' ? 'Wikipedia could not be reached.' : n + ' events listed for today\u2019s date, most recent first.', 100);
    });
  }

  function closeToday(opts) {
    if (!dom.today || dom.today.hidden) return;
    dom.today.hidden = true;
    if (opts && opts.keepFocus) focusBack.delete('today'); else restoreFocus('today', dom.btnTours);
  }
