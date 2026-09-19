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
    HT.app.zoomIn(1500); await wait(700);
    check('a click zoom divides the span by four', Math.abs(span() - root / 4) < 1e-6 * root, span());
    check('the hash follows the view', /^#s=-?[\\d.]+&e=(now|-?[\\d.]+)/.test(location.hash) && !/^#s=-298050&e=now/.test(location.hash), location.hash);
    HT.app.zoomOut(); await wait(700);
    check('zoom out returns to the root', /e=now/.test(location.hash) && Math.abs(span() - root) < 1e-6 * root, location.hash);

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

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
if (!html.includes('<body>') || !html.includes('</body>')) { console.error('e2e: index.html has no <body>'); process.exit(1); }
const dir = mkdtempSync(join(tmpdir(), 'humanity-e2e-'));
const page = join(dir, 'index.html');
writeFileSync(page, html.replace('<body>', '<body>' + HOOK).replace(/<\/body>(?![\s\S]*<\/body>)/, STEPS + '</body>'));

const res = spawnSync(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--window-size=1400,900', '--virtual-time-budget=60000', '--dump-dom', pathToFileURL(page).href,
], { encoding: 'utf8', timeout: 180000, maxBuffer: 256 * 1024 * 1024 });
rmSync(dir, { recursive: true, force: true });

const m = /<pre id="e2e-result">([\s\S]*?)<\/pre>/.exec(res.stdout || '');
if (!m) {
  console.error('e2e: the page produced no result' + (res.error ? ` (${res.error.message})` : '') + `\n${(res.stderr || '').split('\n').slice(-5).join('\n')}`);
  process.exit(1);
}
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const results = JSON.parse(decode(m[1]));
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.ok || !r.info ? '' : `\n        ${r.info}`}`);
}
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
