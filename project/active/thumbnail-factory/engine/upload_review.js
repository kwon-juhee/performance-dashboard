// 렌더된 PNG들을 Dropbox _review/ 에 올리고, 시트 상태=검수대기 + 미리보기링크 기록 + 슬랙 알림
require('dotenv').config({ path: require('path').join(__dirname, '..', 'watcher', '.env') });
const fs = require('fs');
const path = require('path');
const { slug } = require('../watcher/rows.js');
const { getAccessToken, uploadAndShare } = require('./upload_dropbox.js');
const { setCell, setStatus } = require('../watcher/sheets_client.js');
const { notifySlack } = require('./notify_slack.js');

const FOLDER = process.env.DROPBOX_FOLDER || '/thumbnails';
const OUT = path.join(__dirname, '..', 'output');

(async () => {
  const jobs = JSON.parse(fs.readFileSync(path.join(OUT, 'jobs.json'), 'utf8'));
  const token = await getAccessToken();
  for (const j of jobs) {
    const png = path.join(OUT, `row${j.rowNum}.png`);
    if (!fs.existsSync(png)) { console.error(`skip row${j.rowNum}: no png`); continue; }
    try {
      const name = slug(j.title, j.rowNum) + '.png';
      const link = await uploadAndShare(png, `${FOLDER}/_review/${name}`, token);
      await setCell(j.rowNum, 'H', link);
      await setStatus(j.rowNum, '🔍 검수대기');
      await notifySlack(`👨🏻‍🎨'${j.title}' 썸네일 생성 완료!\n> <${link}|미리보기>를 통해 최종 검수를 진행해주세요.`);
      console.log(`검수대기 row${j.rowNum}: ${name}`);
    } catch (e) {
      await setStatus(j.rowNum, `⚠️ ${e.message}`.slice(0, 80));
      console.error(`row${j.rowNum} ERROR: ${e.message}`);
    }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
