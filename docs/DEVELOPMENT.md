# Development

How the project is laid out, built and tested, and the decisions behind it. The binding module interfaces are in [CONTRACT.md](../CONTRACT.md).

## Project layout

```
index.html              built artifact: one self-contained page (output of node build.mjs)
build.mjs               bundler: inlines src/ into the template, validates the result
PROMPT.md               product spec
CONTRACT.md             module interfaces every src file is written against
README.md               this file
src/
  index.template.html   HTML skeleton with <!--STYLES--> and <!--SCRIPTS--> placeholders
  styles.css            all CSS: theme tokens, layout, panel, tooltip, legend
  time.js               HT.time: time model, calendar math, date/range formatting
  tiers.js              HT.tiers: categories, colors, tierForSpan, tierSpan
  ticks.js              HT.ticks: tick ladder, nice positions, minor ticks, label thinning
  layout.js             HT.layout: greedy lane packing for event labels
  tours.js              HT.tours: the guided tours (steps name events by title)
  core.js               HT.core: the pure rules behind the app (view limits, URL hash, regions, slugs,
                        overview scale, tier selection, on-this-day parsing, panel neighbours)
  app/                  HT.app: rendering, zoom/pan/pinch, history and URL state, panel. Twenty-five files
                        by topic (00-state.js … 90-init.js) that the build joins inside one closure;
                        see src/app/README.md
  data/
    01-prehistory.js    95 events, 300,000 years ago – 10,000 BCE
    02-ancient.js       105 events, 10,000 BCE – 500 BCE
    03-classical.js     99 events, 500 BCE – 500 CE
    04-medieval.js      126 events, 500 – 1500
    05-early-modern.js  107 events, 1500 – 1800
    06-modern.js        139 events, 1800 – 1945
    07-postwar.js       128 events, 1945 – 1990
    08-contemporary.js  112 events, 1990 – today
test/
  time.test.js          calendar conversions, histYear, every formatter
  tiers.test.js         tierForSpan, tierSpan, palette contrast on both backgrounds
  ticks.test.js         regimes, ladder selection, nice positions, minors, thinning
  layout.test.js        lane packing, priorities, gaps, drops, purity
  data.test.js          every rule listed under "Adding an event"
  contrast.test.js      theme colour tokens against WCAG AA, including through the sensor filters
  tours.test.js         every tour step names a real event; tours run forward in time
  core.test.js          view clamping and the Today margin, hash round trips, slugs, regions, the overview
                        scale, tier selection, on-this-day parsing, the panel's neighbour lists
scripts/
  import-*.mjs          build-time importers (network at import time only)
  import-works.mjs      landmark creative works (Wikipedia's vital Arts list + Wikidata); not part of the refresh
  import-lives.mjs      notable people's lifespans (Wikipedia's vital-articles list + Wikidata); not part of the refresh
  refresh.mjs           runs the importers whose sources move, rolls back any that fail or shrink
e2e/
  smoke.mjs             end-to-end smoke test in headless Chrome (no dependencies)
.github/workflows/
  test.yml              tests, and a check that the committed index.html is what the sources build
  refresh-data.yml      monthly data refresh, proposed as a pull request
```

Tests use `node:test` and `node:assert` and load the browser scripts with `require`, reading `globalThis.HT`. They cover the pure modules. `src/app/` keeps the DOM, storage, network and animation; every rule in it that can be stated without those lives in `core.js`, takes "now" as an argument, and is tested there. The same tests run on every push and pull request, along with a check that `index.html` matches a fresh build.

`node e2e/smoke.mjs` is an end-to-end smoke test with no dependencies beyond a local Chrome or Chromium (`CHROME_BIN` overrides the search): it injects a small harness into a copy of the built page, runs it in headless Chrome under virtual time, and reads the results back out of the dumped DOM. In about a second it opens the guide, zooms in and out, opens an event from the keyboard, filters by region, searches, walks a tour with the arrow keys, jumps on the overview strip, switches mode and opens Today in history against a canned feed (`fetch` is stubbed, so the network is never touched), and it fails on any console error or uncaught exception. CI runs it after the unit tests. On its first run it found a real bug: on a crowded view the open event could lose its lane and not be drawn, so the open event now always takes the first lane and ignores the tier ceiling.

## Decisions

Choices the spec left open, as implemented:

