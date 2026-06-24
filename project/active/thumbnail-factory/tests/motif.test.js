const test = require('node:test');
const assert = require('node:assert');
const { extractMotifJson } = require('../watcher/motif.js');

test('extractMotifJson parses fenced json', () => {
  const out = 'sure!\n```json\n{"title_html":"A","sub_html":"B","motif_html":"<div></div>"}\n```\ndone';
  const o = extractMotifJson(out);
  assert.strictEqual(o.title_html, 'A');
  assert.strictEqual(o.motif_html, '<div></div>');
});

test('extractMotifJson parses bare json with prose around', () => {
  const out = 'Here: {"title_html":"X","motif_html":"<i></i>"} ok';
  const o = extractMotifJson(out);
  assert.strictEqual(o.title_html, 'X');
  assert.strictEqual(o.sub_html, ''); // 기본값
});

test('extractMotifJson throws when no object or missing keys', () => {
  assert.throws(() => extractMotifJson('no json here'));
  assert.throws(() => extractMotifJson('{"sub_html":"only"}')); // title/motif 없음
});
