require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { runTick, processGenerate, processUpload } = require('./tick.js');
const sheets = require('./sheets_client.js');

const INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '20000', 10);

function ts() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

const deps = {
  getRows: sheets.getRows,
  processGenerate: (r) => processGenerate(r, sheets),
  processUpload: (r) => processUpload(r, sheets),
  onError: async (r, e) => {
    console.error(`[${ts()}] row ${r.rowNum} ERROR: ${e.message}`);
    try { await sheets.setStatus(r.rowNum, `⚠️ ${e.message}`.slice(0, 80)); } catch (_) {}
  },
  log: (m) => console.log(`[${ts()}] ${m}`),
};

let running = false;
async function loop() {
  if (running) return; // 틱 겹침 방지
  running = true;
  try { await runTick(deps); }
  catch (e) { console.error(`[${ts()}] tick failed: ${e.message}`); }
  finally { running = false; }
}

console.log(`[${ts()}] thumbnail watcher started (poll ${INTERVAL}ms, sheet "${process.env.SHEET_NAME}")`);
loop();
setInterval(loop, INTERVAL);
