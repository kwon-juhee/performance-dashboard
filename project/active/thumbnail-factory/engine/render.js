const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'template.html');
const LOGO_PATH = path.join(ROOT, 'assets', 'lever-white.png');

function buildHtml({ title_html, sub_html, motif_html }) {
  const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const logoSrc = 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64');
  return tpl
    .split('{{TITLE_HTML}}').join(title_html)
    .split('{{SUB_HTML}}').join(sub_html)
    .split('{{MOTIF_HTML}}').join(motif_html)
    .split('{{LOGO_SRC}}').join(logoSrc);
}

async function renderThumbnail({ title_html, sub_html, motif_html, outPath }) {
  const html = buildHtml({ title_html, sub_html, motif_html });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.banner').screenshot({ path: outPath });
  } finally {
    await browser.close();
  }
  return outPath;
}

async function main() {
  const jobsFile = process.argv[2];
  if (!jobsFile) { console.error('usage: node render.js jobs.json'); process.exit(1); }
  const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
  const results = [];
  for (const job of jobs) {
    try {
      await renderThumbnail(job);
      results.push({ id: job.id, title: job.title, outPath: job.outPath, ok: true });
      console.log(`OK ${job.outPath}`);
    } catch (e) {
      results.push({ id: job.id, title: job.title, outPath: job.outPath, ok: false, error: e.message });
      console.error(`ERR ${job.outPath}: ${e.message}`);
    }
  }
  const resultPath = path.join(ROOT, 'output', 'render_results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
}

if (require.main === module) main();
module.exports = { renderThumbnail, buildHtml };
