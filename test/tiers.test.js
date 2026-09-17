'use strict';
// Contract tests for HT.tiers (CONTRACT.md sections 1 and 3).
// Written from the contract only; they are the independent check on src/tiers.js.
// Only tiers.js is required: the contract forbids definition-time calls into other modules,
// so it must load standalone.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('../src/tiers.js');
const TIERS = globalThis.HT && globalThis.HT.tiers;

const CATEGORIES = [
  'origins', 'migration', 'technology', 'agriculture', 'civilization', 'empire', 'religion',
  'science', 'art', 'war', 'exploration', 'politics', 'medicine', 'computing', 'space', 'earth',
];

// [span, expected tier] at and just below every boundary in the contract table.
const EPS = 1e-6;
const BOUNDARIES = [
  [300000, 0], [100000, 0],
  [100000 - EPS, 1], [20000, 1],
  [20000 - EPS, 2], [5000, 2],
  [5000 - EPS, 3], [1000, 3],
  [1000 - EPS, 4], [200, 4],
  [200 - EPS, 5], [50, 5],
  [50 - EPS, 6], [10, 6],
  [10 - EPS, 7], [1, 7], [1 / 365.25, 7], [0, 7],
];

describe('module shape (section 1)', () => {
  test('require installs HT.tiers on globalThis without needing other modules', () => {
    assert.equal(typeof globalThis.HT, 'object');
    assert.equal(typeof TIERS, 'object');
  });

  test('exports every contract member', () => {
    assert.ok(Array.isArray(TIERS.CATEGORIES), 'CATEGORIES is an array');
    assert.equal(typeof TIERS.COLORS, 'object');
    assert.equal(typeof TIERS.MAX_TIER, 'number');
    assert.equal(typeof TIERS.tierForSpan, 'function');
    assert.equal(typeof TIERS.isVisible, 'function');
  });
});

describe('CATEGORIES', () => {
  test('exactly the 16 contract categories in contract order', () => {
    assert.deepEqual(TIERS.CATEGORIES, CATEGORIES);
  });

  test('no duplicates', () => {
    assert.equal(new Set(TIERS.CATEGORIES).size, 16);
  });
});