**Source layout and build**
- The page is authored as separate files under `src/` and bundled by `node build.mjs`. The deliverable is still one self-contained `index.html` with no runtime build step; the build exists only so the modules can be unit-tested with `node --test`.
- Every source file is a plain script wrapped in an IIFE that attaches to a shared `HT` namespace (`window.HT` in the browser, `globalThis.HT` in Node). No ES modules.
- Events are not a single `const EVENTS` literal; each era file pushes onto `HT.events`. In the built `index.html` the data files appear as consecutive blocks marked `/* ======== src/data/NN-era.js ======== */`, which is the block to extend by hand if you edit the built file directly.
- The build refuses to write output on any of: missing source, syntax error in the bundle, `import`/`export`/`require(` outside comments and strings, `</script` or `<!--` inside the bundle, `</style` inside the CSS, or a `src=`/`href=` pointing at an external URL.

**Time model**
- The root starts 300,000 years before 1950, not before today, so `ROOT_START = -298050`. "Years ago" everywhere means years before 1950, matching the BP convention used for radiocarbon dates.
- `formatAgo` returns `today` for anything at or after 1950 (and `1 year ago`, singular, for 1949); the root breadcrumb range therefore reads `300,000 years ago – today`.
- "Today" (the root end and the clamp on every view) is sampled once at page load, not on every render.
- The calendar is proleptic Gregorian in UTC, computed from day counts; the JS `Date` object is only read (`now()`, `fromDate`), never used for arithmetic. Astronomical year numbering keeps leap years regular (year 0 = 1 BCE is a leap year).
- No Julian-to-Gregorian conversion is applied to data: day-precision dates before 1582 (Hastings, the Ides of March, …) are the conventionally quoted calendar dates passed to `ymd` unchanged, so tooltips show the familiar date.
- Historical-year labels use `CE` only for years 1–999 (`79 CE`, but `1492`), thousands separators only from 10,000 (`10,000 BCE`, `3000 BCE`). In a range where either end is BCE, CE years get an explicit ` CE` (`10,000 BCE – 1 CE`).
- `formatRange` promotes precision when both ends sit exactly on a boundary: a view from Jul 1 to Aug 1 reads `Jul 1969 – Aug 1969`, not two full dates; a Jan 1 – Jan 1 view reads as years.
- `formatDateFull` (tooltips, panel, cursor readout) prefixes `c.` for anything earlier than 20,000 BCE, since those dates are round-figure estimates. Historical events whose date is approximate say so in the title or detail (`(c. 300 BCE)`).
- Event dates in the tooltip and panel: ranged events use `formatRange` (so `3100 BCE – 2900 BCE` rather than two "Jan 1" dates); point events before 1900 dated exactly Jan 1 show only the year, everything else shows the full date.
- The cursor readout in the header uses the full date when the view span is ≤ 20,000 years and "years ago" above that.

**Ticks**
- Target major spacing is 110 px: the smallest ladder interval whose average spacing is ≥ 110 px is used (the largest interval if none qualifies; thinning then keeps labels apart). Ladder: years `1, 2, 5 × 10^n` up to 5,000,000; months `1, 2, 3, 6`; days `1, 2, 7, 14`.
- The tick unit follows the label regime (years for "ago"/"year", months for "month", days for "day") so no two ticks ever share a label.
- Nice positions are in the space the reader sees. In the "ago" regime ticks sit at whole multiples of the step in years ago (`1950 - k·step`, so `300,000 / 250,000 / … years ago`). In the "year" regime with step ≥ 2 they sit at historical years that are multiples of the step, plus an epoch tick at 1 CE standing in for the nonexistent year 0 (`3000 BCE, 2000 BCE, 1000 BCE, 1 CE, 1000, 2000`). With step 1, every integer `t`. Months use the 1st of aligned months; days use days 1, 1+step, 1+2·step … restarting each month.
- In the "ago" regime the position at 1950 itself is never a labeled major (it would read `today` while the axis runs on to now); it is drawn as a minor.
- If the chosen interval is wider than the view and no major lands inside it (e.g. a 7-day step over a 6-day view), the next finer interval is used so the axis is never empty.
- Minor ticks are evenly spaced in `t` between consecutive majors and extended to both view edges: 5 subdivisions when the step's leading digit is 1 or 5, 4 when it is 2; months and days always 4. Minor ticks are never labeled.
- Overlapping labels are thinned, never shrunk: walk left to right, keep the first, suppress any label whose left edge would come within 12 px of the previous kept label's right edge. Widths are measured with a hidden SVG `<text>` (`getComputedTextLength`) and cached per string; the cache is cleared on resize. Labels near the edges are nudged inward and re-checked against the previous drawn label.

