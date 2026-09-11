'use strict';
// Tests for HT.layout.packLanes — written against CONTRACT.md §5 only.
//
//   packLanes(items, opts?) -> { lanes: number, placed: [{ index, lane }], dropped: [index] }
//   items: [{ x0, x1, priority }]   px; x1 > x0; priority: lower = more important
//   opts.gap      (default 8)   px between neighbors in a lane
//   opts.maxLanes (default 6)
//   Algorithm: stable sort by (priority asc, x0 asc); for each item pick the lowest lane where
//   x0 - gap >= laneRight[lane]; if none in 0..maxLanes-1 -> dropped. Pure function, no DOM.

const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/layout.js');
const layout = globalThis.HT && globalThis.HT.layout;

const DEFAULT_GAP = 8;
const DEFAULT_MAX_LANES = 6;

function item(x0, x1, priority = 0) {
  return { x0, x1, priority };
}

function laneOf(result, index) {
  const p = result.placed.find((e) => e.index === index);
  assert.ok(p, `expected index ${index} to be placed; placed=${JSON.stringify(result.placed)} dropped=${JSON.stringify(result.dropped)}`);
  return p.lane;
}

// Structural invariants every result must satisfy, independent of the specific scenario:
//  - result shape
//  - every input index appears exactly once across placed + dropped
//  - placed is sorted ascending by index
//  - every lane is an integer in 0..maxLanes-1
//  - no two items in the same lane overlap, honouring gap (x0 - gap >= previous x1)
//  - lanes equals (highest lane index used + 1), or 0 when nothing is placed
function checkInvariants(items, result, opts = {}) {
  const gap = opts.gap === undefined ? DEFAULT_GAP : opts.gap;
  const maxLanes = opts.maxLanes === undefined ? DEFAULT_MAX_LANES : opts.maxLanes;

  assert.equal(typeof result, 'object');
  assert.notEqual(result, null);
  assert.equal(typeof result.lanes, 'number');
  assert.ok(Array.isArray(result.placed), 'placed must be an array');
  assert.ok(Array.isArray(result.dropped), 'dropped must be an array');

  const counts = new Map();
  const bump = (i) => counts.set(i, (counts.get(i) || 0) + 1);

  for (const p of result.placed) {
    assert.equal(typeof p, 'object');
    assert.ok(Number.isInteger(p.index), `placed index must be an integer, got ${p.index}`);
    assert.ok(p.index >= 0 && p.index < items.length, `placed index ${p.index} out of range`);
    assert.ok(Number.isInteger(p.lane), `lane must be an integer, got ${p.lane}`);
    assert.ok(p.lane >= 0 && p.lane < maxLanes, `lane ${p.lane} outside 0..${maxLanes - 1}`);
    bump(p.index);
  }
  for (const d of result.dropped) {
    assert.ok(Number.isInteger(d), `dropped entry must be an integer index, got ${JSON.stringify(d)}`);
    assert.ok(d >= 0 && d < items.length, `dropped index ${d} out of range`);
    bump(d);
  }
  assert.equal(result.placed.length + result.dropped.length, items.length,
    'placed + dropped must account for every item');
  for (let i = 0; i < items.length; i++) {
    assert.equal(counts.get(i), 1, `index ${i} must appear exactly once across placed + dropped`);
  }

  for (let i = 1; i < result.placed.length; i++) {
    assert.ok(result.placed[i - 1].index < result.placed[i].index,
      `placed must be sorted ascending by index: ${JSON.stringify(result.placed)}`);
  }

  const byLane = new Map();
  for (const p of result.placed) {
    if (!byLane.has(p.lane)) byLane.set(p.lane, []);
    byLane.get(p.lane).push(items[p.index]);
  }
  for (const [lane, members] of byLane) {
    members.sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < members.length; i++) {
      const prev = members[i - 1];
      const cur = members[i];
      assert.ok(cur.x0 - gap >= prev.x1,
        `lane ${lane}: [${cur.x0},${cur.x1}] overlaps or is within gap ${gap} of [${prev.x0},${prev.x1}]`);
    }
  }

  const maxLane = result.placed.reduce((m, p) => Math.max(m, p.lane), -1);
  assert.equal(result.lanes, maxLane + 1, 'lanes must equal highest used lane index + 1 (0 when empty)');
}

