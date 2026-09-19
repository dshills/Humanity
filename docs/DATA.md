# Data: sources, rules and upkeep

What is bundled into the page, where it came from, under what licence, and how to add to it. The Earth layer and the Lives layer are described with the features in [USING.md](USING.md); the research behind the choice of sources is in [DATA-SOURCES.md](DATA-SOURCES.md).

## Wikidata layer

`scripts/import-wikidata.mjs` pulls two kinds of events from Wikidata (CC0, no attribution required) into `src/data/10-wikidata.js`:

- **Battles**: every item classed as a battle with a dated point in time and at least 20 sitelinks (roughly 600), tiered by sitelink count. A battle that a hand-curated event of the same year already names is skipped so the curated entry keeps its place.
- **Rulers and heads of government**: holders of more than 30 offices in 31 swimlanes, from pharaohs, Assyrian and Babylonian kings, Roman and Byzantine emperors, emperors of China, Japan and Ethiopia, popes, caliphs, khagans, sultans, Incas and tlatoque to US presidents, British and Indian prime ministers, French and Russian presidents, German chancellors and the general secretaries of the Chinese Communist Party. Each reign or term is a ranged event with at least 25 sitelinks. An office that was renamed or refounded keeps one lane: the Reich and Federal chancellors share "chancellor of Germany", and the crowns of England, Great Britain and the United Kingdom share "English and British monarch". The sitting holder of each living office (the latest start, with no end date and no date of death in Wikidata) is marked `ongoing`, so their bar runs to the Today line and their date reads "2017 – present"; the list is as of the last import, so re-run `node scripts/import-wikidata.mjs` after an election or a succession. Holders are named from their English label, falling back to the article title, because the query service's label lookup occasionally returns a bare item id.

With **Reigns** on (the header button or `R`, on by default on screens at least 640 px wide), rulers leave the ordinary event lanes and appear as **swimlanes** at the top of the stage: one row per office, each reign or term a bar labelled with the ruler's name when it fits. Rows keep a stable order, only offices with a holder in view are drawn, and when more offices are in view than there is room for, the most prominent ones stay. The event lanes always keep at least four rows. Bars behave like any other event: hover for the tooltip, click or press Enter for the panel. Category filters apply to the swimlanes too. On views wider than 20,000 years the swimlanes step aside, since every reign would be a sliver at the right edge.

Titles and one-line descriptions are Wikidata's own; each event links to its English Wikipedia article when one exists, otherwise to the Wikidata item. Dates are as recorded in Wikidata, which keeps pre-1582 dates in the Julian calendar. Regenerate with:

```
node scripts/import-wikidata.mjs   # writes src/data/10-wikidata.js, then rebuild
```

## Nobel Prizes and launches

- `scripts/import-nobel.mjs` writes `src/data/11-nobel.js`: one event per Nobel Prize since 1901 from the Nobel Foundation's API (CC0), dated by the announcement and linking to the prize's summary page. Physics, chemistry and economics are filed under science, medicine under medicine, literature under art and peace under politics.
- `scripts/import-gcat.mjs` writes `src/data/12-launches.js` from Jonathan McDowell's General Catalog of Artificial Space Objects (GCAT, CC BY 4.0, planet4589.org): every human orbital spaceflight launch, the first orbital launch from each launch site, and the first flight of each launch vehicle family with at least ten orbital launches. Launches within two days of a curated space event are skipped.

Both are build-time imports; the page still makes no network requests. Nobel Prize® is a registered trademark of the Nobel Foundation. Launch data: J. McDowell, planet4589.org.

## Conflicts and museum objects

- `scripts/import-ucdp.mjs` writes `src/data/13-conflicts.js` from the UCDP/PRIO Armed Conflict Dataset v26.1 (CC BY 4.0): the 116 conflicts since 1946 that reached war intensity (1,000 or more battle-related deaths in a year) and are not already covered by a curated war, each merged from its conflict-year rows into one ranged event linking to its UCDP page. Colonial wars are named for the territory and the power it fought. Cite Davies, Pettersson & Öberg (2026) and Gleditsch et al. (2002).
- `scripts/import-objects.mjs` writes `src/objects.js`: 33 events paired with a museum object, such as David's *Death of Socrates*, Rembrandt's *Aristotle with a Bust of Homer*, Michelangelo's studies for the Libyan Sibyl, a proto-cuneiform tablet, the seated statue of Hatshepsut and Leutze's *Washington Crossing the Delaware*. Objects come from The Metropolitan Museum of Art and the Cleveland Museum of Art Open Access programmes (CC0). A pairing is accepted only when the object is public domain, has an image, and matches an expected title, maker, culture or period. The panel always shows the object as a text link; its image loads only with the opt-in below.

