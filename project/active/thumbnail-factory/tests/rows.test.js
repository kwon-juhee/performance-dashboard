const test = require('node:test');
const assert = require('node:assert');
const { slug, classifyRow } = require('../watcher/rows.js');

test('slug normalizes and appends row number', () => {
  assert.strictEqual(slug('ChatGPT 광고 시대!', 3), 'chatgpt-광고-시대-r3');
  assert.strictEqual(slug('', 7), 'thumb-r7');
});

// 컬럼: A0 B1 C2 D3 E4 생성요청5 상태6 미리보기7 결과링크8 승인9
test('classifyRow → generate only when 요청됨/재요청 and A,B,C filled', () => {
  // 빈칸(초안) = 생성 안 함 (요청 기반)
  assert.strictEqual(classifyRow(['타이틀', '서브', '느낌', '', '', false, '', '', '', false]), 'skip');
  assert.strictEqual(classifyRow(['타이틀', '서브', '느낌', '', '', false, '요청됨', '', '', false]), 'generate');
  assert.strictEqual(classifyRow(['타이틀', '서브', '느낌', '', '', false, '재요청', '', '', false]), 'generate');
  // 요청됐어도 A·B·C 미완이면 생성 안 함
  assert.strictEqual(classifyRow(['타이틀', '서브', '', '', '', false, '요청됨', '', '', false]), 'skip');
});

test('classifyRow → upload when 검수대기 and 승인(J) truthy', () => {
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', false, '검수대기', 'prev', '', true]), 'upload');
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', false, '검수대기', 'prev', '', false]), 'skip');
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', false, '검수대기', 'prev', '', 'TRUE']), 'upload');
});

test('classifyRow → skip for 완료/오류', () => {
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', false, '완료', 'prev', 'result', true]), 'skip');
  assert.strictEqual(classifyRow(['t', 's', 'c', '', '', false, '⚠️ 오류', '', '', false]), 'skip');
});