test('HT.layout exposes packLanes', () => {
  assert.ok(layout, 'globalThis.HT.layout must be defined after require');
  assert.equal(typeof layout.packLanes, 'function');
});

test('empty input yields zero lanes, nothing placed, nothing dropped', () => {
  const items = [];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(result.lanes, 0);
  assert.deepEqual(result.placed, []);
  assert.deepEqual(result.dropped, []);
});

test('opts is optional and an empty opts object is accepted', () => {
  const items = [item(0, 50), item(100, 150)];
  const a = layout.packLanes(items);
  const b = layout.packLanes(items, {});
  checkInvariants(items, a);
  checkInvariants(items, b, {});
  assert.deepEqual(a, b);
});

test('non-overlapping items all share lane 0', () => {
  const items = [item(0, 50), item(100, 150), item(200, 250), item(400, 401)];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(result.lanes, 1);
  assert.deepEqual(result.dropped, []);
  assert.deepEqual(result.placed, [
    { index: 0, lane: 0 },
    { index: 1, lane: 0 },
    { index: 2, lane: 0 },
    { index: 3, lane: 0 },
  ]);
});

test('an item overlapping lane 0 goes to lane 1', () => {
  const items = [item(0, 100), item(50, 150)];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(result.lanes, 2);
  assert.deepEqual(result.dropped, []);
  assert.deepEqual(result.placed, [
    { index: 0, lane: 0 },
    { index: 1, lane: 1 },
  ]);
});

test('three mutually overlapping items occupy lanes 0, 1, 2', () => {
  const items = [item(0, 100), item(10, 110), item(20, 120)];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(result.lanes, 3);
  assert.deepEqual(result.placed, [
    { index: 0, lane: 0 },
    { index: 1, lane: 1 },
    { index: 2, lane: 2 },
  ]);
});

test('a later item fits back into lane 0 once the earlier lane-0 item has ended', () => {
  // A: 0-100 lane 0, B: 50-150 lane 1, C: 200-300 fits lane 0 again (200 - 8 >= 100).
  const items = [item(0, 100), item(50, 150), item(200, 300)];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(laneOf(result, 0), 0);
  assert.equal(laneOf(result, 1), 1);
  assert.equal(laneOf(result, 2), 0);
  assert.equal(result.lanes, 2);
});

test('default gap of 8px is enforced with an exact boundary (x0 - gap >= previous x1)', () => {
  // Exactly at the boundary: 108 - 8 = 100 >= 100 -> shares lane 0.
  const exact = [item(0, 100), item(108, 200)];
  const rExact = layout.packLanes(exact);
  checkInvariants(exact, rExact);
  assert.equal(laneOf(rExact, 0), 0);
  assert.equal(laneOf(rExact, 1), 0);
  assert.equal(rExact.lanes, 1);

  // One pixel inside the gap: 107 - 8 = 99 < 100 -> bumped to lane 1.
  const inside = [item(0, 100), item(107, 200)];
  const rInside = layout.packLanes(inside);
  checkInvariants(inside, rInside);
  assert.equal(laneOf(rInside, 0), 0);
  assert.equal(laneOf(rInside, 1), 1);
  assert.equal(rInside.lanes, 2);

  // Touching (x0 == previous x1) is NOT enough with a non-zero gap.
  const touching = [item(0, 100), item(100, 200)];
  const rTouching = layout.packLanes(touching);
  checkInvariants(touching, rTouching);
  assert.equal(laneOf(rTouching, 1), 1);
});

test('gap boundary is exact for fractional pixel positions', () => {
  const fits = [item(0, 100.5), item(108.5, 200)];
  const rFits = layout.packLanes(fits);
  checkInvariants(fits, rFits);
  assert.equal(laneOf(rFits, 1), 0);

  const bumped = [item(0, 100.5), item(108.25, 200)];
  const rBumped = layout.packLanes(bumped);
  checkInvariants(bumped, rBumped);
  assert.equal(laneOf(rBumped, 1), 1);
});

