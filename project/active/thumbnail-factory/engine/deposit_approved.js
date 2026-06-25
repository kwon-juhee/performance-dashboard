// 승인된 행(검수대기 & 승인✅)을 최종 폴더로 이동 + 팀 동기화폴더 복사 + 결과링크 + 완료 + 슬랙
require('dotenv').config({ path: require('path').join(__dirname, '..', 'watcher', '.env') });
const fs = require('fs');
const path = require('path');
const { classifyRow, slug } = require('../watcher/rows.js');
const { getAccessToken, moveFile, createSharedLink } = require('./upload_dropbox.js');
const { getRows, setCell, setStatus } = require('../watcher/sheets_client.js');
const { notifySlack } = require('./notify_slack.js');

const FOLDER = process.env.DROPBOX_FOLDER || '/thumbnails';
const OUT = path.join(__dirname, '..', 'output');

(async () => {
  const rows = await getRows();
  const approved = rows.filter(r => classifyRow(r.values) === 'upload');
  if (!approved.length) { console.log('승인 대기 없음'); return; }
  const token = await getAccessToken();
  for (const r of approved) {
    const title = r.values[0];
    try {
      const name = slug(title, r.rowNum) + '.png';
      await moveFile(`${FOLDER}/_review/${name}`, `${FOLDER}/${name}`, token);
      const link = await createSharedLink(`${FOLDER}/${name}`, token);
      await setCell(r.rowNum, 'I', link);
      const localDir = process.env.LOCAL_OUTPUT_DIR;
      if (localDir) {
        const src = path.join(OUT, `row${r.rowNum}.png`);
        if (fs.existsSync(src)) { fs.mkdirSync(localDir, { recursive: true }); fs.copyFileSync(src, path.join(localDir, name)); }
      }
      await setStatus(r.rowNum, '✅ 완료');
      await notifySlack(`✅ "${title}" 최종 적재 완료\n${link}`);
      console.log(`완료 row${r.rowNum}: ${name}`);
    } catch (e) {
      await setStatus(r.rowNum, `⚠️ ${e.message}`.slice(0, 80));
      console.error(`row${r.rowNum} ERROR: ${e.message}`);
    }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
