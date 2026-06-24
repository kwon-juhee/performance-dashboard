const path = require('path');
const { classifyRow, slug } = require('./rows.js');
const { generateMotif } = require('./motif.js');
const { renderThumbnail } = require('../engine/render.js');
const { getAccessToken, uploadAndShare, moveFile, createSharedLink } = require('../engine/upload_dropbox.js');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const FOLDER = process.env.DROPBOX_FOLDER || '/thumbnails';

// 순수 라우팅: 분류에 따라 주입된 핸들러 호출, 행 단위 에러 격리.
async function runTick(deps) {
  const rows = await deps.getRows();
  for (const r of rows) {
    const kind = classifyRow(r.values);
    if (kind === 'skip') continue;
    try {
      if (kind === 'generate') await deps.processGenerate(r);
      else if (kind === 'upload') await deps.processUpload(r);
    } catch (e) {
      await deps.onError(r, e);
    }
  }
}

// --- 실제 글루 (watcher.js에서 sheets 주입) ---
async function processGenerate(r, sheets) {
  const { rowNum, values } = r;
  await sheets.setStatus(rowNum, '⏳ 생성중');
  const motif = await generateMotif(values);
  const out = path.join(OUTPUT_DIR, `row${rowNum}.png`);
  await renderThumbnail({
    title_html: motif.title_html, sub_html: motif.sub_html, motif_html: motif.motif_html, outPath: out,
  });
  const name = `${slug(values[0], rowNum)}.png`;
  const link = await uploadAndShare(out, `${FOLDER}/_review/${name}`);
  await sheets.setCell(rowNum, 'I', link);
  await sheets.setStatus(rowNum, '검수대기');
}

async function processUpload(r, sheets) {
  const { rowNum, values } = r;
  const token = await getAccessToken();
  const name = `${slug(values[0], rowNum)}.png`;
  await moveFile(`${FOLDER}/_review/${name}`, `${FOLDER}/${name}`, token);
  const link = await createSharedLink(`${FOLDER}/${name}`, token);
  await sheets.setCell(rowNum, 'G', link);
  await sheets.setStatus(rowNum, '완료');
}

module.exports = { runTick, processGenerate, processUpload };
