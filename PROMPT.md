# One-shot prompt: Humanity Timeline

You are a senior front-end engineer. Build a complete, working, zoomable timeline of human history in a single pass. Do not ask clarifying questions. Where the spec is silent, make a sensible decision, implement it, and record it in the "Decisions" section of the README.

## Goal

A web page that displays a horizontal timeline from the emergence of anatomically modern humans (about 300,000 years ago) to today. Tick marks are spaced to fit the width of the screen. The user clicks anywhere on the timeline to zoom in around that point. Each zoom level reveals finer ticks and more detailed events for that period. Zooming continues down to single days.

## Technical constraints

- One file: `index.html`. Inline CSS and JavaScript. No frameworks, no build step, no package manager, no external network requests. It must work when opened directly from disk via `file://`.
- Vanilla JavaScript (ES2020+) and SVG for rendering. No canvas, no libraries.
- Must work in current Chrome, Safari, and Firefox on desktop and on a phone-width screen (375px).
- Event data lives in a `const EVENTS = [...]` array inside the file. Keep it in one clearly marked block so it can be extended by hand later.

## Time model

- Represent every instant as a single floating-point number `t` in astronomical years: `1 CE = 1`, `1 BCE = 0`, `2 BCE = -1`, and fractional years for month and day precision. Today is `new Date()` converted to a fractional year.
- Root view: `t` from `-300000` to today.
- A view is defined by `[start, end]`. Never allow `end` to exceed today or `start` to go below the root start.
- Minimum view span: 1 day. Maximum: the root span.

## Ticks

- Choose a tick interval from a "nice" ladder so that major ticks land roughly every 100 to 160 pixels at the current width: `1, 2, 5 × 10^n` years for spans of 10 years or more; then years, quarters, months, weeks, days for finer spans.
- Recompute ticks on every zoom, pan, and window resize (listen for `resize`, debounce by 100ms).
- Show minor ticks between major ticks (4 or 5 subdivisions) without labels.
- Labels must never overlap. If they would, drop every other label rather than shrinking the font.

## Date labels

Format depends on the span being viewed:

| View span | Label style | Example |
|---|---|---|
| > 20,000 years | thousands of years ago | `250,000 years ago`, `50 kya` acceptable for ticks |
| 20,000 years to 100 years | BCE / CE year | `3000 BCE`, `1492` |
| 100 years to 2 years | year, or month + year at the fine end | `1969`, `Jul 1969` |
| < 2 years | month and day, with year | `Jul 20, 1969` |

Provide one `formatDate(t, span)` function that all labels use.

## Zoom and navigation

- **Click on empty timeline**: zoom in by a factor of 4, centered on the clicked `t`. Animate the transition over about 250ms.
- **Zoom out**: a visible button, plus `Shift+click` on the timeline, plus browser back (see URL state below). Zooming out reverses the last zoom-in step; from arbitrary states it zooms out by 4 around the view center.
- **Home button**: returns to the root view.
- **Mouse wheel / trackpad pinch**: zoom around the cursor. Touch pinch on mobile does the same. Horizontal drag pans when not at the root view.
- **Breadcrumb bar**: shows the chain of views from root to current as clickable labels, for example `All of humanity › 10,000 BCE – 1 CE › 500 BCE – 400 BCE`.
- **URL state**: encode `start` and `end` in the URL hash on every change and restore from the hash on load, so a view is shareable and back/forward work.

## Events

Each event in `EVENTS` has:

```js
{ t: -10000,          // start, astronomical fractional year
  end: -8000,         // optional; omit for point events
  title: "Agriculture begins in the Fertile Crescent",
  detail: "One or two sentences of context.",
  tier: 1 }           // 0 = always visible, higher = only at closer zoom
```

Visibility rule: an event is shown when `tier <= tierForSpan(span)`, where `tierForSpan` maps the current view span to a tier so that roughly 8 to 25 events are visible at any level on a desktop-width screen. Tune the mapping against the data you write; do not leave it as a placeholder.

Rendering:
- Point events are a marker on the axis with a label. Ranged events are a bar spanning `t` to `end` with the label inside or beside the bar.
- Lay out labels in stacked lanes above the axis so nothing overlaps. Use a greedy interval-packing algorithm. If lanes run out, hide the lowest-priority (highest tier) events.
- Hover shows a tooltip with the formatted date and `detail`. Click on an event opens a side panel with the same information plus a "Zoom to this event" button that fits the view to the event's span (with padding) or, for point events, to a span appropriate to its era.
- Clicking an event does not trigger the axis zoom.

## Seed data

Write at least 300 events covering the whole span. The distribution should mirror how much we know: sparse in deep prehistory, dense in the last 500 years, and with day-level entries in the last 100 years. Include tiers so that every zoom level from the root to a single decade shows something. Include the categories below and tag each event with one:

`origins, migration, technology, agriculture, civilization, empire, religion, science, art, war, exploration, politics, medicine, computing, space`

Color-code event markers by category and show a legend. Dates should be accurate to the commonly cited value; use round figures for prehistory.

## UI

- Full-viewport layout: header bar (title, breadcrumbs, Home and Zoom Out buttons, legend toggle), timeline filling the middle, side panel sliding in from the right for event detail, which collapses to a bottom sheet on narrow screens.
- Clean, high-contrast, readable at a glance. Dark theme by default with a light theme that follows `prefers-color-scheme`.
- The cursor position shows a faint vertical guide line and the date under the cursor in the corner of the header.
- No layout shift when the side panel opens; the timeline reflows.

## Acceptance criteria

All of these must be true before you stop:

1. Opening `index.html` from disk shows the root view with labeled ticks and the tier-0 events, with no console errors.
2. Resizing the window from 1400px to 375px wide changes the number of ticks and never produces overlapping labels.
3. Clicking a point on the axis zooms in by 4 around that point; repeating this from the root reaches single-day resolution in a finite number of clicks, and labels switch formats along the way as specified.
4. Zoom Out, Shift+click, Home, breadcrumbs, wheel, and browser back all work as described.
5. Reloading a page with a hash restores the same view.
6. Hovering an event shows the tooltip; clicking an event opens the panel; "Zoom to this event" fits the view.
7. Every zoom level between root and a single decade shows at least 5 events on a 1200px screen.
8. Touch pinch and drag work on a phone-width viewport (verify in the browser's device emulation).

## Deliverables

- `index.html`
- `README.md` with: how to open it, how to add an event, the tier-to-span mapping table, and a "Decisions" section listing every choice you made that the spec did not specify.

## Process

Work in this order: time model and date formatting, tick generation, static axis rendering, zoom interactions and URL state, event data model and layout, seed data, styling, then a final pass against the acceptance criteria. Test each acceptance criterion yourself in a browser before finishing. Report which criteria you verified and how.
