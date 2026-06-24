const test = require('node:test');
const assert = require('node:assert');
const { slug, classifyRow } = require('../watcher/rows.js');

test('slug normalizes and appends row number', () => {
  assert.strictEqual(slug('ChatGPT 광고 시대!', 3), 'chatgpt-광고-시대-r3');
  assert.strictEqual(slug('', 7), 'thumb-r7');
});

test('classifyRow → generate when status blank/요청됨/재요청 and A,B,C filled', () => {
  const base = ['타이틀', '서브', '느낌', '', '', '', '', false, ''];
  assert.strictEqual(classifyRow(base), 'generate');
  assert.strictEqual(classifyRow(['타이틀', '서브', '느낌', '', '', '요청됨', '', false, '']), 'generate');
  assert.strictEqual(classifyRow(['타이틀', '서브', '느낌', '', '', '재요청', '', false, '']), 'generate');
  assert.strictEqual(classifyRow(['타이틀', '서브', '', '', '', '', '', false, '']), 'skip'); // C 비어있음
});

test('classifyRow → upload when 검수대기 and H truthy', () => {
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', '검수대기', '', true, 'p']), 'upload');
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', '검수대기', '', false, 'p']), 'skip');
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', '검수대기', '', 'TRUE', 'p']), 'upload');
});

test('classifyRow → skip for 완료/오류', () => {
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', '완료', 'g', true, 'p']), 'skip');
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', '⚠️ 오류', '', false, '']), 'skip');
});
