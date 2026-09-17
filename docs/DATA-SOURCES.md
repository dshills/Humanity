# Open data sources for Humanity

Research notes, verified 2026-09-17, on open data that could add richness to the timeline. Every URL below was opened and, where an API is involved, actually queried from this machine (including a CORS check with `Origin: https://dshills.github.io`).

## Constraints that shape every recommendation

- **No runtime network.** `index.html` makes no requests. Data must be imported at build time into the bundle, or offered as an explicit opt-in online enrichment (a toggle the user turns on).
- **Bundle size.** The page is ~435 KB today. Structured fields are cheap (a Q-id plus coordinates is ~20 bytes per event, ~17 KB for all 834). Images are not: a 60 px Wikipedia thumbnail is ~3 KB as a data URI, so baking thumbnails for every event would add 2.6 MB; only a small curated subset is viable.
- **Licence.** The repository is MIT. CC0 and CC BY sources can be bundled freely (CC BY needs a credit line). CC BY-SA *text* (Wikipedia prose, EventKG, Pantheon rows) bundled into the page would make the bundled data share-alike; prefer Wikidata labels and descriptions (CC0) for titles and keep Wikipedia only as the `link` target. Non-commercial sources (Seshat) are not compatible with bundling.

## Ranked recommendation

1. **Wikidata (CC0), at build time.** A `scripts/import-wikidata.mjs` step that runs class-scoped SPARQL queries (battles, treaties, disasters, inventions, discoveries, epidemics, elections) filtered by `wikibase:sitelinks`, and separately bakes Q-id, coordinates (P625, falling back to P276 → P625) and the Commons filename of P18 into the existing 834 events. Enables a map pin, localized article links and thousands of candidate events with no licence obligations and no runtime requests.
2. **Wikimedia Pageviews API, at build time.** One request per event for 12 months of views; blend `log10(views)` with sitelink counts into the `tier`, cache the result in the repo. Turns the hand-assigned tiers into something reproducible.
3. **Wikipedia REST `page/summary` + Commons `extmetadata`, opt-in online.** Behind a "Load images from Wikimedia" toggle: one CORS-safe GET per opened panel yields a 330 px thumbnail, an extract and a credit line. Cache in localStorage and send `Api-User-Agent`.
4. **UCDP Armed Conflict (CC BY 4.0), at build time.** ~2,600 conflict episodes 1946–2025 with start/end dates and intensity; import the wars as ranged `war` events with a fatality-based tier and a one-line citation.
5. **Curated museum objects (Rijksmuseum, The Met, Cleveland; all CC0, keyless).** ~50 hand-picked object IDs for art and culture events, hotlinked in the same opt-in online mode. Rijksmuseum's 120 px IIIF thumbnails are ~4 KB, small enough to bake for a handful.

---

## Part 1: Historical events and knowledge graphs

### 1. Wikidata: SPARQL endpoint and dumps (top pick)
- **URL**: https://query.wikidata.org/sparql · dumps https://dumps.wikimedia.org/wikidatawiki/entities/ · licence https://www.wikidata.org/wiki/Wikidata:Licensing
- **Licence**: "All structured data in the main, property and lexeme namespaces is made available under the Creative Commons CC0 License" (verified). No attribution required.
- **Access**: SPARQL (GET/POST, `format=json`), weekly JSON/RDF dumps (~130 GiB compressed JSON; smaller "truthy" NT variant), WDumper for filtered partial dumps.
- **Coverage**: all periods; the time datatype carries precision (day/year/decade/century/millennium) and calendar model (Julian/Gregorian); no year 0. BCE years map directly to astronomical `t` after fixing the year-0 offset.
- **Schema mapping**: `t` ← P585 (point in time) or P580 (start); `end` ← P582; `title` ← English label; `detail` ← description (CC0); `link` ← enwiki sitelink; `category` ← P31 class (battle Q178561, treaty Q131569, natural disaster, invention, discovery, election, epidemic).
- **Live-verified queries**:
  - `SELECT (COUNT(*) AS ?n) WHERE { ?item wdt:P31 wd:Q178561; wdt:P585 ?date }` → **11,531** battles with a point in time.
  - Battles with `wikibase:sitelinks > 80` ordered by sitelinks → Waterloo 94, Pearl Harbor 88, Thermopylae 83, Hastings 81, Badr 81 (Thermopylae appears twice because it has two P585 values; dedupe by item).
  - A global scan (`?item wdt:P585 ?d; wikibase:sitelinks ?s FILTER(?s > 40)`) **timed out at 60 s**; scope by class, page with LIMIT/OFFSET, or use the dump.