## Works: books, music, paintings, buildings and films

`src/data/15-works.js` adds 214 landmark creative works as ordinary events: the *Iliad* and the *Analects*, the Book of Kells and the Bayeux Tapestry, *Hamlet*, *Las Meninas*, *The Well-Tempered Clavier*, *Dream of the Red Chamber*, Beethoven's Fifth, *The Great Wave off Kanagawa*, *War and Peace*, *Guernica*, *Things Fall Apart*, *Kind of Blue*, and twenty-nine films from *Battleship Potemkin*, *Metropolis* and *Citizen Kane* to *Seven Samurai*, *Breathless*, *Sholay* and *Spirited Away*. They sit at the finer tiers (works since 1800 one tier finer still), so they fill decade and year views, which were thin for the arts between 1500 and 1900, without crowding the wide ones. A seventh guided tour, **A century of cinema**, runs through the films.

The selection again belongs to Wikipedia's editors: `scripts/import-works.mjs` reads [Vital articles, level 4: Arts](https://en.wikipedia.org/wiki/Wikipedia:Vital_articles/Level_4/Arts), keeps the third of its 700 articles that are individual works (genres, movements, instruments and techniques are dropped by their Wikidata type), and dates each by first performance, publication, official opening or inception, in that order, from Wikidata (CC0). A publication date more than 25 years after a work's inception is taken for a later edition; dates known only to the decade or century are placed mid-period and said to be approximate, and nothing since 1500 is accepted on a century alone. Works already on the timeline, by article or by name in a curated title, are skipped. Works and creators are named by the titles of their Wikipedia articles, not their Wikidata labels, which anyone can edit: on the day this was written Andy Warhol's label read "Andy Warhol TM by Campbell Soup Company".

## Significance scores

`scripts/score-significance.mjs` scores every event that links to English Wikipedia by averaging the z-scores of log10(12-month pageviews) and log10(Wikidata sitelinks). Scores are mapped to tiers by keeping the curated tier counts and re-dealing the tiers in score order. The Wikidata importer uses the same thresholds, so imported battles and rulers sit on the same scale as the curated events (never above tier 3). [docs/TIER-AUDIT.md](TIER-AUDIT.md) lists the curated events the data disagrees with most. The signal measures article popularity rather than historical weight (applied raw, it would put YouTube on the 5,000-year view and sink most of prehistory into decade-only tiers), so `scripts/apply-tier-audit.mjs` applies it as a nudge: sitelinks weighted 70/30 over pageviews, a penalty for events after 1800, one tier per run and only where the disagreement is two tiers or more, age limits in both directions, and tiers 0 to 2 left editorial. One pass moved 222 of the 834 curated events by one tier. The scorer takes about fifteen minutes and caches its results in `scripts/cache/`.

## Adding an event

Events live in `src/data/NN-<era>.js`, one file per era, each pushing plain objects onto `HT.events`:

```js
{ t: ymd(1969, 3, 2),           // start: astronomical fractional year (required)
  end: ymd(2003, 11, 26),       // optional; omit for point events; must be > t
  title: 'Concorde in service',  // 1–80 chars, no trailing period, unique across all files
  detail: 'One or two sentences of context.',   // 20–300 chars
  tier: 6,                       // 0..7: the coarsest view at which it appears (see table below)
  category: 'technology' }       // one of the 15 categories
```

Date helpers (destructured from `HT.time` at the top of every data file):

| Helper | Meaning | Example |
|---|---|---|
| `bce(y, month?, day?)` | Year BCE (historical numbering) | `bce(3000)` → `-2999`; `bce(44, 3, 15)` → Ides of March |
| `ce(y, month?, day?)` | Year CE | `ce(1492)` → `1492`; `ce(1066, 10, 14)` |
| `ymd(year, month?, day?)` | Astronomical year plus optional month/day | `ymd(1969, 7, 20)` → `1969.5479…` |
| `ya(n)` | `n` years before 1950 | `ya(300000)` → `-298050` (the root start) |

Which file to put it in:

| File | Era |
|---|---|
| `01-prehistory.js` | 300,000 years ago – 10,000 BCE (dates via `ya`) |
| `02-ancient.js` | 10,000 BCE – 500 BCE |
| `03-classical.js` | 500 BCE – 500 CE |
| `04-medieval.js` | 500 – 1500 |
| `05-early-modern.js` | 1500 – 1800 |
| `06-modern.js` | 1800 – September 1945 |
| `07-postwar.js` | September 1945 – 1990 |
| `08-contemporary.js` | 1990 – today |

