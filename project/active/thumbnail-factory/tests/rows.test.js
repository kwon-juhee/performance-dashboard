const test = require('node:test');
const assert = require('node:assert');
const { slug, classifyRow } = require('../watcher/rows.js');

test('slug normalizes and appends row number', () => {
  assert.strictEqual(slug('ChatGPT 광고 시대!', 3), 'chatgpt-광고-시대-r3');
  assert.strictEqual(slug('', 7), 'thumb-r7');
});

test('classifyRow → generate only when 요청됨/재요청 and A,B,C filled', () => {
  // 빈칸(초안) = 생성 안 함 (요청 기반)
  assert.strictEqual(classifyRow(['타이틀', '서브', '느낌', '', '', '', '', false, '']), 'skip');
  assert.strictEqual(classifyRow(['타이틀', '서브', '느낌', '', '', '요청됨', '', false, '']), 'generate');
  assert.strictEqual(classifyRow(['타이틀', '서브', '느낌', '', '', '재요청', '', false, '']), 'generate');
  // 요청됐어도 A·B·C 미완이면 생성 안 함
  assert.strictEqual(classifyRow(['타이틀', '서브', '', '', '', '요청됨', '', false, '']), 'skip');
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
