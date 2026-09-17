/* HT.tiers — tiers and categories (CONTRACT.md §3) */
(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});

  const CATEGORIES = ['origins', 'migration', 'technology', 'agriculture', 'civilization', 'empire', 'religion',
    'science', 'art', 'war', 'exploration', 'politics', 'medicine', 'computing', 'space', 'earth'];

  // 15 hues (plus 'earth', added later) spaced ~24° apart in OKLCH with alternating lightness. Every color has a WCAG
  // contrast ratio ≥ 3:1 against both #0f1115 (dark) and #f7f7f5 (light); the closest pair
  // is OKLab ΔE 0.082 (computing/migration).
  const COLORS = {
    origins:      '#a98304', // ochre
    migration:    '#019d9a', // teal
    technology:   '#a86003', // burnt orange
    agriculture:  '#4a9f47', // green
    civilization: '#6e7e01', // olive
    empire:       '#b53874', // crimson
    religion:     '#8c54c3', // violet
    science:      '#0993d2', // azure
    art:          '#c360bc', // magenta
    war:          '#d6464d', // red
    exploration:  '#dd6f23', // orange
    politics:     '#7d80df', // periwinkle
    medicine:     '#078968', // emerald
    computing:    '#058298', // deep cyan
    space:        '#3072d0', // blue
    earth:        '#b0563a'  // terracotta (natural hazards and climate)
  };

  const MAX_TIER = 7;

  // Lower bound of each tier's span range in years (tier 7's range is "< 10"; 10 is used).
  const TIER_SPANS = [100000, 20000, 5000, 1000, 200, 50, 10, 10];

  function tierForSpan(span) {
    if (span >= 100000) return 0;
    if (span >= 20000) return 1;
    if (span >= 5000) return 2;
    if (span >= 1000) return 3;
    if (span >= 200) return 4;
    if (span >= 50) return 5;
    if (span >= 10) return 6;
    return 7;
  }

  function tierSpan(tier) {
    tier = Math.floor(Number(tier));
    if (!(tier >= 0)) tier = 0;
    if (tier > MAX_TIER) tier = MAX_TIER;
    return TIER_SPANS[tier];
  }

  function isVisible(event, span) {
    return event.tier <= tierForSpan(span);
  }

  HT.tiers = {
    CATEGORIES: CATEGORIES,
    COLORS: COLORS,
    MAX_TIER: MAX_TIER,
    TIER_SPANS: TIER_SPANS,
    tierForSpan: tierForSpan,
    tierSpan: tierSpan,
    isVisible: isVisible
  };
})(typeof window !== 'undefined' ? window : globalThis);