File an event by its start date; a range that crosses an era boundary stays in the file where it begins.

Rules enforced by `test/data.test.js`:

- `t` is a finite number in `[ROOT_START, now()]`; `end`, if present, is a finite number `> t` and `≤ now()`.
- `tier` is an integer 0..7; `category` is one of `origins, migration, technology, agriculture, civilization, empire, religion, science, art, war, exploration, politics, medicine, computing, space`.
- `title` is 1–80 characters with no trailing period; `detail` is 20–300 characters.
- No keys other than `t, end, title, detail, tier, category` (`id` is derived from the array index; do not author it).
- Titles are unique across all files (case-insensitive); at least 300 events in total.
- Representative windows keep a minimum number of visible events (8 at the root and each era window, 6 per decade window, 4 per year window), so lowering a tier can fail a test if a window empties out.

Convention (not machine-checked): events after 1900 carry day precision (`ymd(y, m, d)`) wherever the exact date is well known; approximate historical dates say so in the title or detail.

Then run `node --test test/` and `node build.mjs`.

### Links

Any event may carry an optional `link` (an `https://` URL, normally the English Wikipedia article). When present, the detail panel shows a **Read more** link that opens in a new tab. Following a link is the only way the page ever reaches the network; it makes no requests on its own.

```js
{ t: ymd(1969, 7, 20), title: 'Apollo 11 lands on the Moon', detail: '…', tier: 0, category: 'space',
  link: 'https://en.wikipedia.org/wiki/Apollo_11' }
```

## Tier-to-span mapping

`tierForSpan(span)` in `src/tiers.js`. An event is drawn when `event.tier <= tierForSpan(end - start)`:

| Tier | Shown when the view span is | Intended meaning |
|---|---|---|
| 0 | ≥ 100,000 years | The ~15 most consequential events in human history (root view) |
| 1 | ≥ 20,000 years | Matters at the scale of all civilization |
| 2 | ≥ 5,000 years | Matters at a 5,000-year scale |
| 3 | ≥ 1,000 years | Matters at a 1,000-year scale |
| 4 | ≥ 200 years | Matters at a 200-year scale |
| 5 | ≥ 50 years | Matters at a 50-year scale |
| 6 | ≥ 10 years | Matters at a decade scale |
| 7 | < 10 years | Only shown below a decade |

Current distribution of the 834 events: tier 0: 16, 1: 36, 2: 38, 3: 151, 4: 184, 5: 224, 6: 147, 7: 38.

## Time model

Every instant is one floating-point number `t` in astronomical years: `1 CE = 1`, `1 BCE = 0`, `2 BCE = -1`, so `3000 BCE = -2999`. The fractional part is the fraction of that calendar year elapsed, in the proleptic Gregorian calendar, UTC (so `ymd(1969, 7, 20)` is day 201 of 365, 1969.5479…). "Years ago" are counted from 1950 (the radiocarbon BP convention): `ya(n) = 1950 - n`, and the root start `ya(300000) = -298050`. "Today" is `new Date()` converted to `t`. Views are `[start, end]` clamped to `[ROOT_START, today]`, with a minimum span of one day (`1/365.25`).

Label style depends on the span of the current view (`formatDate(t, span)`):

| Regime | View span | Style | Example |
|---|---|---|---|
| ago | > 20,000 years | years ago | `250,000 years ago` |
| year | 2 – 20,000 years | historical year | `3000 BCE`, `79 CE`, `1492` |
| month | 0.25 – 2 years | month + year | `Jul 1969` |
| day | ≤ 0.25 years | month, day, year | `Jul 20, 1969` |

## Keeping the data current

Several sources move: office-holders change, prizes are awarded, rockets launch, another year of CO₂ is measured. `node scripts/refresh.mjs` re-runs the importers for those (Wikidata, Nobel, GCAT, NOAA, UCDP, population and cities; pass names to run a subset) and prints a summary, including any change in the sitting holder of an office. An importer that fails, or whose output has lost more than a tenth of its events, has its files restored from git, so a source that is down or has changed shape cannot shrink the timeline. The curated events, coordinates, museum objects and significance scores are not touched.

`.github/workflows/refresh-data.yml` does this on the 3rd of each month (and on demand from the Actions tab): it runs the refresh, rebuilds, runs the tests, pushes a `data-refresh` branch and opens a pull request with the summary as its body. Nothing reaches `main` without a review, which matters because Wikidata can be edited by anyone. If the repository does not allow Actions to open pull requests (Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"), the job opens an issue with a one-click link to create the pull request instead.
