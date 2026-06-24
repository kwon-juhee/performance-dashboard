const test = require('node:test');
const assert = require('node:assert');
const { runTick } = require('../watcher/tick.js');

function fakeDeps(rows) {
  const calls = { generate: [], upload: [], error: [] };
  return {
    calls,
    getRows: async () => rows,
    processGenerate: async (r) => { calls.generate.push(r.rowNum); },
    processUpload: async (r) => { calls.upload.push(r.rowNum); },
    onError: async (r, e) => { calls.error.push([r.rowNum, e.message]); },
    log: () => {},
  };
}

test('runTick routes generate/upload/skip by classification', async () => {
  // 컬럼: A0 B1 C2 D3 E4 생성요청5 상태6 미리보기7 결과링크8 승인9
  const rows = [
    { rowNum: 6, values: ['t', 's', 'c', '', '', false, '요청됨', '', '', false] },    // generate
    { rowNum: 7, values: ['t', 's', 'c', '', '', false, '검수대기', 'p', '', true] },  // upload
    { rowNum: 8, values: ['t', 's', 'c', '', '', false, '완료', 'p', 'g', true] },     // skip
  ];
  const d = fakeDeps(rows);
  await runTick(d);
  assert.deepStrictEqual(d.calls.generate, [6]);
  assert.deepStrictEqual(d.calls.upload, [7]);
  assert.strictEqual(d.calls.error.length, 0);
});

test('runTick isolates row errors via onError', async () => {
  const rows = [{ rowNum: 6, values: ['t', 's', 'c', '', '', false, '요청됨', '', '', false] }];
  const d = fakeDeps(rows);
  d.processGenerate = async () => { throw new Error('boom'); };
  await runTick(d);
  assert.strictEqual(d.calls.error.length, 1);
  assert.strictEqual(d.calls.error[0][1], 'boom');
});
