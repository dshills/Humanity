/* HT.layout — greedy lane packing for event labels (CONTRACT.md §5) */
(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});

  const DEFAULT_GAP = 8;        // px between neighbours in a lane
  const DEFAULT_MAX_LANES = 6;

  function finiteOr(v, fallback) {
    v = Number(v);
    return Number.isFinite(v) ? v : fallback;
  }

  // Sort key: priority asc, then x0 asc, then original index asc. The index tiebreak makes
  // the order stable regardless of the engine's sort implementation.
  function byPriorityThenX(u, v) {
    if (u.p !== v.p) return u.p < v.p ? -1 : 1;
    if (u.lo !== v.lo) return u.lo < v.lo ? -1 : 1;
    return u.index - v.index;
  }

  // Can `r` sit in lane `L` without coming within `gap` px of ANY occupant? Occupants arrive
  // in priority order, not x order, so a later item may fall to the left of (or between)
  // earlier ones; the lane's overall [min,max] extent is only a fast accept, never a reject.
  function fits(L, r, gap) {
    if (r.lo - gap >= L.max || r.hi + gap <= L.min) return true;
    const occ = L.occ;
    for (let i = 0; i < occ.length; i++) {
      const q = occ[i];
      if (r.lo - gap < q.hi && q.lo - gap < r.hi) return false;
    }
    return true;
  }

  // packLanes(items, opts?) -> { lanes, placed: [{ index, lane }], dropped: [index] }
  //   items: [{ x0, x1, priority }]   px; x1 > x0 already includes label width;
  //                                   priority: lower = more important (use tier)
  //   opts.gap      (default 8)       px between neighbours in a lane
  //   opts.maxLanes (default 6)
  // Stable sort by (priority asc, x0 asc); each item takes the lowest lane in 0..maxLanes-1
  // where it overlaps nothing already placed there; otherwise it is dropped. `lanes` is the
  // number of lanes actually used. `placed` and `dropped` are both sorted by index.
  // Pure function: no DOM, and neither `items` nor `opts` is mutated.
  function packLanes(items, opts) {
    const o = opts || {};
    let gap = finiteOr(o.gap, DEFAULT_GAP);
    if (gap < 0) gap = 0;
    let maxLanes = Math.floor(finiteOr(o.maxLanes, DEFAULT_MAX_LANES));
    if (maxLanes < 0) maxLanes = 0;

    const placed = [];
    const dropped = [];
    if (!Array.isArray(items) || items.length === 0) {
      return { lanes: 0, placed: placed, dropped: dropped };
    }

    // Snapshot the inputs into private records so sorting never touches the caller's data.
    const recs = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const a = it == null ? NaN : Number(it.x0);
      const b = it == null ? NaN : Number(it.x1);
      if (!Number.isFinite(a) || !Number.isFinite(b)) { dropped.push(i); continue; }
      let p = it.priority == null ? Infinity : Number(it.priority);
      if (Number.isNaN(p)) p = Infinity;
      recs.push({ index: i, lo: Math.min(a, b), hi: Math.max(a, b), p: p });
    }
    recs.sort(byPriorityThenX);

    const lanes = [];   // lanes[k] = { occ: [rec], min, max }; allocated contiguously from 0
    for (let n = 0; n < recs.length; n++) {
      const r = recs[n];
      let lane = -1;
      for (let k = 0; k < maxLanes; k++) {
        if (k === lanes.length || fits(lanes[k], r, gap)) { lane = k; break; }
      }
      if (lane < 0) { dropped.push(r.index); continue; }
      if (lane === lanes.length) lanes.push({ occ: [], min: Infinity, max: -Infinity });
      const L = lanes[lane];
      L.occ.push(r);
      if (r.lo < L.min) L.min = r.lo;
      if (r.hi > L.max) L.max = r.hi;
      placed.push({ index: r.index, lane: lane });
    }

    placed.sort(function (u, v) { return u.index - v.index; });
    dropped.sort(function (u, v) { return u - v; });
    return { lanes: lanes.length, placed: placed, dropped: dropped };
  }

  HT.layout = {
    DEFAULT_GAP: DEFAULT_GAP,
    DEFAULT_MAX_LANES: DEFAULT_MAX_LANES,
    packLanes: packLanes
  };
})(typeof window !== 'undefined' ? window : globalThis);
