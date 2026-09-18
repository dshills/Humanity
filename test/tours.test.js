'use strict';
// Tests for HT.tours: every step must name a real event, and a tour must read as a path forward in time.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../src/time.js');
require('../src/tiers.js');
for (const f of fs.readdirSync(path.join(__dirname, '../src/data')).filter((x) => x.endsWith('.js')).sort()) require('../src/data/' + f);
require('../src/tours.js');
const tours = globalThis.HT.tours;
const byTitle = new Map(globalThis.HT.events.map((e) => [e.title, e]));

test('there are tours, with unique slug ids', () => {
  assert.ok(Array.isArray(tours) && tours.length >= 3);
  const ids = tours.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, id);
  for (const id of ids) assert.ok(id.length <= 40, id);
});

test('titles, blurbs and step counts are within bounds', () => {
  for (const t of tours) {
    assert.ok(typeof t.title === 'string' && t.title.length >= 5 && t.title.length <= 40, `title: ${t.title}`);
    assert.ok(typeof t.blurb === 'string' && t.blurb.length >= 20 && t.blurb.length <= 160, `blurb of ${t.id}: ${t.blurb.length}`);
    assert.ok(Array.isArray(t.steps) && t.steps.length >= 5 && t.steps.length <= 12, `${t.id} has ${t.steps && t.steps.length} steps`);
  }
});

test('every step names an existing hand-curated event exactly, once per tour', () => {
  for (const t of tours) {
    const seen = new Set();
    for (const s of t.steps) {
      const ev = byTitle.get(s.ev);
      assert.ok(ev, `${t.id}: no event titled "${s.ev}"`);
      assert.ok(!ev.group && typeof ev.link === 'string', `${t.id}: "${s.ev}" should be a curated event with a link`);
      assert.ok(!seen.has(s.ev), `${t.id}: "${s.ev}" appears twice`);
      seen.add(s.ev);
      assert.deepEqual(Object.keys(s).sort(), ['ev', 'note'], `${t.id}: unexpected keys on a step`);
    }
  }
});

test('notes are one or two sentences: 20 to 240 characters, ending in punctuation', () => {
  for (const t of tours) for (const s of t.steps) {
    assert.ok(typeof s.note === 'string' && s.note.length >= 20 && s.note.length <= 240, `${t.id} / ${s.ev}: note is ${s.note && s.note.length} characters`);
    assert.match(s.note, /[.?!]$/, `${t.id} / ${s.ev}`);
  }
});

test('each tour runs forward in time', () => {
  for (const t of tours) {
    for (let i = 1; i < t.steps.length; i++) {
      const a = byTitle.get(t.steps[i - 1].ev); const b = byTitle.get(t.steps[i].ev);
      assert.ok(b.t >= a.t, `${t.id}: "${b.title}" comes before "${a.title}"`);
    }
  }
});