test('opts.gap overrides the default gap', () => {
  // gap 0: touching items share a lane.
  const touching = [item(0, 100), item(100, 200)];
  const r0 = layout.packLanes(touching, { gap: 0 });
  checkInvariants(touching, r0, { gap: 0 });
  assert.equal(laneOf(r0, 0), 0);
  assert.equal(laneOf(r0, 1), 0);
  assert.equal(r0.lanes, 1);

  // gap 0: any actual overlap still separates.
  const overlap = [item(0, 100), item(99.999, 200)];
  const r0o = layout.packLanes(overlap, { gap: 0 });
  checkInvariants(overlap, r0o, { gap: 0 });
  assert.equal(laneOf(r0o, 1), 1);

  // gap 20: 120 - 20 = 100 >= 100 fits; 119 - 20 = 99 < 100 does not.
  const at = [item(0, 100), item(120, 200)];
  const rAt = layout.packLanes(at, { gap: 20 });
  checkInvariants(at, rAt, { gap: 20 });
  assert.equal(laneOf(rAt, 1), 0);

  const under = [item(0, 100), item(119, 200)];
  const rUnder = layout.packLanes(under, { gap: 20 });
  checkInvariants(under, rUnder, { gap: 20 });
  assert.equal(laneOf(rUnder, 1), 1);
});

test('items may start at negative x (partly off-screen) and still pack', () => {
  const items = [item(-50, 20), item(30, 90), item(-10, 5, 1)];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(laneOf(result, 0), 0);
  assert.equal(laneOf(result, 1), 0); // 30 - 8 = 22 >= 20
  assert.equal(laneOf(result, 2), 1); // overlaps index 0 in lane 0
  assert.deepEqual(result.dropped, []);
});

test('priority wins lanes: a high-priority item takes lane 0 even when a low-priority item is further left', () => {
  // Index 0 is left-most but low priority (5); index 1 overlaps it and is high priority (0).
  const items = [item(0, 100, 5), item(50, 150, 0)];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(laneOf(result, 1), 0, 'the priority-0 item must get lane 0');
  assert.equal(laneOf(result, 0), 1, 'the priority-5 item must yield to lane 1');
  assert.equal(result.lanes, 2);
  assert.deepEqual(result.dropped, []);
  // placed is reported in index order, not in packing order
  assert.deepEqual(result.placed, [
    { index: 0, lane: 1 },
    { index: 1, lane: 0 },
  ]);
});

test('priority ordering: lanes fill in ascending priority regardless of input order', () => {
  // All overlap. Input order is deliberately scrambled relative to priority.
  const items = [
    item(10, 110, 2), // index 0
    item(0, 100, 0),  // index 1
    item(20, 120, 3), // index 2
    item(5, 105, 1),  // index 3
  ];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(laneOf(result, 1), 0);
  assert.equal(laneOf(result, 3), 1);
  assert.equal(laneOf(result, 0), 2);
  assert.equal(laneOf(result, 2), 3);
  assert.equal(result.lanes, 4);
});

test('equal priority: ties are broken by x0 ascending, so reverse-x input still packs into one lane', () => {
  // If the sort ignored x0, index 0 (200-300) would be packed first and index 1 (0-100)
  // would then be forced into lane 1 by the laneRight rule. With (priority, x0) ordering both share lane 0.
  const items = [item(200, 300, 0), item(0, 100, 0)];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(laneOf(result, 0), 0);
  assert.equal(laneOf(result, 1), 0);
  assert.equal(result.lanes, 1);
});

