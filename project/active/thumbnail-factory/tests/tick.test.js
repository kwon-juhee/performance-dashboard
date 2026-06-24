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
  const rows = [
    { rowNum: 2, values: ['t', 's', 'c', '', '', '요청됨', '', false, ''] },   // generate
    { rowNum: 3, values: ['t', 's', 'c', '', '', '검수대기', '', true, 'p'] }, // upload
    { rowNum: 4, values: ['t', 's', 'c', '', '', '완료', 'g', true, 'p'] },    // skip
  ];
  const d = fakeDeps(rows);
  await runTick(d);
  assert.deepStrictEqual(d.calls.generate, [2]);
  assert.deepStrictEqual(d.calls.upload, [3]);
  assert.strictEqual(d.calls.error.length, 0);
});

test('runTick isolates row errors via onError', async () => {
  const rows = [{ rowNum: 2, values: ['t', 's', 'c', '', '', '요청됨', '', false, ''] }];
  const d = fakeDeps(rows);
  d.processGenerate = async () => { throw new Error('boom'); };
  await runTick(d);
  assert.strictEqual(d.calls.error.length, 1);
  assert.strictEqual(d.calls.error[0][1], 'boom');
});
