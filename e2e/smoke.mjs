#!/usr/bin/env node
// End-to-end smoke test: opens the built index.html in headless Chrome and uses the page the way a visitor
// would (zoom, open an event, filter, search, take a tour, jump on the overview strip, switch mode, open
// Today in history), then fails on any broken expectation or any console error. No dependencies: a copy of
// the page gets a small harness injected, Chrome runs it under virtual time and dumps the DOM, and the
// results are read back out of it. The network is never touched: fetch is replaced with a canned feed.
//
//   node e2e/smoke.mjs            (needs Chrome or Chromium; set CHROME_BIN to point at one)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  const msg = 'e2e: no Chrome or Chromium found (set CHROME_BIN)';
  if (process.env.CI) { console.error(msg); process.exit(1); }
  console.log(msg + ' - skipped'); process.exit(0);
}

// Runs before the app: clean storage, collect errors, and answer the on-this-day request from a fixture.
// The fixture years are leap years, so the test also passes when it happens to run on 29 February.
const HOOK = `<script>
(function () {
  try { localStorage.clear(); } catch (e) {}
  window.__errors = [];
  window.addEventListener('error', function (e) { window.__errors.push(String(e.message || e.error || e)); });
  window.addEventListener('unhandledrejection', function (e) { window.__errors.push('unhandled: ' + String(e.reason)); });
  var ce = console.error; console.error = function () { window.__errors.push([].slice.call(arguments).join(' ')); ce.apply(console, arguments); };
  window.__fetches = [];
  window.fetch = function (url) {
    window.__fetches.push(String(url));
    if (/feed\\/onthisday\\/events\\//.test(String(url))) {
      var body = { events: [
        { year: 1984, text: 'A fixture event happens for the smoke test and is recorded here.', pages: [{ titles: { canonical: 'Fixture_event_(1984)' } }, { titles: { canonical: 'Smoke_testing' } }] },
        { year: 1664, text: 'An older fixture event takes place, long before the first one.', pages: [{ titles: { canonical: 'Older_fixture' } }] }
      ] };
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
    }
    return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
  };
})();
</script>`;

