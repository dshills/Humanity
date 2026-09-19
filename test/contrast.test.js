'use strict';
// Colour contrast of the theme tokens, read straight from src/styles.css, against WCAG 2 AA (4.5:1 for text).
// NVG, Ironbow and Noir also pass the whole SVG stage through a gradient-map filter (src/index.template.html),
// so for those the tokens are pushed through the same filter before measuring: that is what the tick labels,
// event labels and accent marks on the timeline actually look like.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '../src/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../src/index.template.html'), 'utf8');

function themes() {
  const out = {};
  const re = /(^|\n)(:root|html\[data-theme="(\w+)"\])\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const name = m[3] || 'ops';
    const vars = out[name] || (out[name] = {});
    m[4].replace(/--([\w-]+):\s*([^;]+);/g, (_, k, v) => { vars[k] = v.trim(); return ''; });
  }
  for (const name of Object.keys(out)) if (name !== 'ops') out[name] = Object.assign({}, out.ops, out[name]);
  return out;
}

function rgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  assert.ok(m, `not a #rrggbb colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
}
const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const luminance = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
function contrast(a, b) {
  const l1 = luminance(a); const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// feColorMatrix saturate(0) then feComponentTransfer tables, in sRGB space as the filters declare.
function filterFor(name) {
  const block = new RegExp(`<filter id="sensor-${name}"[\\s\\S]*?</filter>`).exec(html);
  if (!block) return null;
  const table = (ch) => new RegExp(`<feFunc${ch} type="table" tableValues="([^"]+)"`).exec(block[0])[1].trim().split(/\s+/).map(Number);
  const tabs = [table('R'), table('G'), table('B')];
  const look = (t, v) => { const x = Math.min(1, Math.max(0, v)) * (t.length - 1); const i = Math.min(t.length - 2, Math.floor(x)); return t[i] + (t[i + 1] - t[i]) * (x - i); };
  return (c) => { const g = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return tabs.map((t) => look(t, g)); };
}

const T = themes();

test('all six themes define the text tokens as hex colours', () => {
  assert.deepEqual(Object.keys(T).sort(), ['crt', 'ironbow', 'noir', 'nvg', 'ops', 'paper']);
  for (const [name, v] of Object.entries(T)) for (const k of ['bg', 'fg', 'muted', 'accent', 'accent-fg']) assert.match(v[k] || '', /^#[0-9a-f]{6}$/i, `${name} --${k}`);
});

test('interface text meets AA in every theme: body 7:1, muted and accent 4.5:1, text on accent 4.5:1', () => {
  for (const [name, v] of Object.entries(T)) {
    const bg = rgb(v.bg);
    assert.ok(contrast(rgb(v.fg), bg) >= 7, `${name} fg/bg ${contrast(rgb(v.fg), bg).toFixed(2)}`);
    assert.ok(contrast(rgb(v.muted), bg) >= 4.5, `${name} muted/bg ${contrast(rgb(v.muted), bg).toFixed(2)}`);
    assert.ok(contrast(rgb(v.accent), bg) >= 4.5, `${name} accent/bg ${contrast(rgb(v.accent), bg).toFixed(2)}`);
    assert.ok(contrast(rgb(v['accent-fg']), rgb(v.accent)) >= 4.5, `${name} accent-fg/accent`);
  }
});

test('timeline text still meets AA after the sensor filters of NVG, Ironbow and Noir', () => {
  for (const name of ['nvg', 'ironbow', 'noir']) {
    const f = filterFor(name);
    assert.ok(f, `no filter for ${name}`);
    const v = T[name];
    const bg = f(rgb(v.bg));
    for (const k of ['fg', 'muted', 'accent']) {
      const c = contrast(f(rgb(v[k])), bg);
      assert.ok(c >= 4.5, `${name}: filtered ${k} on filtered bg is ${c.toFixed(2)}:1`);
    }
  }
});