- **Significance tier**: `wikibase:sitelinks` is available inline. Suggested thresholds: ≥150 → 0–1, 100–149 → 2, 60–99 → 3, 40–59 → 4, 25–39 → 5, 15–24 → 6, else 7; refine with pageviews (source 2).
- **Limits** (WDQS user manual): 60 s per query, 60 s CPU per 60 s window, 5 parallel queries per IP, 30 error queries/min, mandatory descriptive `User-Agent`; 429 + `Retry-After` when exceeded.
- **Integration**: build-time import. Also viable as an optional online enrichment (CORS is enabled on the endpoint).
- **Caveats**: multiple P585 values per item; label quality varies; class hierarchies (P279*) are expensive, so enumerate concrete classes; ancient dates are often year-precision in the Julian calendar.

### 2. Wikimedia Pageviews API (significance signal)
- **URL**: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{project}/{access}/{agent}/{article}/{granularity}/{start}/{end}`
- **Live check**: `.../en.wikipedia/all-access/all-agents/Battle_of_Hastings/monthly/2025010100/2025123100` → 12 items, **1,271,551 views** in 2025.
- **Licence**: aggregate counts are factual data with no creative content; cite Wikimedia.
- **Limits**: 200 req/min with a compliant User-Agent (10/min anonymous without one); see https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits.
- **Tier derivation**: roughly `tier = clamp(7 - floor(log10(annual_views) - 3), 0, 7)` (1M+ → 0–1, 100k → 2–3, 10k → 4–5, <1k → 7); blend 50/50 with sitelinks to damp recency bias.
- **Integration**: build-time only (834 events ≈ 4 minutes at 200/min; cache the result in the repo).

### 3. English Wikipedia year/century pages and "Timeline of …" articles
- **URLs**: e.g. https://en.wikipedia.org/wiki/1066 · index https://en.wikipedia.org/wiki/List_of_timelines (hundreds of timelines: human prehistory, ancient history, Middle Ages, historic inventions, exploration).
- **Licence**: text is **CC BY-SA 4.0** (or GFDL); attribution via hyperlink to the article.
- **Access**: Action API, verified: `https://en.wikipedia.org/w/api.php?action=parse&page=1066&prop=wikitext&section=1&format=json` returns the "Events" section as bullet lines like `* [[March 20]] – [[Halley's Comet]] reaches [[perihelion]]…`. Bulk alternative: Wikimedia Enterprise "structured-wikipedia" Parquet on Hugging Face (CC BY-SA 4.0, 44 GiB, sections pre-parsed).
- **Coverage**: one page per year for roughly the last 2,500 years; decade/century pages before that; "Timeline of prehistory" for deep time.
- **Schema mapping**: `t` from page year + `[[Month day]]`; `title`/`detail` from bullet text; `link` from the first wikilink; `category` needs classification (heuristics, or Wikidata P31 of the linked item).
- **Integration**: build-time, but bundled prose makes the events file CC BY-SA. Mitigation: use the bullets only to *select* events, then take title/description from Wikidata (CC0) and write original `detail` text.
- **Caveats**: wikitext parsing noise; year pages are Eurocentric before 1500; 200 req/min.

### 4. Wikimedia Feed API: "On this day"
- **URL**: `https://en.wikipedia.org/api/rest_v1/feed/onthisday/{all|selected|events|births|deaths|holidays}/{MM}/{DD}` (also on api.wikimedia.org).
- **Live check**: `/events/07/14` → 14 events, each with `year`, `text`, `pages[]` (normalized title, `extract`, `thumbnail`, `content_urls`).
- **Licence**: CC BY-SA 4.0. **Limits**: 200 req/min with a User-Agent (`Api-User-Agent` from browser JS); api.wikimedia.org anonymous 500 req/h per IP.
- **Integration**: 366 calls at build time (≈5,000 events with extracts) or an opt-in online "today in history" ribbon.
- **Caveats**: recency-skewed, day precision, CE only.

### 5. EventKG 3.2 (event-centric temporal knowledge graph)
- **URL**: https://zenodo.org/records/10424118 · GitHub `sgottsch/eventkg`.
- **Licence**: the Zenodo record states **CC BY-SA 4.0**.
- **Access/format**: RDF tarballs, 7.8 GB full / 4.5 GB "light"; published 2023-12-22; 690k+ events, 2.3M temporal relations, 15 languages; integrates Wikidata, DBpedia, YAGO and Wikipedia event lists.
- **Mapping**: `sem:hasBeginTimeStamp/EndTimeStamp` → `t`/`end`; labels → title; `owl:sameAs` → link; relation counts as a significance proxy.
- **Integration**: build-time only (offline RDF processing). Good for breadth, but stale (2023) and share-alike.