test('out-of-x-order placement never produces overlaps within a lane', () => {
  // Priority sort places the RIGHT item (index 0) before the LEFT item (index 1), then a
  // MIDDLE item (index 2) that overlaps the right item. A naive implementation that resets
  // laneRight to the left item's x1 after placing it would let the middle item land on top
  // of the right item in the same lane.
  const items = [
    item(200, 300, 0), // right, highest priority -> packed first
    item(0, 100, 1),   // left, packed second (out of x order)
    item(150, 250, 2), // middle, overlaps right
  ];
  const result = layout.packLanes(items);
  checkInvariants(items, result); // includes the per-lane no-overlap check
  assert.equal(laneOf(result, 0), 0, 'highest-priority item takes lane 0');
  assert.deepEqual(result.dropped, [], 'with 6 lanes available nothing should be dropped');
  assert.notEqual(laneOf(result, 2), laneOf(result, 0), 'middle must not share a lane with right');
});

test('out-of-x-order placement: a longer scrambled chain stays overlap-free in every lane', () => {
  // Priorities are assigned so packing order runs right-to-left across the axis, then a
  // second wave of lower-priority items overlaps the seams between them.
  const items = [
    item(600, 700, 0), // index 0
    item(400, 500, 1), // index 1
    item(200, 300, 2), // index 2
    item(0, 100, 3),   // index 3
    item(650, 750, 4), // index 4 overlaps 0
    item(450, 550, 4), // index 5 overlaps 1
    item(250, 350, 4), // index 6 overlaps 2
    item(50, 150, 4),  // index 7 overlaps 3
    item(90, 720, 5),  // index 8 spans nearly everything
  ];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.deepEqual(result.dropped, []);
  assert.equal(laneOf(result, 0), 0, 'highest-priority item takes lane 0');
  assert.equal(result.placed.length, items.length);
  assert.ok(laneOf(result, 8) >= 2, 'the wide low-priority item must sit above both crowded lanes');
});

test('items are dropped when every lane in 0..maxLanes-1 is blocked', () => {
  const items = [item(0, 100, 0), item(0, 100, 1), item(0, 100, 2)];
  const result = layout.packLanes(items, { maxLanes: 2 });
  checkInvariants(items, result, { maxLanes: 2 });
  assert.equal(result.lanes, 2);
  assert.deepEqual(result.placed, [
    { index: 0, lane: 0 },
    { index: 1, lane: 1 },
  ]);
  assert.deepEqual(result.dropped, [2]);
});

test('the lowest-priority (highest number) item is the one dropped, regardless of input position', () => {
  const items = [item(0, 100, 3), item(0, 100, 0), item(0, 100, 1)];
  const result = layout.packLanes(items, { maxLanes: 2 });
  checkInvariants(items, result, { maxLanes: 2 });
  assert.deepEqual(result.dropped, [0]);
  assert.equal(laneOf(result, 1), 0);
  assert.equal(laneOf(result, 2), 1);
});

test('default maxLanes is 6: seven mutually overlapping items place six and drop one', () => {
  const items = [];
  for (let i = 0; i < 7; i++) items.push(item(0, 100, i));
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.equal(result.lanes, 6);
  assert.equal(result.placed.length, 6);
  assert.deepEqual(result.dropped, [6]);
  for (let i = 0; i < 6; i++) assert.equal(laneOf(result, i), i);
});

test('stable sort: identical items keep input order, so the last one is dropped', () => {
  const items = [];
  for (let i = 0; i < 7; i++) items.push(item(0, 100, 0));
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.deepEqual(result.dropped, [6]);
  for (let i = 0; i < 6; i++) assert.equal(laneOf(result, i), i);
});

test('maxLanes: 1 packs a single lane and drops everything that overlaps it', () => {
  const items = [item(0, 100, 0), item(50, 150, 0), item(200, 300, 0), item(250, 350, 1)];
  const result = layout.packLanes(items, { maxLanes: 1 });
  checkInvariants(items, result, { maxLanes: 1 });
  assert.equal(result.lanes, 1);
  assert.deepEqual(result.placed, [
    { index: 0, lane: 0 },
    { index: 2, lane: 0 },
  ]);
  assert.deepEqual([...result.dropped].sort((a, b) => a - b), [1, 3]);
});

