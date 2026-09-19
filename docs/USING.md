# Using the timeline

Everything the page can do, feature by feature. For where the data comes from see [DATA.md](DATA.md); for how the code is organised see [DEVELOPMENT.md](DEVELOPMENT.md).

## Controls

| Action | Result |
|---|---|
| Click empty axis | Zoom in 4× centered on the clicked date (animated, 250 ms): the quarter of the screen around the click fills the stage |
| **Scale** toggle, `L` key | On views wider than 60,000 years, switch between the logarithmic axis (the default) and a linear one |
| Shift+click, **Zoom out** button, `-` key | Zoom out: undoes the last click/button zoom, otherwise 4× around the view center |
| **Home** button, `0` key | Back to the root view (300,000 years ago – today) |
| `+` / `=` key | Zoom in 4× at the view center |
| `←` / `→` keys | Pan a fifth of the view (Shift: four fifths); inside a guided tour they step through it |
| Mouse wheel / trackpad pinch | Zoom around the cursor; Shift+wheel or horizontal scroll pans |
| Touch pinch | Zoom, keeping the date under each finger fixed |
| Drag | Pan (nothing to pan at the root view) |
| **Recorded history** bracket | On views wider than 20,000 years, everything since the first writing (c. 3300 BCE) is a sliver at the right edge; a labelled bracket marks it, and clicking it (or Enter while it has focus) zooms to 3500 BCE – today |
| **Today** line | A view can run 3.5% past the present, so today is a marked line with a little empty room after it rather than the clipped right edge; nothing is ticked or plotted beyond it |
| Breadcrumbs | The chain of views from `All of humanity` to the current one; click any crumb to return to it |
| Browser back / forward | Steps through zoom history; the URL hash (`#s=<start>&e=<end>`, plus `&ev=<event>` while a panel is open) is shareable and reloads to the same view |
| Overview strip under the header | All 300,000 years on a logarithmic scale with the current view marked; click to jump there, drag the marker to scrub |
| Hover | A vertical guide line and the date under the cursor in the header; hovering an event shows a tooltip with its date and detail |
| Click an event | Opens the side panel (bottom sheet on narrow screens) with **Zoom to this event** and **Copy link to this event** buttons; clicking an event never triggers the axis zoom |
| **Legend** button | Toggles the legend: category filters and the region filter |
| **Layers** button | Between phone width and about 1,180 px, Earth, Reigns, Lives and Legend fold into this one menu so the zoom path keeps its place in the header; under 820 px the path takes a row of its own |
| **?** button, `?` key | Opens the guide, which also appears once on a first visit that did not arrive through a shared link |
| **Tours** button | Opens the list of guided tours; `←` / `→` step through a running tour |
| `Escape` | Closes the guide, else search, else the panel, else the legend, else the tours list, else ends a running tour |

## Visual modes

The console has six sensor-style modes, switched from the dock at the bottom of the stage, with the number keys `1`–`6`, or by cycling with `T`:

| Key | Mode | Look |
|---|---|---|
| 1 | Ops | Near-black console, cyan accent, hairline grid (default in dark colour schemes) |
| 2 | CRT | Amber phosphor with rolling scanlines |
| 3 | NVG | Green night-vision: the whole stage passes through a gradient-map filter |
| 4 | Ironbow | Thermal palette, black → purple → red → yellow → white |
| 5 | Noir | High-contrast grayscale |
| 6 | Paper | Warm paper and ink with a serif display face (default in light colour schemes) |

The choice is remembered in `localStorage` and written into the URL as `m=<mode>`, so a shared link carries its look. With no choice made, the mode follows `prefers-color-scheme`. The HUD in the stage's corners shows the span in view, visible events out of those in the window, the tier ceiling, the scale in years per pixel, the mode, a local clock, and a beacon when the present moment is on screen.

## Scale: logarithmic where it has to be

