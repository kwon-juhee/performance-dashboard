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

// 단일 인스턴스 보장(중복 실행 방지): 로컬 포트 점유. 이미 떠 있으면 즉시 종료.
const net = require('net');
const guard = net.createServer();
guard.once('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log(`[${ts()}] 다른 워처가 이미 실행 중 — 종료`); process.exit(0); }
  throw e;
});
guard.listen(47615, '127.0.0.1', () => {
  console.log(`[${ts()}] thumbnail watcher started (poll ${INTERVAL}ms, sheet "${process.env.SHEET_NAME}")`);
  loop();
  setInterval(loop, INTERVAL);
});
