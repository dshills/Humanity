// HT.app, part 54: Panel lists: neighbours, related events, outbound links.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Panel: what happened around this event, and more of its kind ---
  const fmtGap = C.fmtGap;

  function fillEventList(ul, indices, ref) {
    const list = events();
    const items = indices.map(function (i) {
      const li = htmlEl('li');
      const b = htmlEl('button', 'panel-jump');
      b.type = 'button';
      b.dataset.index = String(i);
      b.appendChild(htmlEl('span', 'when', list[i].life ? HT.time.formatYear(list[i].t) + ' \u2013 ' + HT.time.formatYear(list[i].end) : fmtGap(list[i].t - ref.t)));
      b.appendChild(htmlEl('span', 'what', list[i].title));
      li.appendChild(b);
      return li;
    });
    ul.replaceChildren.apply(ul, items);
  }

  function updatePanelNearby(index) {
    if (!dom.panelNear) return;
    const list = events();
    const ev = list[index];
    const curatedCount = HT.curatedCount || 0;         // set by the build where the hand-written data files end
    const near = ev.life ? C.pickContemporaries(list, index, 5)
      : C.pickNearby(list, index, passesFilters, curatedCount ? function (o, i) { return i < curatedCount; } : null);
    dom.panelNear.hidden = near.length === 0;
    dom.panelNear.querySelector('h3').textContent = ev.life ? 'Alive at the same time' : ev.group ? 'Before and after in this office' : 'Around this time';
    fillEventList(dom.panelNearList, near, ev);

    // More of the same category, preferring the same part of the world.
    const related = C.pickRelated(list, index, near, eventRegion);
    const labels = { namerica: 'N. America', samerica: 'S. America' };
    const region = eventRegion(index);
    dom.panelRelated.hidden = related.length === 0;
    const cat = String(ev.category || '');
    dom.panelRelatedHead.textContent = 'More in ' + cat + (region ? ' \u00b7 near ' + (labels[region] || region.charAt(0).toUpperCase() + region.slice(1)) : '');
    fillEventList(dom.panelRelatedList, related, ev);
  }

  function jumpToEvent(i) {
    const ev = events()[i];
    if (!ev) return;
    revealEvent(i);
    const inView = !ev.life && shown && ev.t >= shown.start && ev.t <= shown.end && ev.tier <= hudStats.tier && !(ev.otd && !otdShown(shown));
    if (!inView) zoomToEvent(ev);
    openPanel(i);
  }

  // Static links out: nothing is requested until one is followed.
  function updatePanelMore(ev) {
    if (!dom.panelMore) return;
    const links = [];
    const add = function (label, url) { if (/^https:\/\//.test(url)) links.push([label, url]); };
    if (Array.isArray(ev.links)) ev.links.slice(0, 6).forEach(function (l) { add(l.title, l.url); });
    const T = HT.time;
    const p = T.toParts(ev.t);
    const hy = T.histYear(ev.t);
    const yearPage = C.yearArticle(hy);
    if (yearPage) add('The year ' + T.formatYear(ev.t), WIKI_PREFIX + yearPage);
    if (hy >= 1 && !(p.month === 1 && p.day === 1)) add(MONTH_NAMES[p.month - 1] + ' ' + p.day + ' in history', WIKI_PREFIX + MONTH_NAMES[p.month - 1] + '_' + p.day);
    const c = eventCoords(ev);
    if (c) add('Open the place on a map', 'https://www.openstreetmap.org/?mlat=' + c[0] + '&mlon=' + c[1] + '#map=6/' + c[0] + '/' + c[1]);
    if (typeof ev.link === 'string' && ev.link.indexOf(WIKI_PREFIX) === 0) add('Wikidata item', 'https://www.wikidata.org/wiki/Special:ItemByTitle/enwiki/' + ev.link.slice(WIKI_PREFIX.length));
    const nodes = links.map(function (l) {
      const a = htmlEl('a', '', l[0] + ' ↗');
      a.href = l[1]; a.target = '_blank'; a.rel = 'noopener noreferrer';
      return a;
    });
    dom.panelMore.replaceChildren.apply(dom.panelMore, nodes);
    dom.panelMore.hidden = nodes.length === 0;
  }
