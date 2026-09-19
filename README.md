# Humanity — a zoomable timeline

**Live:** https://dshills.github.io/Humanity/

![A seventeen-second walk through the page: the logarithmic overview of 300,000 years zooms into recorded history and on to the years around 1500, the Lives layer shows who was alive then and opens Leonardo da Vinci, a guided tour stops at Citizen Kane, and the measuring tool reports that Cleopatra is closer to today than to the Great Pyramid](docs/demo.gif)

![The measuring tool in NVG mode on the years 2901 BCE to 400 CE: a chip reads Measuring from: Great Pyramid of Giza is completed for Khufu, a dashed ring marks the pyramid on the axis, and a bracket under the axis labelled 2,510 years runs from it to Cleopatra; the panel is open on Cleopatra, pharaoh, 51 to 30 BCE, and its Measure section says 2,510 years after the Great Pyramid, that the pyramid is closer in time to Cleopatra than to the domestication of rice, and that Cleopatra is closer to today, 2,055 years, than to the Great Pyramid](docs/screenshot.png)

<p>
  <img src="docs/mode-ops.png" width="32%" alt="Ops mode: near-black console with cyan accent">
  <img src="docs/mode-ironbow.png" width="32%" alt="Ironbow mode: thermal palette rendering">
  <img src="docs/mode-paper.png" width="32%" alt="Paper mode: warm ink on paper">
</p>

All of human history on one zoomable line: 300,000 years, from the first *Homo sapiens* to today. Click anywhere to zoom in, from millennia down to single days. It is one self-contained `index.html`, vanilla JavaScript and SVG, with no frameworks, nothing to install, and no network requests unless you switch on the optional online content.

## What's in it

- **4,273 events** in 16 categories, each with a short story and a link: 911 hand-curated, the rest imported from open data (NOAA hazards, Wikidata battles and rulers, Nobel Prizes, orbital launches, UCDP conflicts, and 214 landmark works of literature, music, art, architecture and film).
- **A logarithmic opening view**, so recorded history is a quarter of the first screen instead of its last 2%, with a linear axis a keypress away.
- **Layers**: 800,000 years of CO₂, temperature and sea level with world population and the largest city of each age; rulers of some thirty offices as swimlanes running to the present; and **Lives**, the lifespans of 1,729 notable people, to see who was alive at the same time.
- **Seven guided tours**, from *Peopling the world* to *A century of cinema*, plus **Today in history** and **Your lifetime**, a tour generated from the year you were born.
- **A measuring tool**: pick two events and get the gap, with findings such as *Cleopatra is closer to today than to the Great Pyramid*. The pair is in the URL, so a finding is a link.
- **Maps, filters and search**: a world map in every located event's panel, category and region filters, search across every event and person.
- **Six visual modes**, from a cyan operations console to night vision, thermal and paper.
- **Shareable everything**: the view, the mode, the open event, a tour stop and a measurement all live in the URL; `?embed=1` gives a quiet version for an iframe.
- **Accessible and offline**: keyboard-reachable throughout, screen-reader announcements, contrast held to WCAG AA in every mode by a test, and it runs from `file://`.

## Open it

- Visit **https://dshills.github.io/Humanity/**, or download `index.html` and double-click it (it works from `file://`).
- No build is needed to view it: `index.html` is the finished artifact.
- To change anything, edit the files under `src/` and rebuild:

```
node build.mjs        # inlines src/ into index.html (fails loudly on problems)
node --test test/     # 346 unit and data tests
node e2e/smoke.mjs    # 77 end-to-end checks in headless Chrome (needs a local Chrome or Chromium)
```

Node 18 or newer, zero dependencies. CI runs all three on every push, and checks that the committed `index.html` is what the sources build.

## Documentation

| | |
|---|---|
| [docs/USING.md](docs/USING.md) | Every feature: controls and keys, modes, the scale, layers, tours, Today in history, Your lifetime, measuring, the panel, filters and search, permalinks, embedding, accessibility, the online opt-in |
| [docs/DATA.md](docs/DATA.md) | Where each dataset comes from and its licence, significance tiers, how to add an event, the time model, the monthly data refresh |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Project layout, build and tests, and the design decisions |
| [CONTRACT.md](CONTRACT.md) | The binding interfaces between modules |
| [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) | The research report behind the choice of open data sources |
| [docs/LAUNCH.md](docs/LAUNCH.md) | Draft announcement posts, links worth sharing and a pre-launch checklist |

## Data and licences

The code is MIT. The bundled data keeps its sources' terms: Wikidata (CC0); NOAA and NCEI (US Government works); Nobel Prize API (CC0); GCAT launches, UCDP conflicts, Our World in Data population and the Chandler city table (CC BY 4.0; population before 1800 derives from HYDE 3.3, CC BY-NC-SA); Natural Earth (public domain); museum object records from The Met and Cleveland (CC0). Names in the Lives and Works layers come from Wikipedia's Vital articles lists. Text loaded with the online opt-in is from Wikipedia (CC BY-SA 4.0). Details and attributions are in [docs/DATA.md](docs/DATA.md) and [docs/USING.md](docs/USING.md).

## License

MIT — see [LICENSE](LICENSE).