describe('COLORS', () => {
  test('has exactly the 16 category keys and no others', () => {
    const keys = Object.keys(TIERS.COLORS);
    assert.equal(keys.length, 16);
    assert.deepEqual([...keys].sort(), [...CATEGORIES].sort());
    for (const c of CATEGORIES) {
      assert.ok(Object.prototype.hasOwnProperty.call(TIERS.COLORS, c), `COLORS.${c} present`);
    }
  });

  test('every value is a #rrggbb hex string', () => {
    for (const c of CATEGORIES) {
      const v = TIERS.COLORS[c];
      assert.equal(typeof v, 'string', `COLORS.${c} is a string`);
      assert.match(v, /^#[0-9a-fA-F]{6}$/, `COLORS.${c} = ${JSON.stringify(v)} is #rrggbb`);
    }
  });

  test('16 distinct hues', () => {
    const values = CATEGORIES.map((c) => String(TIERS.COLORS[c]).toLowerCase());
    assert.equal(new Set(values).size, 16, 'no two categories share a color');
  });
});

describe('MAX_TIER', () => {
  test('is 7', () => {
    assert.equal(TIERS.MAX_TIER, 7);
  });
});

describe('tierForSpan', () => {
  test('every boundary in the contract table (lower bounds inclusive)', () => {
    for (const [span, tier] of BOUNDARIES) {
      assert.equal(TIERS.tierForSpan(span), tier, `tierForSpan(${span})`);
    }
  });

  test('span >= 100000 -> 0', () => {
    assert.equal(TIERS.tierForSpan(100000), 0);
    assert.equal(TIERS.tierForSpan(300000), 0);
    assert.equal(TIERS.tierForSpan(298050 + 2026), 0);
  });

  test('span >= 20000 -> 1', () => {
    assert.equal(TIERS.tierForSpan(20000), 1);
    assert.equal(TIERS.tierForSpan(50000), 1);
    assert.equal(TIERS.tierForSpan(99999), 1);
  });

  test('span >= 5000 -> 2', () => {
    assert.equal(TIERS.tierForSpan(5000), 2);
    assert.equal(TIERS.tierForSpan(10000), 2);
    assert.equal(TIERS.tierForSpan(19999), 2);
  });

  test('span >= 1000 -> 3', () => {
    assert.equal(TIERS.tierForSpan(1000), 3);
    assert.equal(TIERS.tierForSpan(2500), 3);
    assert.equal(TIERS.tierForSpan(4999), 3);
  });

  test('span >= 200 -> 4', () => {
    assert.equal(TIERS.tierForSpan(200), 4);
    assert.equal(TIERS.tierForSpan(500), 4);
    assert.equal(TIERS.tierForSpan(999), 4);
  });

  test('span >= 50 -> 5', () => {
    assert.equal(TIERS.tierForSpan(50), 5);
    assert.equal(TIERS.tierForSpan(100), 5);
    assert.equal(TIERS.tierForSpan(199), 5);
  });

  test('span >= 10 -> 6', () => {
    assert.equal(TIERS.tierForSpan(10), 6);
    assert.equal(TIERS.tierForSpan(25), 6);
    assert.equal(TIERS.tierForSpan(49), 6);
  });

  test('span < 10 -> 7', () => {
    assert.equal(TIERS.tierForSpan(9.999), 7);
    assert.equal(TIERS.tierForSpan(5), 7);
    assert.equal(TIERS.tierForSpan(2), 7);
    assert.equal(TIERS.tierForSpan(0.25), 7);
    assert.equal(TIERS.tierForSpan(1 / 365.25), 7);
    assert.equal(TIERS.tierForSpan(0), 7);
  });

  test('always an integer in 0..MAX_TIER', () => {
    for (let span = 0; span <= 320000; span += 1237) {
      const tier = TIERS.tierForSpan(span);
      assert.ok(Number.isInteger(tier), `tierForSpan(${span}) = ${tier} is an integer`);
      assert.ok(tier >= 0 && tier <= TIERS.MAX_TIER, `tierForSpan(${span}) = ${tier} within 0..7`);
    }
  });

  test('never increases as span grows', () => {
    let prev = Infinity;
    for (let span = 0; span <= 320000; span += 37) {
      const tier = TIERS.tierForSpan(span);
      assert.ok(tier <= prev, `tierForSpan(${span}) = ${tier} should be <= previous ${prev}`);
      prev = tier;
    }
  });

  test('successive 4x zoom-ins from the root pass through every tier', () => {
    const seen = new Set();
    for (let span = 300000; span >= 1 / 365.25; span /= 4) seen.add(TIERS.tierForSpan(span));
    assert.deepEqual([...seen].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('isVisible(event, span)', () => {
  test('event.tier <= tierForSpan(span)', () => {
    for (const [span, tier] of BOUNDARIES) {
      for (let k = 0; k <= 7; k++) {
        assert.equal(
          TIERS.isVisible({ tier: k }, span),
          k <= tier,
          `isVisible({tier:${k}}, ${span}) with tierForSpan = ${tier}`
        );
      }
    }
  });

  test('concrete cases at the root and at fine zooms', () => {
    assert.equal(TIERS.isVisible({ tier: 0 }, 300000), true);
    assert.equal(TIERS.isVisible({ tier: 1 }, 300000), false);
    assert.equal(TIERS.isVisible({ tier: 0 }, 20000), true);
    assert.equal(TIERS.isVisible({ tier: 1 }, 20000), true);
    assert.equal(TIERS.isVisible({ tier: 2 }, 20000), false);
    assert.equal(TIERS.isVisible({ tier: 6 }, 10), true);
    assert.equal(TIERS.isVisible({ tier: 7 }, 10), false);
    assert.equal(TIERS.isVisible({ tier: 7 }, 9), true);
    assert.equal(TIERS.isVisible({ tier: 7 }, 1 / 365.25), true);
  });

  test('returns a boolean and ignores other event fields', () => {
    const ev = { t: 1969.5, end: 1969.6, title: 'x', detail: 'y', tier: 3, category: 'space' };
    assert.equal(TIERS.isVisible(ev, 1000), true);
    assert.equal(TIERS.isVisible(ev, 5000), false);
    assert.equal(typeof TIERS.isVisible(ev, 1000), 'boolean');
  });
});

describe('COLORS are distinguishable on both backgrounds (contract section 3)', () => {
  // The contract names the two page backgrounds explicitly; WCAG 2 contrast >= 3:1 is the
  // standard minimum for non-text graphical objects, so every marker must clear it on both.
  const DARK_BG = '#0f1115';
  const LIGHT_BG = '#f7f7f5';

  function luminance(hex) {
    const [r, g, b] = hex.slice(1).match(/../g).map((h) => parseInt(h, 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  test('every category color has contrast >= 3:1 against the dark background', () => {
    for (const c of CATEGORIES) {
      const v = TIERS.COLORS[c];
      const cr = contrast(v, DARK_BG);
      assert.ok(cr >= 3, `COLORS.${c} = ${v} has contrast ${cr.toFixed(2)} on ${DARK_BG}`);
    }
  });

  test('every category color has contrast >= 3:1 against the light background', () => {
    for (const c of CATEGORIES) {
      const v = TIERS.COLORS[c];
      const cr = contrast(v, LIGHT_BG);
      assert.ok(cr >= 3, `COLORS.${c} = ${v} has contrast ${cr.toFixed(2)} on ${LIGHT_BG}`);
    }
  });
});

describe('tierSpan(tier) (contract section 7: lower bound of the tier\'s span range)', () => {
  test('is exported by HT.tiers', () => {
    assert.equal(typeof TIERS.tierSpan, 'function');
  });

  test('tierSpan(k) is the smallest span that still maps to tier k, for k in 0..6', () => {
    for (let k = 0; k <= 6; k++) {
      const s = TIERS.tierSpan(k);
      assert.equal(TIERS.tierForSpan(s), k, `tierForSpan(tierSpan(${k}) = ${s})`);
      assert.equal(TIERS.tierForSpan(s - EPS), k + 1, `just below tierSpan(${k}) = ${s} is tier ${k + 1}`);
    }
  });

  test('tier 7 -> 10 years (its range has no lower bound; the contract fixes it at 10)', () => {
    assert.equal(TIERS.tierSpan(7), 10);
    assert.equal(TIERS.tierSpan(TIERS.MAX_TIER), 10);
  });

  test('exact values match the tierForSpan table', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((k) => TIERS.tierSpan(k)), [100000, 20000, 5000, 1000, 200, 50, 10, 10]);
  });

  test('"Zoom to this event" point-event span max(1 day, tierSpan/10) is always at least one day', () => {
    const ONE_DAY = 1 / 365.25;
    for (let k = 0; k <= 7; k++) {
      const span = Math.max(ONE_DAY, TIERS.tierSpan(k) / 10);
      assert.ok(span >= ONE_DAY, `tier ${k}`);
      // Zooming to a tier-k event must still show tier-k events: the resulting span maps to a
      // tier >= k, so isVisible({tier: k}, span) holds.
      assert.equal(TIERS.isVisible({ tier: k }, span), true, `tier ${k} event visible after zoom-to-event`);
    }
  });
});