### 6. UCDP (Uppsala Conflict Data Program)
- **URL**: https://ucdp.uu.se/downloads/ · API https://ucdpapi.pcr.uu.se/api/ (docs https://ucdp.uu.se/apidocs/)
- **Licence**: **CC BY 4.0**; cite Davies, Pettersson & Öberg 2026 (JPR).
- **Access/format**: CSV/Excel downloads; the JSON API needs an `x-ucdp-access-token` (5,000 req/day, versioned `ucdpprioconflict/26.1`).
- **Coverage**: Armed Conflict 1946–2025 (start/end dates, intensity, location, actors); GED events 1989–2025 with coordinates and deaths.
- **Mapping**: conflict → `{t: start_date, end: ep_end_date, title: "side_a vs side_b (location)", category: war}`; tier from cumulative battle deaths (≥1M → 1, ≥100k → 2, ≥10k → 3).
- **Integration**: build-time CSV import; ~2,600 episodes, a few KB after filtering to intensity 2 ("war").

### 7. Pantheon (notable people)
- **URL**: https://pantheon.world/data/datasets
- **Licence**: the site shows **CC BY-SA 4.0**; cite Yu et al. 2016.
- **Access/format**: bz2 CSV, 70k+ biographies with birth/death year and place, occupation, HPI (Historical Popularity Index), language editions, pageviews.
- **Mapping**: births/deaths → events with `t = birthyear`; **tier from HPI directly**.
- **Integration**: build-time; filter the top ~500 by HPI. Share-alike applies to the compiled rows.

### 8. Brecke Conflict Catalog (and the OWID republication)
- **URL**: https://brecke.inta.gatech.edu/research/conflict/ (`Conflict-Catalog-18-vars.xlsx`); OWID series https://ourworldindata.org/grapher/global-deaths-in-violent-political-conflicts-over-the-long-run.csv (1400–2000, 601 rows).
- **Licence**: **none stated** on Brecke's page; OWID's own work is CC BY 4.0 but third-party data keeps its original terms.
- **Coverage**: 3,708 conflicts with ≥32 deaths, 1400–present (European extension to 900 CE).
- **Integration**: only after asking the author; otherwise use it as a cross-check for war tiers rather than bundling rows.

### 9. Our World in Data long-run datasets
- **URL**: https://docs.owid.io/projects/etl/api/ (chart CSV and metadata endpoints verified: `/grapher/{slug}.csv`, `.metadata.json`).
- **Licence**: CC BY 4.0 (underlying producer terms apply).
- **Use**: not events but context bands for the axis (world population, GDP per capita, life expectancy, conflict deaths). Build-time, a few KB per series.

### 10. DBpedia
- **Endpoint**: https://dbpedia.org/sparql; licence **CC BY-SA 3.0 + GFDL**; the newer "Fusion" graph is BSL 1.1 (avoid).
- **Verdict**: superseded by Wikidata for this use (worse licence, duplicate results, no sitelink counts, uneven infobox dates). Only useful for long-form abstracts, which are share-alike anyway.

### 11. YAGO 4.5
- **URL**: https://yago-knowledge.org/downloads/yago-4-5; licence **CC BY-SA**; 49M entities, Turtle files; no public SPARQL endpoint listed.
- **Verdict**: a cleaner taxonomy than raw Wikidata, but it is Wikidata re-licensed as share-alike; go to the CC0 source instead.

### 12. Seshat Global History Databank
- **URL**: https://seshat-db.com/ (864 polities, 47 regions; CSV, REST API); downloads require sign-in; mirror https://github.com/datasets/seshat.
- **Licence**: **CC BY-NC-SA 4.0** with mandated citation (the GitHub mirror carries a contradictory CC0 file).
- **Verdict**: polity-level variables, not events; the NC clause conflicts with an MIT bundle. Useful only as a reference when hand-curating polity start/end ranges.

### 13. Kaggle datasets (checked, rejected)
- "World Important Events – Ancient to Modern" (ODC DbCL 1.0): provenance and row count not stated; unverifiable curation.
- "Historical Event Dataset" (MIT): the description states it is **1,200 synthetic events generated with Faker**. Do not use.
- "Database of Battles" (CDB90, ~600 battles 1600–1973): licence not visible without login; Wikidata already covers 11k+ dated battles.

