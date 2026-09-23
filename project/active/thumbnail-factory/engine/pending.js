// 생성 대기(요청됨/재요청) 행을 JSON으로 출력 → /thumbnail 커맨드가 motif 생성 대상 파악
require('dotenv').config({ path: require('path').join(__dirname, '..', 'watcher', '.env') });
const { getRows } = require('../watcher/sheets_client.js');
const { classifyRow } = require('../watcher/rows.js');

(async () => {
  const rows = await getRows();
  const pending = rows
    .filter(r => classifyRow(r.values) === 'generate')
    .map(r => ({
      rowNum: r.rowNum,
      title: r.values[0],
      sub: r.values[1],
      feel: r.values[2],
      emph: r.values[3] || '',
      ref: r.values[4] || '',
    }));
  console.log(JSON.stringify(pending, null, 2));
})().catch(e => { console.error(e.message); process.exit(1); });