test('a dropped item does not reserve space: later items can still use the lanes', () => {
  // Index 1 (low priority, wide) is dropped because both lanes are blocked at x=0..100;
  // index 3 sits far to the right and must still be placed in lane 0.
  const items = [item(0, 100, 0), item(0, 1000, 5), item(0, 100, 1), item(500, 600, 2)];
  const result = layout.packLanes(items, { maxLanes: 2 });
  checkInvariants(items, result, { maxLanes: 2 });
  assert.deepEqual(result.dropped, [1]);
  assert.equal(laneOf(result, 3), 0);
});

test('placed is sorted by index and every index appears exactly once across placed + dropped (dense scenario)', () => {
  // Deterministic pseudo-random set (Park-Miller LCG) so the test is reproducible.
  let seed = 20240911;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const items = [];
  for (let i = 0; i < 40; i++) {
    const x0 = Math.floor(rand() * 1000);
    const width = 100 + Math.floor(rand() * 101); // 100..200 px
    const priority = Math.floor(rand() * 8);      // 0..7 (tiers)
    items.push(item(x0, x0 + width, priority));
  }
  const opts = { maxLanes: 3 };
  const result = layout.packLanes(items, opts);
  checkInvariants(items, result, opts);

  // Capacity argument: each lane spans at most [0, 1200) and each item consumes >= 100 + 8 px,
  // so at most 11 items fit per lane, 33 across 3 lanes -> at least 7 of 40 are dropped.
  assert.ok(result.dropped.length >= 7, `expected >= 7 dropped, got ${result.dropped.length}`);
  assert.ok(result.placed.length >= 1, 'something must be placed');

  const indices = result.placed.map((p) => p.index);
  assert.deepEqual(indices, [...indices].sort((a, b) => a - b), 'placed must be index-sorted');
  const all = [...indices, ...result.dropped].sort((a, b) => a - b);
  assert.deepEqual(all, Array.from({ length: items.length }, (_, i) => i));
});

test('placed order is by index even when the pack order differs (larger example)', () => {
  const items = [
    item(900, 1000, 7),
    item(0, 100, 0),
    item(450, 550, 3),
    item(300, 400, 7),
    item(600, 700, 1),
    item(150, 250, 5),
  ];
  const result = layout.packLanes(items);
  checkInvariants(items, result);
  assert.deepEqual(result.dropped, []);
  assert.deepEqual(result.placed.map((p) => p.index), [0, 1, 2, 3, 4, 5]);
});

test('input array and its item objects are not mutated', () => {
  const items = [
    item(200, 300, 2),
    item(0, 100, 0),
    item(50, 150, 1),
    item(0, 100, 5),
    item(0, 100, 5),
  ];
  const snapshot = JSON.parse(JSON.stringify(items));
  const identities = items.slice();

  const result = layout.packLanes(items, { maxLanes: 2 });
  checkInvariants(items, result, { maxLanes: 2 });

  assert.deepEqual(items, snapshot, 'item order and contents must be unchanged');
  for (let i = 0; i < items.length; i++) {
    assert.equal(items[i], identities[i], `items[${i}] must be the same object as before`);
    assert.deepEqual(Object.keys(items[i]).sort(), ['priority', 'x0', 'x1'],
      `no properties may be added to items[${i}]`);
  }
});

test('frozen input is accepted (the function never writes to its input)', () => {
  const items = Object.freeze([
    Object.freeze(item(100, 200, 1)),
    Object.freeze(item(0, 50, 0)),
    Object.freeze(item(120, 220, 0)),
  ]);
  let result;
  assert.doesNotThrow(() => { result = layout.packLanes(items); });
  checkInvariants(items, result);
  assert.equal(laneOf(result, 1), 0);
  assert.equal(laneOf(result, 2), 0);
  assert.equal(laneOf(result, 0), 1);
});

test('calling twice with the same input yields identical results (pure function)', () => {
  const items = [item(0, 100, 1), item(50, 150, 0), item(120, 220, 2), item(300, 400, 0)];
  const a = layout.packLanes(items, { gap: 4, maxLanes: 3 });
  const b = layout.packLanes(items, { gap: 4, maxLanes: 3 });
  checkInvariants(items, a, { gap: 4, maxLanes: 3 });
  assert.deepEqual(a, b);
});