---

## Part 2: Media and enrichment APIs

**Bundle-size measurements.** Wikipedia `pithumbsize` snaps to 60/120/250 px buckets: 60 px = 2.3 KB, 120 px = 5.7 KB, 250 px = 23.5 KB (JPEG). As data URIs (×1.37): ~3.1 KB / 7.8 KB / 32 KB per event, so 834 events ≈ **2.6 MB at 60 px, 6.5 MB at 120 px**. Build-time thumbnails are viable only for a subset (e.g. tiers 0–2, ~90 events × 3 KB ≈ 270 KB); everything else must be opt-in online. Coordinates and Q-ids cost ~20 bytes per event (~17 KB total).

### 1. Wikipedia REST `page/summary` (thumbnail, extract, coordinates): top pick for an opt-in online mode
- **URL**: `https://en.wikipedia.org/api/rest_v1/page/summary/{title}` (title = last path segment of each event's existing `link`).
- **Returns** (verified): `thumbnail{source,width,height}` (330 px), `originalimage`, `extract`, `extract_html`, `description`, `coordinates` (often null for events), `content_urls`; `cache-control: s-maxage=1209600` (14 days).
- **Licence**: text CC BY-SA; thumbnails are per-file licensed (see #3).
- **Auth and limits**: none; 2026 global limits are per minute: IP-only 10/min, browser-unauthenticated 200/min, compliant User-Agent 200/min; 429 + `Retry-After`. Cache aggressively and fetch one summary per panel open.
- **Headers**: browsers cannot set `User-Agent`; use `Api-User-Agent` (verified in `access-control-allow-headers`).
- **CORS**: `access-control-allow-origin: *` on the JSON and on `upload.wikimedia.org` images.
- **Integration**: "Load images from Wikimedia" toggle → one GET per opened panel; show the thumbnail, extract, credit line and "Read more".

### 2. Wikidata entity data (Q-id, P18 image, P625 coordinates, P276 location, dates, sitelinks): top pick for build time
- **Title → entity, 50 per call**: `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=A|B&props=claims|sitelinks&format=json&origin=*` (verified: Rosetta_Stone → Q48584 with P18 and P276; Battle_of_Hastings → Q83224 with P585 = 1066-10-14). ~17 calls for 834 events.
- **Single entity**: `https://www.wikidata.org/wiki/Special:EntityData/Q48584.json?flavor=simple` (CORS `*`).
- **SPARQL**: `https://query.wikidata.org/sparql?format=json` (CORS `*`); verified `P625` with `P276 → P625` fallback returns coordinates for both test events.
- **Licence**: **CC0**. Auth: none.
- **Integration**: build-time script bakes `q`, `lat/lon` and the Commons filename of P18 into each event. Runtime map pin with no network. `sitelinks` give localized article links for free.

### 3. Wikimedia Commons `imageinfo` + `extmetadata`: attribution and sized thumbnails
- **URL**: `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=120&titles=File:X.jpg&format=json&origin=*` (CORS `*`).
- **Returns**: `thumburl` at the exact width, `descriptionshorturl`, and extmetadata `Artist`, `Credit`, `LicenseShortName`, `LicenseUrl`, `AttributionRequired`, `UsageTerms`, `DateTimeOriginal`, GPS.
- **Licence**: per file; Commons:Credit_line requires author + licence + link for CC BY/BY-SA; CC0/PD need no credit. `Artist` may contain HTML; strip it.
- **Integration**: build-time for a baked subset (store a credit string ≤ 60 chars); online mode shows e.g. "Photo: Hans Hillewaert / CC BY-SA 4.0".

### 4. Wikimedia Feed "On this day"
- **URL**: `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/{all|selected|events|births|deaths|holidays}/{MM}/{DD}` (verified 09/17 → 73 events with thumbnails and extracts).
- **Auth and limits**: none; anonymous 500 req/h per IP, 5,000/h with a token. CORS `*`. Licence CC BY-SA.
- **Integration**: opt-in "Today in history" ribbon highlighting timeline events whose day matches; one request per day.

### 5. Rijksmuseum (no key, CC0, 4 KB IIIF thumbnails)
- **Search**: `https://data.rijksmuseum.nl/search/collection?title=night+watch&imageAvailable=true` (Linked Art JSON, CORS `*`, no API key). Object → `shows[0]` → `digitally_shown_by[0]` → `access_point[0].id` = IIIF base; `/full/!120,120/0/default.jpg` → 4.1 KB JPEG with CORS `*`.
- **Licence**: metadata and public-domain images CC0/PD; some CC BY 4.0.
- **Integration**: hand-curated object numbers for art and Dutch-history events; bake 120 px data URIs (~5.5 KB each) for a handful or hotlink.

### 6. The Met Collection API (CC0, no key, 80 req/s)
- `https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}` → `title, artistDisplayName, objectDate, isPublicDomain, primaryImageSmall, objectURL`; search `/search?q=&hasImages=true&dateBegin=&dateEnd=` (v1 search retires 2026-10-01; use v1.1).
- **Licence**: dataset CC0; images only where `isPublicDomain: true`. CORS `*` on API and images.
- **Caveat**: `primaryImageSmall` is ~300 KB (fine to hotlink, not to bake).

### 7. Cleveland Museum of Art Open Access (CC0, no key)
- `https://openaccess-api.clevelandart.org/api/artworks/?q=napoleon&cc0=1&has_image=1&created_after=&created_before=&limit=1` → `share_license_status: "CC0"`, `images.web.url` (900 px, ~128 KB). API CORS `*`; the image CDN sends no CORS header (`<img>` works, canvas is tainted).
- **Integration**: `created_after/before` lets a build script suggest an object per event year.

### 8. NASA Image and Video Library (no key)
- `https://images-api.nasa.gov/search?q=apollo%2011&media_type=image&year_start=1969&year_end=1969` (CORS `*`); thumbnails `images-assets.nasa.gov/image/{id}/{id}~thumb.jpg` (~60 KB, `<img>` only).
- **Licence**: NASA media generally not subject to copyright; exceptions for insignia, identifiable people and third-party (ESA/Hubble) items.
- **Integration**: curated `nasa_id` per space event, opt-in hotlink.

### 9. Open Library Covers (hotlink encouraged; rights unspecified)
- Lookup `https://openlibrary.org/search.json?title=origin+of+species&author=darwin&fields=cover_i,first_publish_year` (CORS `*`) → `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg` (~14 KB, CORS `*`; `?default=false` → 404 if none).
- **Limits**: cover-ID lookups unlimited; ISBN/OCLC/LCCN 100 req/IP per 5 min.
- **Caveat**: cover rights are unspecified (publisher/user uploads); hotlink only, never bake.

### 10. Europeana Search API (metadata CC0, media per record; free key)
- `https://api.europeana.eu/record/v2/search.json?wskey=KEY&query=Rosetta+Stone&reusability=open&profile=minimal` → `title`, `edmPreview` (~17 KB thumbnail, CORS `*`), `rights`, `dataProvider`, `year`. Free key via a Europeana account; demo key `api2demo` for testing only.

### 11. Library of Congress JSON API (no key, tight limits)
- `https://www.loc.gov/search/?q=gettysburg+address&fo=json`, `/item/{id}/?fo=json` → `image_url[]` (150 px, CORS `*`), `rights_advisory` per item. **Limits**: 20 req/min JSON, 150/min images, one-hour block on abuse. Build-time only.

### 12. Internet Archive
- `https://archive.org/advancedsearch.php?...&output=json` and `https://archive.org/metadata/{id}` (both CORS `*`); thumbnails have no CORS header. Descriptive User-Agent mandatory; licence per item. Link-outs to scans and audio (speeches, Apollo communications), not embedding.

### 13. Smithsonian Open Access (CC0, key required)
- `https://api.si.edu/openaccess/api/v1.0/search?q=&api_key=KEY`; api.data.gov keys 1,000 req/h. Image coverage looked uneven in demo samples; verify with a real key before relying on it. Lower priority.

### 14. Geography: Natural Earth, Nominatim, GeoNames
- **Natural Earth**: public domain, no attribution; 110 m coastlines simplify to a 20–40 KB inline SVG world map for pins. Best fit for the no-network constraint.
- **Nominatim** (ODbL, credit OpenStreetMap contributors): max 1 req/s, must identify the app; build-time only, for events without Wikidata coordinates.
- **GeoNames** (CC BY, username required, 1,000 credits/h): redundant given Wikidata P625.

### 15. Speech and translation
- Wikimedia's MinT translation is only available to Wikimedia products. The browser's on-device Web Speech API (`speechSynthesis`) gives a zero-network "Read aloud" button in ~10 lines. Wikidata `sitelinks` link each event to its article in 100+ languages.
