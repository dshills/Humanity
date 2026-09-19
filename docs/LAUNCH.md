# Launch notes

Drafts for announcing the project. Nothing here has been posted; edit to taste before you do.

**Link:** https://dshills.github.io/Humanity/  ·  **Repo:** https://github.com/dshills/Humanity

## What to say in one line

All of human history on one zoomable line: 300,000 years in a single self-contained HTML file.

## Show HN

**Title** (80 characters max; no superlatives, HN strips them):

> Show HN: Humanity – 300,000 years of history on one zoomable line, in one HTML file

**Text:**

> I wanted a timeline where you could start at the first Homo sapiens and click your way down to a single day, so I built one.
>
> It is a single self-contained index.html (about 500 KB over the wire): vanilla JavaScript and SVG, no framework, no build step to view it, and no network requests unless you opt in. It works from file://.
>
> Things I found interesting to build:
>
> - The opening view is logarithmic. On a linear axis, everything since the invention of writing is the last 2% of the screen. The log axis fades to exactly linear below 60,000 years, and the gestures (wheel, pinch, drag) had to stop assuming time is linear; zooming from the overview onto recent dates needed a special case so the date under your pointer stays under it.
> - About 4,300 events: 900 hand-written, the rest imported at build time from open data (NOAA, Wikidata, the Nobel API, Jonathan McDowell's launch log, UCDP), plus the lifespans of 1,700 notable people so you can see who was alive at the same time. For "who is notable" I did not want to decide, so the names come from Wikipedia's curated Vital Articles lists.
> - A measuring tool: pick two events and it tells you the gap and things like "Cleopatra is closer to today than to the Great Pyramid". The pair is in the URL.
> - Guided tours, "today in history", and a tour generated from the year you were born (kept in your browser only).
> - A monthly GitHub Action re-imports the data that changes (office-holders, launches, prizes) and opens a pull request rather than committing, because Wikidata can be edited by anyone. While importing I found Andy Warhol's label vandalised to an advert, which is how I learned to take names from article titles instead.
>
> It was built in a long pairing session with Claude Code; the repo has the original prompt, the module contract, 346 unit tests and a dependency-free end-to-end test that drives headless Chrome.
>
> Try: https://dshills.github.io/Humanity/#s=-2900&e=400&ev=cleopatra-pharaoh&from=great-pyramid-of-giza-is-completed-for-khufu
>
> I would like to know what is missing or wrong, especially outside Europe, where my curation is weakest.

**When:** weekday, 8–10 am US Eastern tends to give a Show HN its best chance. Stay for the first two hours and answer everything.

## Reddit

- **r/dataisbeautiful** needs an [OC] tag, a static image or GIF as the post, and a top-level comment with source and tools. Use `docs/demo.gif`. Comment: data sources (list from `docs/DATA.md`), tools (vanilla JS + SVG), and the link.
  Title: `[OC] 300,000 years of human history on one zoomable timeline (log scale, 4,300 events, 1,700 lifespans)`
- **r/InternetIsBeautiful**: link post straight to the live page. Title: `A zoomable timeline of all of human history, from the first Homo sapiens to today, down to single days`
- **r/history** and **r/AskHistorians** do not take tool announcements; skip them. **r/webdev** Showoff Saturday is fine for the engineering angle (single file, no dependencies, log-scale gestures).

## A short post (Mastodon, Bluesky, X, LinkedIn)

> I built a timeline of all of human history you can zoom from 300,000 years down to a single day. One HTML file, no dependencies, works offline.
>
> My favourite bit is the measuring tool: Cleopatra is closer to today than to the Great Pyramid.
>
> https://dshills.github.io/Humanity/

Attach `docs/demo.gif`.

## Links worth having ready

| What | Link |
|---|---|
| The opening view | https://dshills.github.io/Humanity/ |
| Cleopatra and the Great Pyramid | https://dshills.github.io/Humanity/#s=-2900&e=400&ev=cleopatra-pharaoh&from=great-pyramid-of-giza-is-completed-for-khufu |
| A tour stop (A century of cinema) | https://dshills.github.io/Humanity/#s=1936&e=1946&ev=citizen-kane-by-orson-welles&tour=century-of-cinema.5 |
| The Apollo 11 month, day by day | https://dshills.github.io/Humanity/#s=1969.5&e=1969.58&ev=apollo-11-lands-on-the-moon |
| Paper mode, 1400–1600 | https://dshills.github.io/Humanity/#s=1400&e=1600&m=paper |
| Embedded | https://dshills.github.io/Humanity/?embed=1#s=1400&e=1600&m=paper |

## Before posting

- [ ] Settings → Actions → General → allow Actions to create pull requests, so the monthly data refresh opens a PR.
- [ ] Settings → General → Social preview: upload `docs/og.png`, so links to the repository unfurl with an image too.
- [ ] Paste the live link into a chat app and check the preview card.
- [ ] Open the page on a phone you have not used it on, to see the first-visit guide the way a newcomer will.
- [ ] Expect the questions: why one file (it can be emailed, archived and opened in fifty years), why a log scale (see `docs/USING.md`), how accurate (every event links to its source; corrections welcome as issues).

## Regenerating the demo

`node scripts/make-demo-gif.mjs` rebuilds `docs/demo.gif` from the current `index.html` (needs Chrome and ffmpeg).