// Runs after the app has started. Every check pushes { name, ok, info }.
const STEPS = `<script>
(async function () {
  var R = []; var $ = function (id) { return document.getElementById(id); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var check = function (name, ok, info) { R.push({ name: name, ok: !!ok, info: info === undefined ? '' : String(info) }); };
  var span = function () { var v = HT.app.getView(); return v.end - v.start; };
  var key = function (k, target) { (target || document).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); };
  var eventNamed = function (re) { return [].slice.call(document.querySelectorAll('#timeline .event')).filter(function (g) { return re.test(g.getAttribute('aria-label') || ''); })[0]; };
  try {
    await wait(400);
    check('events are drawn at the root', document.querySelectorAll('#timeline .event').length > 0, document.querySelectorAll('#timeline .event').length);
    check('first visit shows the guide', !$('help').hidden);
    check('the guide offers the tours', document.querySelectorAll('#help-tour-list .tour-pick').length >= 4, document.querySelectorAll('#help-tour-list .tour-pick').length);
    check('root view has the recorded-history bracket and the Today line', !!document.querySelector('.era-jump') && !!document.querySelector('.now-line'));
    $('help-ok').click();
    check('Start exploring closes the guide and remembers it', $('help').hidden && localStorage.getItem('ht-help-seen') === '1');

    var root = span();
    check('the root opens on the log scale, with its toggle showing', !$('scale-toggle').hidden && /log/i.test($('scale-toggle').textContent) && /Logarithmic/.test($('hud-scale').textContent), $('scale-toggle').textContent);
    var x3000 = document.querySelector('.era-bracket').getBoundingClientRect();
    check('recorded history takes a fifth of the log root or more', x3000.width > innerWidth * 0.2, Math.round(x3000.width) + ' of ' + innerWidth);
    HT.app.zoomIn(1500); await wait(700);
    var zv = HT.app.getView();
    check('a click on the log root zooms to the quarter of the screen around it', zv.start < 1500 && zv.end > 1500 && span() < root / 8, Math.round(zv.start) + '..' + Math.round(zv.end));
    HT.app.zoomOut(); await wait(700);
    // wheel in and straight back out around one point: the date under the pointer must not drift
    var svgEl = $('timeline'); var sr = svgEl.getBoundingClientRect(); var wx = sr.left + sr.width * 0.7;
    var wheel = function (dy) { svgEl.dispatchEvent(new WheelEvent('wheel', { clientX: wx, clientY: sr.top + 300, deltaY: dy, bubbles: true, cancelable: true })); };
    svgEl.dispatchEvent(new PointerEvent('pointermove', { clientX: wx, clientY: sr.top + 300, bubbles: true, pointerId: 1, pointerType: 'mouse' }));
    await wait(100); var before = $('cursor-date').textContent;
    for (var i = 0; i < 6; i++) wheel(-120); await wait(300);
    var mid = $('cursor-date').textContent; var midSpan = span();
    var yearsOf = function (s) { return parseFloat(String(s).replace(/,/g, '')); };
    check('wheel zoom from the log root keeps the date under the pointer (within a pixel or two)', Math.abs(yearsOf(mid) - yearsOf(before)) <= yearsOf(before) * 0.02 && midSpan < root / 4, before + ' -> ' + mid + ', span ' + Math.round(midSpan));
    HT.app.home(); await wait(700);
    key('l'); await wait(300);
    check('L switches to a linear axis and the URL says so', /linear/i.test($('scale-toggle').textContent) && /sc=lin/.test(location.hash) && /1 px =/i.test($('hud-scale').textContent), location.hash);
    var lin3000 = document.querySelector('.era-bracket').getBoundingClientRect();
    check('on the linear root recorded history is a sliver again', lin3000.width < innerWidth * 0.03, Math.round(lin3000.width));
    HT.app.zoomIn(1500); await wait(700);
    check('a click zoom on a linear view divides the span by four', Math.abs(span() - root / 4) < 1e-6 * root, span());
    check('the hash follows the view', /^#s=-?[\\d.]+&e=(now|-?[\\d.]+)/.test(location.hash) && !/^#s=-298050&e=now/.test(location.hash), location.hash);
    HT.app.zoomOut(); await wait(700);
    check('zoom out returns to the root', /e=now/.test(location.hash) && Math.abs(span() - root) < 1e-6 * root, location.hash);
    key('l'); await wait(300);
    check('L again restores the log scale and drops sc= from the URL', /log/i.test($('scale-toggle').textContent) && !/sc=/.test(location.hash) && localStorage.getItem('ht-scale') === 'log', location.hash);

    HT.app.setView(1960, 1975, { animate: false }); await wait(300);
    var apollo = eventNamed(/^Apollo 11 lands on the Moon/);
    check('Apollo 11 is on a 1960-1975 view', !!apollo);
    if (apollo) { key('Enter', apollo); await wait(400); }
    check('Enter on an event opens its panel', !$('panel').hidden && /Apollo 11/.test($('panel-title').textContent), $('panel-title').textContent);
    check('the open event is in the URL', /ev=apollo-11-lands-on-the-moon/.test(location.hash), location.hash);
    check('the panel lists neighbours and links', document.querySelectorAll('#panel-near-list .panel-jump').length === 4 && document.querySelectorAll('#panel-more a').length >= 2);
    check('nothing was fetched without the opt-in', window.__fetches.length === 0, window.__fetches.join(' '));
    $('panel-close').click(); await wait(300);
    check('closing the panel clears ev= from the URL', $('panel').hidden && !/ev=/.test(location.hash), location.hash);

    HT.app.setView(500, 1500, { animate: false }); await wait(300);
    var all = $('hud-events').textContent;
    HT.app.setRegion('oceania'); await wait(300);
    var oce = $('hud-events').textContent;
    check('the region filter changes what is shown', oce !== all && parseInt(oce, 10) > 0, all + ' -> ' + oce);
    HT.app.setRegion(null); await wait(200);

    $('btn-search').click(); await wait(200);
    $('search-input').value = 'magna carta'; $('search-input').dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
    key('Enter', $('search-input')); await wait(900);
    check('search finds and opens Magna Carta', /Magna Carta/.test($('panel-title').textContent), $('panel-title').textContent);
    $('panel-close').click(); await wait(300);

    $('btn-tours').click(); await wait(200);
    check('the tours card opens with Today in history first', !$('tours').hidden && /Today in history/.test($('tours').textContent));
    document.querySelector('#tours .tour-pick[data-tour="leaving-the-planet"]').click(); await wait(900);
    check('a tour starts on its first step', !$('tour-bar').hidden && $('tour-count').textContent === '1 / 9' && /Sputnik/.test($('panel-title').textContent), $('tour-count').textContent + ' ' + $('panel-title').textContent);
    key('ArrowRight'); await wait(900); key('ArrowRight'); await wait(900);
    check('arrow keys advance the tour and the URL', /tour=leaving-the-planet\\.3/.test(location.hash) && /Apollo 8/.test($('panel-title').textContent), location.hash);
    key('Escape'); await wait(200); key('Escape'); await wait(300);
    check('Escape closes the panel, then ends the tour', $('tour-bar').hidden && !/tour=/.test(location.hash), location.hash);

    // Accessibility: overlays take and return focus, the arrows pan, jumps are announced, the skip button works.
    $('btn-tours').focus(); $('btn-tours').click(); await wait(200);
    check('an opened card takes the focus', $('tours').contains(document.activeElement), document.activeElement && document.activeElement.className);
    key('Escape'); await wait(200);
    check('Escape closes the card and returns focus to its button', $('tours').hidden && document.activeElement === $('btn-tours'), document.activeElement && document.activeElement.id);
    $('btn-legend').focus(); $('btn-legend').click(); await wait(200);
    var inLegend = $('legend').contains(document.activeElement);
    key('Escape'); await wait(200);
    check('the legend does the same', inLegend && $('legend').hidden && document.activeElement === $('btn-legend'), document.activeElement && document.activeElement.id);
    HT.app.setView(1000, 1100, { animate: false }); await wait(300);
    document.body.focus(); key('ArrowRight'); await wait(700);
    var pv = HT.app.getView();
    check('the right arrow pans a fifth of the view', Math.abs(pv.start - 1020) < 1e-6 && Math.abs(pv.end - 1120) < 1e-6, pv.start + '..' + pv.end);
    key('ArrowLeft'); await wait(1300);
    check('the live region announces where the view landed', /^Showing 1000\\W+1100\\. \\d+ events? in view\\.$/.test($('sr-status').textContent), $('sr-status').textContent);
    $('skip').focus(); $('skip').click(); await wait(100);
    check('the skip button lands on the first event', !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#timeline')), document.activeElement && document.activeElement.tagName);
    check('the panel is named by its title', $('panel').getAttribute('aria-labelledby') === 'panel-title' && !$('panel').hasAttribute('aria-label'));

    // Lives: lifespans replace the ruler rows; a person opens with contemporaries; search turns the layer on.
    HT.app.setView(1440, 1560, { animate: false }); await wait(300);
    check('rulers are in rows and no lives are drawn by default', document.querySelectorAll('#timeline .reign').length > 0 && document.querySelectorAll('#timeline .life').length === 0);
    key('p'); await wait(400);
    var lifeBars = document.querySelectorAll('#timeline .life').length;
    check('P turns the Lives layer on, in place of Reigns', lifeBars > 10 && $('btn-lives').getAttribute('aria-pressed') === 'true' && $('btn-reigns').getAttribute('aria-pressed') === 'false' && document.querySelectorAll('#timeline .reign:not(.life)').length === 0, lifeBars);
    check('the caption counts who is shown', /Lives . \\d+ of \\d+ alive in this view/.test(document.querySelector('.lives-caption').textContent), document.querySelector('.lives-caption').textContent);
    var leo = eventNamed(/^Leonardo da Vinci,/);
    if (leo) { key('Enter', leo); await wait(400); }
    check('a life opens with its years and the people alive at the same time', /Leonardo/.test($('panel-title').textContent) && /1452/.test($('panel-date').textContent) && /Alive at the same time/.test($('panel-near').textContent) && document.querySelectorAll('#panel-near-list .panel-jump').length >= 3, $('panel-near').textContent.slice(0, 60));
    $('panel-close').click(); await wait(200);
    key('r'); await wait(300);
    check('R brings the rulers back and turns Lives off', document.querySelectorAll('#timeline .life').length === 0 && document.querySelectorAll('#timeline .reign').length > 0 && localStorage.getItem('ht-lives') === '0');
    $('btn-search').click(); await wait(200);
    $('search-input').value = 'albert einstein'; $('search-input').dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
    key('Enter', $('search-input')); await wait(900);
    check('searching for a person turns Lives on and selects their bar', /Albert Einstein/.test($('panel-title').textContent) && !!document.querySelector('#timeline .life.selected'), $('panel-title').textContent);
    $('panel-close').click(); await wait(200); key('r'); await wait(200);

    // Works: an imported film is found by search and lands on a view that shows it.
    $('btn-search').click(); await wait(200);
    $('search-input').value = 'citizen kane'; $('search-input').dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
    key('Enter', $('search-input')); await wait(900);
    check('a landmark film is on the timeline and opens from search', /Citizen Kane by Orson Welles/.test($('panel-title').textContent) && /1941/.test($('panel-date').textContent) && !!document.querySelector('#timeline .event.selected'), $('panel-title').textContent + ' ' + $('panel-date').textContent);
    $('panel-close').click(); await wait(200);

    // Measuring: anchor one event, open another, read the gap and a comparison; the anchor rides in the URL.
    HT.app.setView(1960, 1975, { animate: false }); await wait(300);
    key('Enter', eventNamed(/^Apollo 11 lands on the Moon/)); await wait(400);
    $('measure-start').click(); await wait(300);
    check('Measure from this event sets the anchor, shows the chip and writes from= to the URL', !$('measure-chip').hidden && /Apollo 11/.test($('measure-chip-text').textContent) && /from=apollo-11-lands-on-the-moon/.test(location.hash) && !!document.querySelector('.measure-anchor'), location.hash);
    key('Enter', eventNamed(/^First message sent over ARPANET/)); await wait(400);
    check('another event shows the gap from the anchor, with a comparison', /^3 months after .Apollo 11 lands on the Moon.$/.test($('measure-gap').textContent) && document.querySelectorAll('#measure-lines li').length >= 1 && !!document.querySelector('.measure-span'), $('measure-gap').textContent + ' | ' + $('measure-lines').textContent.slice(0, 90));
    $('btn-search').click(); await wait(200);
    $('search-input').value = 'great pyramid of giza'; $('search-input').dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
    key('Enter', $('search-input')); await wait(900);
    $('measure-start').click(); await wait(200);
    $('btn-search').click(); await wait(200);
    $('search-input').value = 'cleopatra'; $('search-input').dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
    key('Enter', $('search-input')); await wait(900);
    check('the classic: Cleopatra is closer to today than to the Great Pyramid', /^2,[45]\\d\\d years after .Great Pyramid/.test($('measure-gap').textContent) && /Cleopatra[^\\u201d]*. is closer to today \\(2,05\\d years\\) than to .Great Pyramid/.test($('measure-lines').textContent), $('measure-gap').textContent + ' | ' + $('measure-lines').textContent);
    $('measure-stop').click(); await wait(300);
    check('Stop measuring clears the chip, the span and the URL', $('measure-chip').hidden && !/from=/.test(location.hash) && !document.querySelector('.measure-anchor') && /Measure from this event/.test($('measure-start').textContent), location.hash);
    $('panel-close').click(); await wait(200); key('r'); await wait(200);

    // Your lifetime: a year typed into the form marks the band and starts a generated tour; nothing reaches the URL.
    $('btn-tours').click(); await wait(200);
    document.querySelector('#tours .tour-pick[data-tour="@life"]').click(); await wait(200);
    var yearInput = $('life-year');
    check('Your lifetime asks for a birth year', !!yearInput && document.activeElement === yearInput);
    yearInput.value = '1850'; document.querySelector('.life-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(200);
    check('an impossible year is refused', /between 1900 and/.test(document.querySelector('.life-msg').textContent) && localStorage.getItem('ht-birth') === null);
    yearInput.value = '1984'; document.querySelector('.life-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(1000);
    var lv = HT.app.getView();
    check('a real one starts the tour on a view of the whole life', !$('tour-bar').hidden && /Your lifetime/.test($('tour-title').textContent) && /born in 1984/.test($('tour-note').textContent) && lv.start < 1984 && lv.start > 1975, $('tour-note').textContent.slice(0, 80));
    check('the band is drawn and the year stays out of the URL', !!document.querySelector('.mylife-zone') && localStorage.getItem('ht-birth') === '1984' && !/1984/.test(location.hash.replace(/s=[^&]*&e=[^&]*/, '')), location.hash);
    key('ArrowRight'); await wait(1000);
    check('the next step is an event with your age at the time', /You were about \\d+ when|year you were born/.test($('tour-note').textContent) && !$('panel').hidden, $('tour-note').textContent);
    key('Escape'); await wait(200); key('Escape'); await wait(300);
    $('btn-tours').click(); await wait(200);
    document.querySelector('#tours .tour-pick[data-tour="@life"]').click(); await wait(600);
    check('once set, the entry starts the tour straight away', !$('tour-bar').hidden && /Your lifetime/.test($('tour-title').textContent));
    $('tour-edit').click(); await wait(300);
    [].slice.call(document.querySelectorAll('.life-actions button')).filter(function (b) { return /Forget/.test(b.textContent); })[0].click(); await wait(300);
    check('Forget it clears the year and the band', localStorage.getItem('ht-birth') === null && !document.querySelector('.mylife-zone'));
    key('Escape'); await wait(200);

    HT.app.home(); await wait(700);
    var mm = $('minimap'); var r = mm.getBoundingClientRect();
    ['pointerdown', 'pointerup'].forEach(function (type) { mm.dispatchEvent(new PointerEvent(type, { clientX: r.left + r.width * 0.45, clientY: r.top + r.height / 2, bubbles: true, pointerId: 1, button: 0, isPrimary: true })); });
    await wait(800);
    var v = HT.app.getView();
    check('a click on the overview strip jumps to that era', v.start > -2000 && v.end < 2100 && v.end - v.start < 3000, Math.round(v.start) + '..' + Math.round(v.end));

    key('3'); await wait(200);
    check('key 3 switches to NVG', document.documentElement.getAttribute('data-theme') === 'nvg' && /m=nvg/.test(location.hash), document.documentElement.getAttribute('data-theme'));

    $('btn-tours').click(); await wait(200);
    document.querySelector('#tours .today-pick').click(); await wait(600);
    var items = document.querySelectorAll('#today .today-item');
    check('Today in history lists the day from the feed', !$('today').hidden && items.length >= 2 && /fixture/i.test($('today').textContent), items.length);
    check('it asked only for today, and turned the opt-in on', window.__fetches.length === 1 && /onthisday\\/events\\/\\d\\d\\/\\d\\d$/.test(window.__fetches[0]) && localStorage.getItem('ht-images') === '1', window.__fetches.join(' '));
    var first = [].slice.call(items).filter(function (b) { return /A fixture event/.test(b.textContent); })[0];
    if (first) { first.click(); await wait(1200); }
    check('choosing an entry flies to a view narrow enough to show it', $('today').hidden && span() <= 35 / 365 + 1e-9 && /A fixture event/.test($('panel-title').textContent), Math.round(span() * 365) + ' days, ' + $('panel-title').textContent);
    check('the on-this-day event is drawn and selected', !!document.querySelector('#timeline .event.otd.selected'));
    check('its panel is labelled and links the chosen article', /On this day/.test($('panel-category').textContent) && /Fixture_event/.test($('panel-link').href), $('panel-link').href);
  } catch (err) {
    check('the script ran to the end', false, err && err.stack ? err.stack : err);
  }
  check('no console errors or uncaught exceptions', window.__errors.length === 0, window.__errors.join(' | '));
  var pre = document.createElement('pre'); pre.id = 'e2e-result'; pre.textContent = JSON.stringify(R); document.body.appendChild(pre);
})();
</script>`;