**Events and lanes**
- The axis sits at 62 % of the stage height; label lanes stack upward from it at a 26 px pitch, with 24 px kept clear at the top. The lane count is whatever fits, capped at 8 (the layout module's own default is 6; the app passes its cap explicitly).
- Packing is greedy by `(tier ascending, x ascending)` with an 8 px gap; each item takes the lowest lane where it overlaps nothing already placed, and when no lane is free the item (necessarily the highest tier among the contenders) is dropped from the view. The packer is a pure function with no DOM.
- Labels go to the right of the marker (or of the bar's visible left end) and flip to the left when they would overflow and the left side has room, or more room. Titles are truncated with an ellipsis to fit `max(60, min(320, 60 % of stage width))` px and the room actually available, so a label never leaves the stage.
- Point events are a 5 px-radius circle on the axis; ranged events a 6 px-tall bar from `t` to `end`; both connect to their label with a faint stem in the category color.
- "Zoom to this event": a ranged event is fitted with 15 % of its length padded on each side; a point event gets a span of `max(1 day, tierSpan(tier) / 10)` centered on it, where `tierSpan` is the lower bound of the tier's range (tier 0 → 10,000 years, tier 7 → 1 year).
- Taps are resolved on `pointerup` and a tap on an event opens the panel without zooming; native `click` is only used to stop propagation. A drag suppresses the click that follows it for 400 ms.

**Zoom, history and URL**
- Zoom-in computes the new span from the committed view, not the in-flight animation frame, so rapid clicks compound to 16×, 64×, …
- Zoom out reverses the last discrete zoom (click, `+`, Zoom to this event, or a breadcrumb) only while the current view is still exactly that entry; after any wheel, pinch or drag it zooms out 4× around the center and replaces the current crumb instead of popping one.
- Breadcrumbs are a stack from root to current in which every entry contains the next. A discrete zoom pushes a crumb; continuous zoom (wheel, pinch, drag) replaces the top crumb; any ancestor that no longer contains the view is popped. The root crumb reads `All of humanity`; the others are `formatRange(start, end)`.
- URL hash: `#s=<start>&e=<end>`, numbers rounded to 9 decimals with trailing zeros trimmed. Discrete zooms call `history.pushState`; continuous zoom calls `replaceState`, debounced 200 ms (Safari rate-limits history writes). The breadcrumb stack is stored in `history.state`, so back/forward and reload restore the crumbs; when it is missing the chain is derived as root → current. An invalid or absent hash means the root view; parsed views are clamped.
- Transitions animate over 250 ms with a cubic ease-out, interpolating `log(span)` and the center so that zooming looks uniform at every scale. A 350 ms safety timer lands the view if animation frames are starved. Animation is skipped under `prefers-reduced-motion`.
- Mouse wheel zooms by `exp(deltaY × 0.002)` per event, clamped to [0.5, 2]; a trackpad pinch (a wheel event with `ctrlKey`) uses `0.01` because it reports much smaller deltas. Shift+wheel and horizontal wheel deltas pan. Line- and page-mode deltas are scaled to pixels.
- Touch uses Pointer Events with `touch-action: none`; a press becomes a drag after 4 px of movement; a two-finger pinch keeps the date under each finger fixed by solving the linear pixel mapping; three or more fingers are ignored; when one finger of a pinch lifts, the other continues as a pan. Safari's `gesturestart`/`gesturechange` are suppressed. Touch pointers never show the tooltip or the cursor guide.
- Keyboard: `Escape`, `-`/`_` (zoom out), `0` (home), `+`/`=` (zoom in at center), `1`–`6` (visual mode), `T` (cycle modes), `E` (Earth layer), `R` (reign swimlanes), `/` (search). Ignored while Ctrl, Alt or Meta is held or while focus is in a form field. There is no Home-key binding; Home is the button.
- The stage is resized on `window.resize` and on a `ResizeObserver` for the stage (so opening the panel reflows without a window event), debounced 100 ms.

**Appearance**
- Dark theme by default with a light theme under `prefers-color-scheme: light`, via custom properties on `:root`; `color-scheme` and `theme-color` metas follow suit. Category markers keep their colors under `forced-colors`.
- The 15 category colors are hues spaced about 24° apart in OKLCH with alternating lightness, each with a WCAG contrast ratio ≥ 3:1 against both surfaces (`#0f1115` dark, `#f7f7f5` light); `test/tiers.test.js` checks this.
- The side panel is a 320 px right column that pushes the stage (no overlay) at ≥ 641 px, and a bottom sheet capped at 45 vh at ≤ 640 px. It takes focus when opened.
- Tooltips are positioned near the pointer and flipped or clamped to stay inside the stage.
- System font stack for UI, a serif display face for the title and panel heading, tabular figures on date readouts, 40 px minimum touch targets.

**Data**
- 834 events (spec minimum 300), every one with a verified English Wikipedia link, across eight era files, sparse in prehistory and dense after 1500; every event since September 1945 has a day-precision date.
- Prehistory dates are round figures via `ya(n)`. Ranged events (wars, reigns, movements) use `end`; a range that begins in one era but ends in a later one stays in the file where it starts.
- The `id` of an event is its index in `HT.events`, assigned by the app, never authored.

### Interaction robustness (added after browser testing)

- `zoomIn` / `zoomOut` derive the new span from the committed view, not from the frame currently on screen, so rapid clicks during the 250 ms animation each zoom a further ×4 instead of being collapsed into one.
- A press no longer cancels a running zoom animation; only the start of a drag or pinch does, and the pan then continues from the frame that was showing. Clicking an event mid-animation therefore never freezes the view at an intermediate frame.
- The animation has a `setTimeout` safety net (`ANIM_MS + 100`) that lands on the target view even when `requestAnimationFrame` is starved (background tab, busy main thread).
- The breadcrumb bar scrolls to its end on every render so the current crumb stays visible; below 641 px the header is a wrapping flex row so the date readout is sized by its own text rather than sharing a column with the buttons.
- Event labels are truncated to the room actually available on whichever side of the marker they are placed, so a label never extends past the stage edge.

### Review-driven fixes

- A zoom-in centred near a view's edge is shifted inward so the child view stays inside its parent; the breadcrumb chain is always a nesting chain and Zoom Out always reverses the last step.
- The root's end is written to the URL and history state as the token `now` (`#s=-298050&e=now`), and a parsed view whose edges fall on the root bounds (end within an hour of now) snaps to the root, so a shared or reloaded root link is recognised as the root.
- Clicking the axis at maximum zoom (one day) is a no-op instead of a pan that pushes history entries.
- Sparse windows admit lower tiers until at least 8 events are in view (the tier table gives the floor; lane packing still trims overflow), so a first click into deep prehistory never lands on an empty axis.
- Events are keyboard-accessible: every marker is a focusable `role="button"` with an accessible name; Enter or Space opens the panel and Escape returns focus to the marker. Invisible hit areas pad each marker and label so taps do not have to land on a 10 px dot.
- The header's date readout is refreshed after any zoom so it always describes the date under a resting pointer; the SVG viewBox is updated immediately on resize (the 100 ms debounce only covers tick and lane recomputation).
- The panel's category caption uses the muted text colour with a coloured dot instead of the category hue as text, for contrast.
- Minimum span is 1/365 of a year so a day-level view always contains a midnight tick; `computeTicks` additionally falls back to quarter-day positions for sub-day windows.
- Event dates authored as round "years ago" figures before 10,000 BCE are shown as `c. N years ago` in the tooltip and panel rather than a spuriously precise BCE year.

### Observatory UI (visual modes)

- The chrome speaks one voice: monospace, uppercase, wide-tracked micro-type for every instrument label (breadcrumbs, readouts, buttons, tick labels), while event labels stay in a sans face for lane density and the panel body reads in a serif.
- Six modes are CSS token sets on `html[data-theme]`; NVG, Ironbow and Noir additionally run the SVG stage through `feComponentTransfer` gradient-map filters defined inline, so the category colours are re-mapped by luminance the way a sensor would render them.
- Atmosphere layers (grain, scanlines, vignette) are always in the DOM and per-mode tokens set their opacity; CRT animates a slow refresh band. All are `pointer-events: none` and switched off under `forced-colors`.
- When a zoom settles (animation end, or any discrete view change), events animate into their lanes with a 22 ms stagger; continuous wheel, drag and pinch renders never animate. Tier 0 and 1 point markers carry a slow pulse ring.
- The mode is stored under `ht-theme` in `localStorage` and serialised as `m=` in the hash only when explicitly chosen; `auto` is never written so the system preference keeps working for people who never picked one.
