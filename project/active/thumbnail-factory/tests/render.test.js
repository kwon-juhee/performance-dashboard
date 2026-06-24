const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { renderThumbnail, buildHtml } = require('../engine/render.js');

function pngSize(buf) {
  // PNG IHDR: width @ byte 16, height @ byte 20 (big-endian uint32)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('buildHtml injects all placeholders', () => {
  const html = buildHtml({
    title_html: 'AAA <span class="grad">BBB</span>',
    sub_html: 'CCC',
    motif_html: '<div class="ring"></div>',
  });
  assert.match(html, /AAA/);
  assert.match(html, /class="grad">BBB/);
  assert.match(html, /CCC/);
  assert.match(html, /<div class="ring">/);
  assert.doesNotMatch(html, /\{\{/); // no leftover placeholders
});

test('renderThumbnail produces 1600x900 PNG', async () => {
  const out = path.join(os.tmpdir(), 'tf_render_test.png');
  if (fs.existsSync(out)) fs.unlinkSync(out);
  await renderThumbnail({
    title_html: '검색에서 <span class="grad">대화</span>로',
    sub_html: '테스트 서브 문구',
    motif_html: '<div class="ring"></div><div class="ring r2"></div>',
    outPath: out,
  });
  assert.ok(fs.existsSync(out), 'PNG should exist');
  const { width, height } = pngSize(fs.readFileSync(out));
  assert.strictEqual(width, 1600);
  assert.strictEqual(height, 900);
});