// A run at tablet width: the layer buttons fold into one menu and the zoom path keeps its place in the header.
const MID_STEPS = `<script>
(async function () {
  var R = []; var $ = function (id) { return document.getElementById(id); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var check = function (name, ok, info) { R.push({ name: name, ok: !!ok, info: info === undefined ? '' : String(info) }); };
  var shown = function (el) { return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0; };
  try {
    await wait(400);
    check('900 px: the layer buttons are folded behind Layers', shown($('btn-layers')) && !shown($('btn-earth')) && !shown($('btn-legend')) && shown($('btn-tours')) && shown($('btn-search')), innerWidth);
    var crumbs = $('crumbs').getBoundingClientRect();
    check('900 px: the zoom path is visible and readable', crumbs.width >= 160 && /1400/.test($('crumbs').textContent), Math.round(crumbs.width) + 'px ' + $('crumbs').textContent);
    check('900 px: nothing overflows sideways', document.documentElement.scrollWidth <= innerWidth, document.documentElement.scrollWidth);
    var hud = $('hud-left').getBoundingClientRect(); var dock = $('dock').getBoundingClientRect();
    check('900 px: the HUD stays clear of the mode dock', hud.right <= dock.left || hud.bottom <= dock.top, Math.round(hud.right) + ' vs ' + Math.round(dock.left));
    $('btn-layers').click(); await wait(200);
    check('900 px: Layers opens a menu with the four toggles and takes the focus', shown($('btn-earth')) && shown($('btn-reigns')) && shown($('btn-lives')) && shown($('btn-legend')) && $('layer-group').contains(document.activeElement));
    $('btn-lives').click(); await wait(300);
    check('900 px: a toggle in the menu works', document.querySelectorAll('#timeline .life').length > 0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(200);
    check('900 px: Escape closes the menu and returns focus', !shown($('btn-earth')) && document.activeElement === $('btn-layers'));
    $('btn-layers').click(); await wait(100); $('btn-legend').click(); await wait(200);
    check('900 px: Legend opens its card and closes the menu', !$('legend').hidden && !shown($('btn-earth')));
  } catch (err) { check('900 px: the script ran to the end', false, err && err.stack ? err.stack : err); }
  check('900 px: no console errors or uncaught exceptions', window.__errors.length === 0, window.__errors.join(' | '));
  var pre = document.createElement('pre'); pre.id = 'e2e-result'; pre.textContent = JSON.stringify(R); document.body.appendChild(pre);
})();
</script>`;

