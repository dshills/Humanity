// HT.app, part 44: Cursor guide and breadcrumbs.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // --- Cursor guide line + header readout ---
  function updateCursor(clientX) {
    if (!dom || !shown) return;
    const px = clientX - svgLeft();
    if (px < 0 || px > size.width) { hideCursor(); return; }
    dom.cursorLine.setAttribute('x1', crisp(px));
    dom.cursorLine.setAttribute('x2', crisp(px));
    dom.cursorLine.setAttribute('visibility', 'visible');
    const tCur = capNow(pxToT(px, shown));              // past the Today line the readout stays on today
    const label = cursorLabel(tCur, shown.end - shown.start);
    dom.cursorDate.textContent = label;
    if (dom.hudEarth) dom.hudEarth.textContent = earthReadout(tCur);
    updateCityReadout(tCur);
    if (dom.cursorChip) {
      if (dom.cursorChip.textContent !== label) {     // measure only when the text changes (no layout per mousemove)
        dom.cursorChip.textContent = label;
        dom.cursorChip.hidden = false;
        chipHalf = dom.cursorChip.offsetWidth / 2 + 6;
      }
      dom.cursorChip.hidden = false;
      const half = chipHalf;
      dom.cursorChip.style.left = Math.round(clamp(px, half, size.width - half)) + 'px';
      dom.cursorChip.style.top = (lastAxisY + 40) + 'px';
    }
  }

  function hideCursor() {
    if (!dom) return;
    dom.cursorLine.setAttribute('visibility', 'hidden');
    if (dom.cursorChip) dom.cursorChip.hidden = true;
  }

  // --- Breadcrumbs ---
  function renderCrumbs() {
    if (!dom) return;
    const frag = document.createDocumentFragment();
    const last = stack.length - 1;
    for (let i = 0; i < stack.length; i++) {
      const e = stack[i];
      const b = htmlEl('button', 'crumb' + (i === last ? ' current' : ''),
        i === 0 ? ROOT_CRUMB : HT.time.formatRange(e.start, capNow(e.end)));
      b.type = 'button';
      b.dataset.index = String(i);
      if (i === last) b.setAttribute('aria-current', 'page');
      frag.appendChild(b);
    }
    dom.crumbs.replaceChildren(frag);
    dom.crumbs.scrollLeft = dom.crumbs.scrollWidth;     // keep the current crumb in view when the chain is long
    dom.btnOut.disabled = stack.length <= 1 && isRoot(view);
  }

  function onCrumbClick(e) {
    const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.crumb') : null;
    if (!b) return;
    const i = Number(b.dataset.index);
    if (!(i >= 0) || i >= stack.length - 1) return;
    stack.length = i + 1;
    commit(stack[i], { animate: true, url: 'push', stack: 'keep' });
  }
