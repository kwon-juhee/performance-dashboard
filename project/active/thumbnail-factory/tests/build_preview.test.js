const test = require('node:test');
const assert = require('node:assert');
const { buildPreview } = require('../engine/build_preview.js');

test('buildPreview renders one figure per item with original link', () => {
  const html = buildPreview([
    { png: 'a.png', title: 'T1' },
    { png: 'b.png', title: 'T2' },
  ]);
  assert.strictEqual((html.match(/<figure>/g) || []).length, 2);
  assert.match(html, /href="a\.png"/);
  assert.match(html, /href="b\.png"/);
  assert.match(html, /총 2건/);
});

test('buildPreview escapes HTML in titles', () => {
  const html = buildPreview([{ png: 'x.png', title: '<script>bad' }]);
  assert.doesNotMatch(html, /<script>bad/);
  assert.match(html, /&lt;script&gt;bad/);
});