// A second, shorter run with ?embed=1: the quiet page for iframes.
const EMBED_STEPS = `<script>
(async function () {
  var R = []; var $ = function (id) { return document.getElementById(id); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var check = function (name, ok, info) { R.push({ name: name, ok: !!ok, info: info === undefined ? '' : String(info) }); };
  var shown = function (el) { return !!el && getComputedStyle(el).display !== 'none' && !el.hidden; };
  try {
    await wait(400);
    check('embed: the page knows it is embedded', document.body.classList.contains('embed'));
    check('embed: no guide on a first visit', $('help').hidden || !shown($('help')));
    var visible = [].slice.call(document.querySelectorAll('#controls button')).filter(shown).map(function (b) { return b.id; });
    check('embed: only Zoom out and Home remain in the header', visible.join(',') === 'btn-out,btn-home', visible.join(','));
    check('embed: HUD, mode dock and chip are gone', !shown($('hud')) && !shown($('dock')) && !shown($('otd-chip')));
    var len = history.length;
    HT.app.zoomIn(1500); await wait(700); HT.app.zoomIn(1500); await wait(700);
    check('embed: zooming adds nothing to the host history', history.length === len, len + ' -> ' + history.length);
    var href = $('embed-open').getAttribute('href') || '';
    check('embed: the brand links to the same view on the full page', shown($('embed-open')) && href.indexOf('embed') < 0 && /\\?ref=blog#/.test(href) && href.indexOf(location.hash) > 0 && location.hash.length > 5, href.slice(-60));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })); await wait(100);
    check('embed: the ? key does not open a hidden guide', $('help').hidden);
  } catch (err) { check('embed: the script ran to the end', false, err && err.stack ? err.stack : err); }
  check('embed: no console errors or uncaught exceptions', window.__errors.length === 0, window.__errors.join(' | '));
  var pre = document.createElement('pre'); pre.id = 'e2e-result'; pre.textContent = JSON.stringify(R); document.body.appendChild(pre);
})();
</script>`;

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
if (!html.includes('<body>') || !html.includes('</body>')) { console.error('e2e: index.html has no <body>'); process.exit(1); }
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

