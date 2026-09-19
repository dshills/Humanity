// HT.app, part 25: Public navigation API: setView, zoomIn, zoomOut, home, zoomToEvent.
// One of the files that build.mjs joins, in name order, inside a single closure (see src/app/README.md):
// everything here shares scope with the other parts, so nothing is exported or imported.

  // ------------------------------------------------------------------
  // 4. Public navigation API
  // ------------------------------------------------------------------
  function getView() {
    const v = view || rootView();
    return { start: v.start, end: v.end };
  }

  function setView(start, end, opts) {
    opts = opts || {};
    const animate = opts.animate !== false;
    const push = opts.pushHistory !== false;
    commit({ start: start, end: end }, {
      animate: animate,
      url: push ? 'push' : 'replace',
      stack: push ? 'push' : 'replace',
      discrete: push
    });
  }

  function zoomIn(tCenter, factor) {
    factor = factor > 0 ? factor : ZOOM_FACTOR;
    // Base the new span on the committed view, not the in-flight animation frame, so that a
    // second click during (or before the first frame of) an animation still zooms a further x4.
    const base = view || rootView();
    const baseSpan = base.end - base.start;
    if (baseSpan <= MIN_SPAN * (1 + 1e-6)) return;     // already at maximum zoom: a click is a no-op
    if (!Number.isFinite(tCenter)) tCenter = (base.start + base.end) / 2;
    // The clicked date moves to the middle and 1/factor of the width around it fills the stage, slid back
    // inside when it would overhang an edge. On a linear view that is a span of baseSpan / factor; on a
    // warped one it is whatever that stretch of the screen holds.
    const half = 0.5 / factor;
    const uc = clamp(C.tToU(tCenter, base, nowT(), scaleMode), half, 1 - half);
    let target = C.viewFromU(uc - half, uc + half, base, nowT(), scaleMode);
    if (warped(base)) target = C.anchorView(target, C.uToT(uc, base, nowT(), scaleMode), 0.5, nowT(), scaleMode);   // keep the middle in the middle
    if (target.end - target.start < MIN_SPAN) target = fitInside({ start: tCenter - MIN_SPAN / 2, end: tCenter + MIN_SPAN / 2 }, base);
    commit(target, { animate: true, url: 'push', stack: 'push', discrete: true });
  }

  // Reverses the last discrete zoom-in when there is one; otherwise zooms out ×factor around the center.
  function zoomOut(factor) {
    factor = factor > 0 ? factor : ZOOM_FACTOR;
    const top = stack[stack.length - 1];
    if (stack.length > 1 && top && top.discrete && sameView(top, view)) {
      stack.pop();
      const parent = stack[stack.length - 1];
      commit(parent, { animate: true, url: 'push', stack: 'keep' });
      return;
    }
    const base = view || rootView();
    const c = (base.start + base.end) / 2;
    const span = (base.end - base.start) * factor;
    commit({ start: c - span / 2, end: c + span / 2 },
      { animate: true, url: 'push', stack: 'replace', discrete: false });
  }

  function home() {
    commit(rootView(), { animate: true, url: 'push', stack: 'push', discrete: true });
  }

  // The target window is C.eventWindow; when the event is already on screen the window is kept inside the
  // current view so the breadcrumb chain stays nested.
  function zoomToEvent(ev) {
    if (!ev || !Number.isFinite(ev.t)) return;
    const win = C.eventWindow(ev, nowT(), tierSpan(ev.tier));
    const base = view || rootView();
    const target = ev.t >= base.start && ev.t <= base.end ? fitInside(win, base) : win;
    commit(target, { animate: true, url: 'push', stack: 'push', discrete: true });
  }
