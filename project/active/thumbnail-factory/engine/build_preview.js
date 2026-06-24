const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildPreview(items) {
  const cards = items.map(it => `    <figure>
      <a href="${escapeHtml(it.png)}" target="_blank"><img src="${escapeHtml(it.png)}" loading="lazy"></a>
      <figcaption>${escapeHtml(it.title || '')}</figcaption>
    </figure>`).join('\n');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>썸네일 검수</title>
<style>
  body{margin:0;background:#0d0e12;font-family:'Pretendard',sans-serif;color:#eee;padding:24px;}
  h1{font-size:18px;margin:0 0 16px;font-weight:700;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:18px;}
  figure{margin:0;background:#16171c;border:1px solid #2a2c33;border-radius:10px;overflow:hidden;}
  img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover;}
  figcaption{padding:10px 12px;font-size:13px;color:#bbb;line-height:1.4;}
</style></head><body>
<h1>썸네일 검수 — 클릭 시 원본 (총 ${items.length}건)</h1>
<div class="grid">
${cards}
</div>
</body></html>`;
}

function writePreview(items) {
  const html = buildPreview(items);
  const out = path.join(OUTPUT_DIR, '_preview.html');
  fs.writeFileSync(out, html);
  return out;
}

async function main() {
  const resultsPath = path.join(OUTPUT_DIR, 'render_results.json');
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const items = results.filter(r => r.ok).map(r => ({
    png: path.basename(r.outPath),
    title: r.title || r.id || path.basename(r.outPath),
  }));
  const out = writePreview(items);
  console.log(`preview: ${out}`);
}

if (require.main === module) main();
module.exports = { buildPreview, writePreview };