function run(steps, query, size) {
  const dir = mkdtempSync(join(tmpdir(), 'humanity-e2e-'));
  const page = join(dir, 'index.html');
  writeFileSync(page, html.replace('<body>', '<body>' + HOOK).replace(/<\/body>(?![\s\S]*<\/body>)/, steps + '</body>'));
  const res = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--window-size=' + (size || '1400,900'), '--virtual-time-budget=60000', '--dump-dom', pathToFileURL(page).href + query,
  ], { encoding: 'utf8', timeout: 180000, maxBuffer: 256 * 1024 * 1024 });
  rmSync(dir, { recursive: true, force: true });
  const m = /<pre id="e2e-result">([\s\S]*?)<\/pre>/.exec(res.stdout || '');
  if (!m) {
    console.error('e2e: the page produced no result' + (res.error ? ` (${res.error.message})` : '') + `\n${(res.stderr || '').split('\n').slice(-5).join('\n')}`);
    process.exit(1);
  }
  return JSON.parse(decode(m[1]));
}

const results = run(STEPS, '').concat(run(EMBED_STEPS, '?embed=1&ref=blog'), run(MID_STEPS, '#s=1400&e=1600', '900,700'));
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.ok || !r.info ? '' : `\n        ${r.info}`}`);
}
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