Humans have existed for 300,000 years and written things down for 5,300 of them. On a linear axis that leaves all of recorded history in the last 2% of the opening view, which is honest and useless. So the widest views are drawn on a warped axis: position follows −log₁₀(age + 2,000 years), close to linear for the last couple of millennia and logarithmic beyond, with round ticks to match (300,000, 100,000, 50,000, 20,000 and 10,000 years ago, then 3000 BCE, 1000 BCE, 1 CE, 1000, 1500, 2000). Recorded history gets about a quarter of the opening screen and fifteen of the sixteen landmark events have room for a label.

The warp fades out between spans of 120,000 and 60,000 years, so everything narrower, which is everything you reach within a click or two, is exactly linear, and nothing about those views has changed. The **Scale** toggle at the top left of the stage (or `L`) appears only where it matters and switches to a linear axis at any width, for anyone who wants to feel the true proportions; the choice is remembered, and a link made in linear mode says so (`sc=lin`) and opens that way without changing the recipient's own preference. The HUD reads "Logarithmic" instead of years per pixel on a warped view.

Gestures never assume a linear axis. A click fills the stage with the quarter of the screen around it; the wheel, a pinch and a drag keep the date under the pointer or finger where it is, by asking which stretch of the current width should fill the stage and then correcting for the change in warp. One case needs special care: scrolling in from the overview onto recent times, no linear view of the requested span can keep a recent date far from the right edge, and the limit at today would slide the target away; that step flies straight to the one view resting on today that keeps the date under the pointer.

## Earth layer

Three climate sparklines run beneath the axis and resolve as you zoom: atmospheric CO₂ (ice-core composite to 1957, Mauna Loa annual means since), Antarctic temperature anomaly (EPICA Dome C) and global sea level (Spratt & Lisiecki stack), covering the last 800,000 years. The HUD's **Earth** row shows the three values under the pointer. Toggle the layer with the **Earth** button or the `E` key; the choice is remembered.

Two human context series ride in the same layer, from `scripts/import-context.mjs` (`src/context.js`): **world population** as a dashed, log-scaled line from 10,000 BCE, and a **largest city** ribbon beneath the band naming the world's biggest city through time (Ebla, Ur, Babylon, Rome, Chang'an, Baghdad, Kaifeng, Hangzhou, Beijing, London, New York, Tokyo). The ribbon is hidden on views wider than 40,000 years, where five millennia of cities would be a barcode at the right edge. The HUD's City row names the city under the pointer. The ribbon is derived by interpolating each city between its own observations in Chandler's table and taking the largest at benchmark years; observations at least five times both neighbours are treated as digitisation slips and dropped (Delhi's 1375 figure carries an extra zero). On short screens the axis lifts slightly to make room, and the ribbon yields before the sparklines do.

The same import adds 263 natural-hazard events in a sixteenth category, `earth`: earthquakes with at least 10,000 recorded deaths or magnitude 8.5+, tsunamis with at least 5,000 deaths not already carried by their quake, and eruptions of VEI 6+ or at least 1,000 deaths, each linking to its NCEI record. Records within a year of a hand-curated quake, tsunami or eruption are skipped.

Regenerate both from the sources with:

```
node scripts/import-noaa.mjs   # writes src/earth.js and src/data/09-hazards.js, then rebuild
```

Population: Our World in Data, "Population, including UN projections" (CC BY 4.0); its values before 1800 derive from HYDE 3.3, which is CC BY-NC-SA 4.0, so reuse this series commercially only from 1800 onward. Cities: Chandler's historical urban population table as digitised by Reba, Reitsma & Seto (2016), figshare doi:10.6084/m9.figshare.2059494 (CC BY 4.0); the estimates are contested and end in 1975, where Tokyo has just passed New York. The ribbon's final Tokyo segment is carried to the present on the UN World Urbanization Prospects 2018 figure (37.4 million), since Tokyo has led every revision since.

Data credits (US Government works, unrestricted): Bereiter et al. 2015 CO₂ composite and Jouzel et al. 2007 EPICA Dome C temperature (NOAA NCEI Paleoclimatology); Spratt & Lisiecki 2016 sea-level stack (NOAA NCEI); NOAA GML Mauna Loa CO₂ record; NCEI/WDS Global Significant Earthquake, Tsunami and Volcanic Eruption Databases, doi:10.7289/V5TD9V7K.

## Lives: who was alive at the same time

Press **Lives** (or `P`) and the ruler rows at the top of the stage give way to lifespans: one bar per person from birth to death, packed into up to twelve rows, the most prominent first, with a caption saying how many of those alive in the view are shown. Zoom to 1440–1560 and Leonardo, Michelangelo, Copernicus, Luther, Dürer, Machiavelli, Columbus and Magellan overlap with Moctezuma, Pachacútec, Babur and Zara Yaqob. Hovering a bar gives the person's age at the date under the pointer; opening one gives the usual panel, with the birthplace on the map and an **Alive at the same time** list in place of the neighbouring events. Searching for a person turns the layer on. Lives and Reigns share the top of the stage, so turning one on turns the other off; the layer appears on views of 3,000 years or less, and respects the region filter through birthplaces.

Who counts as notable is not decided here. The 1,729 people are those of English Wikipedia's [Vital articles, level 4: People](https://en.wikipedia.org/wiki/Wikipedia:Vital_articles/Level_4/People), a list of about 1,900 biographies that its editors keep balanced across eras, regions and fields, who have a recorded birth and death; `scripts/import-lives.mjs` reads the list and takes dates, descriptions and birthplaces from Wikidata (CC0) through the entity API. The living are left out: this is a history layer. People are stored as ranged events flagged `life` in `src/data/14-lives.js`, never drawn in the ordinary event lanes, and their category is inferred from their description, so expect the odd philosopher filed under science.

## Guided tours

Seven hand-written paths through the events, for anyone who would rather be shown around than explore: **Peopling the world**, **The story of writing**, **Plagues and cures**, **Kingdoms and empires of Africa**, **Thinking machines**, **A century of cinema** and **Leaving the planet**. Pick one from the **Tours** button (on a phone, from the guide under **?**, which also offers them on a first visit). Each of a tour's nine to eleven steps flies the view to an event, opens its panel and shows a sentence or two of narration that carries the thread from the step before. **Next** and **Back**, or the right and left arrow keys, move through it; **Finish**, **End tour** or Escape leaves you where you are, free to look around.

The step is part of the URL (`tour=story-of-writing.4`), so the browser's Back and Forward buttons walk the tour, a reload resumes it, and a link shares a particular stop. On a phone the narration rides at the top of the event sheet, since the stage is too short to share.

Tours live in `src/tours.js`: an id, a title, a blurb and a list of `{ ev, note }` steps, where `ev` is the exact title of a curated event. `test/tours.test.js` checks that every step names a real event, that no tour visits one twice, that notes stay between 20 and 240 characters, and that each tour runs forward in time, so renaming or removing an event cannot silently break one.

## Your lifetime

The second entry in the **Tours** list asks for the year you were born. Your years are then marked on the timeline as a tinted band, and a tour is made for you on the spot: it opens on the whole of your life with what has changed in it (the number of events on record, the world's population and the CO₂ in the air, then and now), and goes on through up to nine events spread evenly across your years, the most significant of each stretch, each with how old you were. **Change year** on the tour bar edits or forgets it. The year is kept in this browser (`ht-birth`) and nowhere else: it is never written into the URL, so a link you share from inside the tour opens the same view for someone else without your year.

## Today in history

The first entry in the **Tours** list (and in the guide on a phone) is **Today in history**: Wikipedia's on-this-day list for the visitor's own date, most recent first, together with any bundled event that is known to the day and falls on it. Each entry is a jump: choosing one flies to a twenty-day view around it, opens its panel and lets the surrounding days load. It needs a single request, because the feed returns every year for a calendar day at once, and it switches on the online-content opt-in, which the entry says before you press it. On the 1st of a month only feed entries are listed, since bundled events known only to the month or the year are stored on the 1st by convention.

## Measuring the time between two events

Every panel has a **Measure** section. **Measure from this event** makes it the anchor (a chip at the top of the stage says what is being measured from, and a dashed ring marks it); open any other event, by clicking, searching or following a list, and the panel gives the time between the two, a span is drawn under the axis, and a comparison or two is worked out: for the earlier event, the best-known landmark before it that is nevertheless further away than the later one, and the same looking forward from the later event, or to today. Anchor the Great Pyramid and open Cleopatra, and it reports 2,510 years and that Cleopatra is closer to today than to the Great Pyramid. Gaps run between the nearest ends of ranged events and lives, so something that happened during a life is "at the same time". The anchor travels in the URL as `from=<slug>` beside `ev=`, so a finding is a link.

## More in the panel

Every panel now ends with ways onward, none of which touch the network until followed:

- **Around this time**: two events before and two after of comparable significance (no more than one tier finer than the open event, never finer than tier 4 unless it is), each with its distance in time. Hand-curated events are preferred to generated ones: an imported earthquake, launch or conflict start has to be more than three times closer in time to take the place of a curated neighbour, so Apollo 11 sits between the Civil Rights Act and the first ARPANET message rather than between two civil wars. For a ruler, the list is the predecessor and successor in the same office instead.
- **More in <category>**: the three nearest events of the same category, preferring the same region of the world.
- **Links**: the year's article on Wikipedia (back to 800 BCE), the calendar day's article for day-precise dates, the place on OpenStreetMap when the event is located, and the event's Wikidata item.

Choosing a listed event opens it, zooming only if it is not already on screen.

## Map, filters and search

- **Where it happened.** The detail panel shows a small world map with a pin and crosshair for any event with known coordinates. Hazards, battles and launches carry coordinates from their sources; the hand-curated events get theirs from Wikidata through each event's Wikipedia link (`scripts/import-geo.mjs` writes `src/geo.js`). A curated event can also carry its own `lat` and `lon`, which win: about 125 do, mostly in Africa, the Americas before 1500 and Oceania, where the linked article is often about a culture or a person rather than a place. These point at the site itself (a cave, a city, a battlefield) or, for a national political event, at the capital. When the point comes from a related place, such as a location or birthplace, rather than the item itself, the caption says "approximate". Country-level places are never used: an event known only to a country, state, empire or continent shows no map rather than a pin at a centroid. The land outline is Natural Earth 110m (public domain), simplified to a single 17 KB path by `scripts/build-map.mjs`.
- **Category filters.** The legend's entries are toggles: click to hide or show a category, Shift+click to show only that one, and use All or None to reset. A dot on the Legend button marks an active filter, and the choice is remembered. Hidden categories are excluded before tier selection, so the remaining events fill the view.
- **Region filter.** Below the categories, the legend has a row of regions and a small world map; pick Africa, Europe, Asia, N. America, S. America or Oceania (or click the map) and only events located there remain. Regions are coarse latitude/longitude boxes, with the Middle East counted as Asia and Micronesia, Hawaii and Rapa Nui as Oceania; rulers, who carry no coordinates, are placed by their office. Events with no known location are hidden while a region is chosen, and the choice is remembered alongside the category filter.
- **Search.** Press `/` or the Search button, type at least two characters, and pick a result with the arrow keys and Enter or a click. Title-prefix matches rank first, then word starts, then substrings, with ties going to the more significant event. Choosing a result zooms to the event and opens its panel, un-hiding its category and lifting the region filter if they would hide it.

## Permalinks, overview strip and guide

Links pasted into a chat or a post unfurl with a title, a description and a preview image (`docs/og.png`, 1200 × 630) through Open Graph tags in the page head, and the tab has an inline SVG favicon. The card is the same for every link: a static page cannot vary it by event or tour stop.


- **Event permalinks.** Opening an event adds `ev=<slug>` to the hash, where the slug is the event's title in lowercase ASCII with dashes (`#s=1960&e=1975&ev=apollo-11-lands-on-the-moon`). Loading or navigating to such a link opens the panel, and lifts any saved filter that would hide the event. Titles are unique across the data, so a slug stays valid for as long as its title does; an unknown slug is ignored. **Copy link to this event** puts the current URL on the clipboard.
- **Overview strip.** The strip under the header plots every event's density against years before the present on a log scale, so the last few thousand years get as much room as the first quarter-million. The marked window behaves like a scrollbar thumb: it keeps its width on the strip as you drag, which means the span in view grows as you move back in time. A click from the root view picks a window an eighth of the strip wide.
- **Guide.** A one-screen summary of the gestures and keys, shown once on a first visit without a hash and on demand from the **?** button or key (`ht-help-seen` in `localStorage`).

## Embedding

Add `?embed=1` before the hash and the page becomes a quiet version of itself for an iframe: the header keeps the path, **Zoom out** and **Home**, the brand line turns into an **Open the full timeline** link to the same view on the full page, and the HUD, mode dock, guide, tours, search, legend and online-content controls are gone. Everything in the hash still works, so an embed can open on a view, an event or a tour stop, in any mode:

```html
<iframe src="https://dshills.github.io/Humanity/?embed=1#s=1400&e=1600&m=paper&ev=gutenberg-prints-the-42-line-bible"
        width="100%" height="520" style="border:0" loading="lazy" title="Timeline: 1400 to 1600"></iframe>
```

An embedded page never adds entries to its host's history (every URL update is a `replaceState`), shows no first-visit guide, and hides the overview strip when the frame is under 420 px tall.

## Accessibility

- **Keyboard.** Everything is reachable without a pointer: events and reign bars are focusable buttons, `+`/`-`/`0` zoom, `L` switches the scale on wide views, `←`/`→` pan a fifth of the view (four fifths with Shift), `/` searches, and a **Skip to the timeline** button appears on the first Tab. Cards and dialogs (guide, tours, Today in history, legend, search) take the focus when they open and give it back to the control that opened them when they close; Escape closes them in turn.
- **Screen readers.** A polite live region says where the view has landed after a jump or a pan ("Showing 1000 – 1100. 31 events in view."), what a region filter now holds and how long the Today list is; the tour narration is its own live region; the event panel is named by its title; the HUD is decorative and hidden from assistive technology.
- **Contrast.** `test/contrast.test.js` reads the colour tokens of all six modes out of the stylesheet and holds them to WCAG AA (body text 7:1, muted and accent text 4.5:1, text on accent 4.5:1). NVG, Ironbow and Noir recolour the whole timeline through an SVG filter, so for those the tokens are pushed through the same filter before measuring; that caught Noir's tick labels at 3.4:1, now fixed.
- **Motion.** `prefers-reduced-motion` turns off zoom animation, pulses, scanlines and transitions. Forced-colours mode is supported.

## Opt-in online content

The page makes no network requests on its own. The detail panel has one checkbox, **Load images, summaries and day-by-day events from Wikimedia and museums**, which is off by default. While it is on, opening an event that links to Wikipedia requests that article's summary from the Wikipedia summary API and the thumbnail's author and licence from Wikimedia Commons, shows the image with a credit line linking to the file page and the article's opening paragraph as a quotation (CC BY-SA 4.0, linked to its source), and caches the result locally (up to 200 events) so each article is asked for once. An event with a museum object also loads that object's image from the museum's server. Images hosted on English Wikipedia itself are fair-use files, not freely licensed, and are never shown. Requests carry no cookies or referrer, a slow response can never land on a different event, and if the network is unavailable the panel simply has no image. Untick the box and the page goes back to making no requests.

**On this day.** The bundled data thins out below a year: a random 30-day window since 1950 starts a median of one event, and before 1900 most are empty. With the switch on, any view of about a month or less (35 days) asks Wikipedia's "on this day" feed for each calendar day in view, nearest the centre first, six at a time, and adds that day's entries as extra point events: hollow markers with muted labels, the full sentence as the detail, the most event-like linked article as the main link and the rest listed beneath it. They yield to bundled events when lanes run short, are skipped when a bundled event on the same day already links the same article, carry no location (so a region filter hides them), and disappear when you zoom back out or untick the box. Each response is about 100 KB compressed; only the year, the sentence and the article titles are kept, in memory and in a 40-day `localStorage` cache, so a month loads in ten to twenty seconds the first time and instantly after that. While the switch is off, a chip on such views offers to turn it on (and can be dismissed for good); while it is on, the chip shows progress and the count. A permalink to one of these events opens once its day has loaded. Text is from Wikipedia, CC BY-SA 4.0.
