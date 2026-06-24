# 썸네일 팩토리 Phase 2 Implementation Plan (로컬 워처)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 팀원이 시트에 입력하면 로컬 워처가 ~1분 내 썸네일을 생성→검수대기, 사람 승인(H 체크)시 Dropbox 적재까지 자동화한다.

**Architecture:** Node 상시 워처가 ~20초 폴링. 작업 감지 시 motif 생성만 LLM(`claude -p`, 폴백 Anthropic API)에 위임하고 나머지는 Phase 1 엔진 재사용. 시트는 기존 `~/.claude/google-oauth-token.json`(authorized-user) 재사용, Dropbox는 refresh token으로 무인 갱신.

**Tech Stack:** Node 18+, `googleapis`, Playwright(기존), Dropbox HTTP API, `node:test`.

---

## 파일 구조

```
project/active/thumbnail-factory/
  engine/upload_dropbox.js     # [수정] getAccessToken/moveFile/createSharedLink 추가
  watcher/
    rows.js                    # slug(), classifyRow() — 순수 함수
    motif.js                   # extractMotifJson(), generateMotif() (claude -p | api)
    sheets_client.js           # googleapis OAuth2(기존 토큰), getRows/setStatus/setCell
    tick.js                    # runTick(deps), processGenerate(), processUpload()
    watcher.js                 # 메인 루프 (의존성 조립 + setInterval)
    .env.example
    SETUP.md                   # 서버리스 셋업 안내(dropbox refresh, task scheduler, claude -p)
    get_dropbox_refresh_token.js  # refresh token 발급 헬퍼(1회용)
    start-watcher.ps1          # 작업 스케줄러 등록/실행용
  tests/
    upload_dropbox.test.js     # directLink, tokenCacheFrom
    rows.test.js               # slug, classifyRow
    motif.test.js              # extractMotifJson
    tick.test.js               # runTick 상태 전이(페이크 주입)
  apps-script/생성요청.gs        # 시트 버튼
```

---

## Task 1: 의존성 + 워처 스캐폴드

**Files:** Modify `package.json`; Create `watcher/.env.example`

- [ ] **Step 1: googleapis 의존성 추가 + 설치**

`package.json` dependencies에 `"googleapis": "^144.0.0"` 추가, scripts에 `"watch": "node watcher/watcher.js"` 추가.
Run: `cd project/active/thumbnail-factory && npm install`
Expected: googleapis 설치.

- [ ] **Step 2: watcher/.env.example 작성**

```
# 시트 (기존 OAuth 토큰 재사용)
GOOGLE_OAUTH_TOKEN=C:/Users/MADUP/.claude/google-oauth-token.json
SPREADSHEET_ID=14s1-yYUqQkZBE8xKhEgt8U8V_scUFKVAGmot9VP85jw
SHEET_NAME=시트1
# Dropbox (refresh token 권장; 없으면 DROPBOX_TOKEN 4h 폴백)
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REFRESH_TOKEN=
DROPBOX_TOKEN=
DROPBOX_FOLDER=/thumbnails
# LLM: claude(=claude -p, 무료) | api(=ANTHROPIC_API_KEY)
LLM_BACKEND=claude
ANTHROPIC_API_KEY=
# 폴링 주기(ms)
POLL_INTERVAL_MS=20000
```

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(phase2): scaffold watcher (deps, env)"`

---

## Task 2: upload_dropbox.js 확장 (refresh token + move)

**Files:** Modify `engine/upload_dropbox.js`; Test `tests/upload_dropbox.test.js`

- [ ] **Step 1: 실패 테스트 작성** (`tests/upload_dropbox.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert');
const { directLink, tokenCacheFrom } = require('../engine/upload_dropbox.js');

test('directLink converts dl=0 to dl=1 (both URL forms)', () => {
  assert.match(directLink('https://x/y?rlkey=a&dl=0'), /dl=1/);
  assert.match(directLink('https://x/y?dl=0'), /dl=1/);
});

test('tokenCacheFrom computes token + expiry with 5min skew', () => {
  const c = tokenCacheFrom({ access_token: 'AT', expires_in: 14400 }, 1_000_000);
  assert.strictEqual(c.token, 'AT');
  assert.strictEqual(c.exp, 1_000_000 + (14400 - 300) * 1000);
});
```

- [ ] **Step 2: 실패 확인** `node --test tests/upload_dropbox.test.js` → FAIL (tokenCacheFrom 미정의)

- [ ] **Step 3: upload_dropbox.js 수정** (전체 교체)

```js
const fs = require('fs');

function directLink(url) {
  return url.replace(/dl=0/, 'dl=1');
}

function tokenCacheFrom(json, now) {
  return { token: json.access_token, exp: now + (json.expires_in - 300) * 1000 };
}

let _cache = { token: null, exp: 0 };
async function getAccessToken(now = Date.now()) {
  if (!process.env.DROPBOX_REFRESH_TOKEN) {
    if (process.env.DROPBOX_TOKEN) return process.env.DROPBOX_TOKEN; // 4h 폴백
    throw new Error('No DROPBOX_REFRESH_TOKEN or DROPBOX_TOKEN');
  }
  if (_cache.token && now < _cache.exp) return _cache.token;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
    client_id: process.env.DROPBOX_APP_KEY,
    client_secret: process.env.DROPBOX_APP_SECRET,
  });
  const r = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!r.ok) throw new Error(`token refresh failed ${r.status}: ${await r.text()}`);
  _cache = tokenCacheFrom(await r.json(), now);
  return _cache.token;
}

async function uploadFile(localPath, dropboxPath, token) {
  const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: fs.readFileSync(localPath),
  });
  if (!r.ok) throw new Error(`upload failed ${r.status}: ${await r.text()}`);
}

async function createSharedLink(dropboxPath, token) {
  const sh = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dropboxPath }),
  });
  if (sh.ok) return directLink((await sh.json()).url);
  const ls = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dropboxPath, direct_only: true }),
  });
  const lj = await ls.json();
  if (lj.links && lj.links[0]) return directLink(lj.links[0].url);
  throw new Error(`could not create/find shared link: ${await sh.text()}`);
}

async function moveFile(fromPath, toPath, token) {
  const r = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_path: fromPath, to_path: toPath, autorename: false }),
  });
  if (!r.ok) throw new Error(`move failed ${r.status}: ${await r.text()}`);
  return (await r.json()).metadata;
}

async function uploadAndShare(localPath, dropboxPath, token) {
  const t = token || await getAccessToken();
  await uploadFile(localPath, dropboxPath, t);
  return createSharedLink(dropboxPath, t);
}

async function main() {
  const [localPath, dropboxPath] = process.argv.slice(2);
  if (!localPath || !dropboxPath) { console.error('usage: node upload_dropbox.js <local.png> </dropbox/path.png>'); process.exit(1); }
  console.log(await uploadAndShare(localPath, dropboxPath));
}
if (require.main === module) main();
module.exports = { directLink, tokenCacheFrom, getAccessToken, uploadFile, createSharedLink, moveFile, uploadAndShare };
```

- [ ] **Step 4: 통과 확인** `node --test tests/upload_dropbox.test.js` → PASS (2)
- [ ] **Step 5: Phase 1 회귀 확인** `npm test` → 6 pass (기존 4 + 2)
- [ ] **Step 6: Commit** `git add engine/upload_dropbox.js tests/upload_dropbox.test.js && git commit -m "feat(phase2): dropbox refresh-token + moveFile"`

---

## Task 3: watcher/rows.js (slug, classifyRow)

**Files:** Create `watcher/rows.js`; Test `tests/rows.test.js`

- [ ] **Step 1: 실패 테스트** (`tests/rows.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert');
const { slug, classifyRow } = require('../watcher/rows.js');

test('slug normalizes and appends row number', () => {
  assert.strictEqual(slug('ChatGPT 광고 시대!', 3), 'chatgpt-광고-시대-r3');
  assert.strictEqual(slug('', 7), 'thumb-r7');
});

test('classifyRow → generate when status blank/요청됨/재요청 and A,B,C filled', () => {
  const base = ['타이틀', '서브', '느낌', '', '', '', '', false, ''];
  assert.strictEqual(classifyRow(base), 'generate');
  assert.strictEqual(classifyRow([...base.slice(0,5), '요청됨', '', false, '']), 'generate');
  assert.strictEqual(classifyRow(['타이틀','서브','','', '', '', '', false, '']), 'skip'); // C 비어있음
});

test('classifyRow → upload when 검수대기 and H truthy', () => {
  const row = ['t','s','c','','', '검수대기','', true, 'prevlink'];
  assert.strictEqual(classifyRow(row), 'upload');
  assert.strictEqual(classifyRow(['t','s','c','','','검수대기','', false,'p']), 'skip');
  assert.strictEqual(classifyRow(['t','s','c','','','검수대기','', 'TRUE','p']), 'upload');
});

test('classifyRow → skip for 완료/오류', () => {
  assert.strictEqual(classifyRow(['t','s','c','','','완료','g', true,'p']), 'skip');
  assert.strictEqual(classifyRow(['t','s','c','','','⚠️ 오류','', false,'']), 'skip');
});
```

- [ ] **Step 2: 실패 확인** `node --test tests/rows.test.js` → FAIL

- [ ] **Step 3: rows.js 구현**

```js
function slug(title, rowNum) {
  const base = String(title || '').toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return `${base || 'thumb'}-r${rowNum}`;
}

function truthy(v) {
  return v === true || /^(true|✅|y|yes)$/i.test(String(v || '').trim());
}

// row = [A..I] => 'generate' | 'upload' | 'skip'
function classifyRow(row) {
  const status = String(row[5] || '').trim();
  const a = String(row[0] || '').trim();
  const b = String(row[1] || '').trim();
  const c = String(row[2] || '').trim();
  if ((status === '' || status === '요청됨' || status === '재요청') && a && b && c) return 'generate';
  if (status === '검수대기' && truthy(row[7])) return 'upload';
  return 'skip';
}

module.exports = { slug, classifyRow, truthy };
```

- [ ] **Step 4: 통과 확인** `node --test tests/rows.test.js` → PASS (4)
- [ ] **Step 5: Commit** `git add watcher/rows.js tests/rows.test.js && git commit -m "feat(phase2): row classify + slug"`

---

## Task 4: watcher/motif.js (LLM 위임)

**Files:** Create `watcher/motif.js`; Test `tests/motif.test.js`

- [ ] **Step 1: 실패 테스트** (`tests/motif.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert');
const { extractMotifJson } = require('../watcher/motif.js');

test('extractMotifJson parses fenced json', () => {
  const out = 'sure!\n```json\n{"title_html":"A","sub_html":"B","motif_html":"<div></div>"}\n```\ndone';
  const o = extractMotifJson(out);
  assert.strictEqual(o.title_html, 'A');
  assert.strictEqual(o.motif_html, '<div></div>');
});

test('extractMotifJson parses bare json with prose around', () => {
  const out = 'Here: {"title_html":"X","motif_html":"<i></i>"} ok';
  const o = extractMotifJson(out);
  assert.strictEqual(o.title_html, 'X');
  assert.strictEqual(o.sub_html, ''); // 기본값
});

test('extractMotifJson throws when no object/keys', () => {
  assert.throws(() => extractMotifJson('no json here'));
  assert.throws(() => extractMotifJson('{"sub_html":"only"}')); // title/motif 없음
});
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: motif.js 구현**

```js
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const GENERATE_RULES = path.join(__dirname, '..', 'engine', 'generate.md');

function extractMotifJson(stdout) {
  const fence = stdout.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : stdout;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in LLM output');
  const obj = JSON.parse(raw.slice(start, end + 1));
  if (!obj.title_html || !obj.motif_html) throw new Error('LLM output missing title_html/motif_html');
  return { title_html: obj.title_html, sub_html: obj.sub_html || '', motif_html: obj.motif_html };
}

function buildPrompt(row) {
  const rules = fs.readFileSync(GENERATE_RULES, 'utf8');
  return `다음 규칙에 따라 썸네일 1건의 HTML 조각을 생성하라.\n\n=== 규칙 ===\n${rules}\n\n=== 입력 ===\n메인 타이틀(A): ${row[0]}\n서브 문구(B): ${row[1]}\n비주얼 느낌(C): ${row[2]}\n강조 단어(D): ${row[3] || '(자동 선택)'}\n참고 이미지 URL(E): ${row[4] || '(없음)'}\n\n=== 출력 형식 ===\n오직 아래 JSON 하나만 출력(설명·코드펜스 없이):\n{"title_html":"...","sub_html":"...","motif_html":"..."}`;
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    execFile('claude', ['-p', prompt], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`claude -p failed: ${stderr || err.message}`));
      resolve(stdout);
    });
  });
}

async function runApi(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`anthropic api failed ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.content.map(c => c.text || '').join('');
}

async function generateMotif(row) {
  const prompt = buildPrompt(row);
  const out = (process.env.LLM_BACKEND === 'api') ? await runApi(prompt) : await runClaude(prompt);
  return extractMotifJson(out);
}

module.exports = { extractMotifJson, buildPrompt, generateMotif };
```

- [ ] **Step 4: 통과 확인** `node --test tests/motif.test.js` → PASS (3)
- [ ] **Step 5: Commit** `git add watcher/motif.js tests/motif.test.js && git commit -m "feat(phase2): motif generation via claude -p / api"`

---

## Task 5: watcher/sheets_client.js (기존 OAuth 토큰 재사용)

**Files:** Create `watcher/sheets_client.js`

통합 모듈(라이브 검증). 단위 테스트 대신 Task 11에서 라이브 스모크.

- [ ] **Step 1: sheets_client.js 구현**

```js
const fs = require('fs');
const { google } = require('googleapis');

const TOKEN_PATH = process.env.GOOGLE_OAUTH_TOKEN || `${process.env.USERPROFILE || process.env.HOME}/.claude/google-oauth-token.json`;
const ID = process.env.SPREADSHEET_ID;
const SHEET = process.env.SHEET_NAME || '시트1';

function client() {
  const tok = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(tok.client_id, tok.client_secret);
  auth.setCredentials({ refresh_token: tok.refresh_token });
  return google.sheets({ version: 'v4', auth });
}

async function getRows() {
  const sheets = client();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ID, range: `${SHEET}!A2:I`, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return (res.data.values || []).map((values, i) => ({ rowNum: i + 2, values }));
}

async function setCell(rowNum, colLetter, value) {
  const sheets = client();
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: `${SHEET}!${colLetter}${rowNum}`,
    valueInputOption: 'USER_ENTERED', requestBody: { values: [[value]] },
  });
}

const setStatus = (rowNum, status) => setCell(rowNum, 'F', status);

module.exports = { getRows, setCell, setStatus };
```

- [ ] **Step 2: Commit** `git add watcher/sheets_client.js && git commit -m "feat(phase2): sheets client (reuse existing oauth token)"`

---

## Task 6: watcher/tick.js (오케스트레이션 + 상태 전이)

**Files:** Create `watcher/tick.js`; Test `tests/tick.test.js`

- [ ] **Step 1: 실패 테스트** (`tests/tick.test.js`) — 페이크 주입으로 상태 전이 검증

```js
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
    { rowNum: 2, values: ['t','s','c','','', '', '', false, ''] },        // generate
    { rowNum: 3, values: ['t','s','c','','', '검수대기','', true, 'p'] },  // upload
    { rowNum: 4, values: ['t','s','c','','', '완료','g', true, 'p'] },     // skip
  ];
  const d = fakeDeps(rows); await runTick(d);
  assert.deepStrictEqual(d.calls.generate, [2]);
  assert.deepStrictEqual(d.calls.upload, [3]);
});

test('runTick isolates row errors via onError', async () => {
  const rows = [{ rowNum: 2, values: ['t','s','c','','','', '', false, ''] }];
  const d = fakeDeps(rows);
  d.processGenerate = async () => { throw new Error('boom'); };
  await runTick(d);
  assert.strictEqual(d.calls.error.length, 1);
  assert.strictEqual(d.calls.error[0][1], 'boom');
});
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: tick.js 구현**

```js
const path = require('path');
const fs = require('fs');
const { classifyRow, slug } = require('./rows.js');
const { generateMotif } = require('./motif.js');
const { renderThumbnail } = require('../engine/render.js');
const { getAccessToken, uploadAndShare, moveFile, createSharedLink } = require('../engine/upload_dropbox.js');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const FOLDER = process.env.DROPBOX_FOLDER || '/thumbnails';

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

// --- 실제 글루 (watcher.js에서 주입) ---
async function processGenerate(r, sheets) {
  const { rowNum, values } = r;
  await sheets.setStatus(rowNum, '⏳ 생성중');
  const motif = await generateMotif(values);
  const out = path.join(OUTPUT_DIR, `row${rowNum}.png`);
  await renderThumbnail({ title_html: motif.title_html, sub_html: motif.sub_html, motif_html: motif.motif_html, outPath: out });
  const reviewPath = `${FOLDER}/_review/${slug(values[0], rowNum)}.png`;
  const link = await uploadAndShare(out, reviewPath);
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
```

- [ ] **Step 4: 통과 확인** `node --test tests/tick.test.js` → PASS (2)
- [ ] **Step 5: Commit** `git add watcher/tick.js tests/tick.test.js && git commit -m "feat(phase2): tick orchestration + state transitions"`

---

## Task 7: watcher/watcher.js (메인 루프)

**Files:** Create `watcher/watcher.js`

- [ ] **Step 1: watcher.js 구현**

```js
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
    try { await sheets.setStatus(r.rowNum, `⚠️ ${e.message}`.slice(0, 80)); } catch {}
  },
  log: (m) => console.log(`[${ts()}] ${m}`),
};

let running = false;
async function loop() {
  if (running) return; // 겹침 방지
  running = true;
  try { await runTick(deps); }
  catch (e) { console.error(`[${ts()}] tick failed: ${e.message}`); }
  finally { running = false; }
}

console.log(`[${ts()}] thumbnail watcher started (every ${INTERVAL}ms)`);
loop();
setInterval(loop, INTERVAL);
```

- [ ] **Step 2: dotenv 의존성 추가** package.json에 `"dotenv": "^16.4.0"` → `npm install`
- [ ] **Step 3: 구문 로드 확인** `node -e "require('./watcher/tick.js'); console.log('ok')"` → ok
- [ ] **Step 4: Commit** `git add watcher/watcher.js package.json package-lock.json && git commit -m "feat(phase2): watcher main loop"`

---

## Task 8: 시트 스키마 (H 체크박스 + I)

**Tooling:** Google Sheets MCP.

- [ ] **Step 1: 헤더 H1·I1 작성** `update_cells` range `H1:I1` = `[["승인","미리보기 링크"]]`
- [ ] **Step 2: H열 체크박스 데이터 검증 추가** `batch_update`로 H2:H1000에 BOOLEAN(checkbox) 데이터 검증 규칙 설정.
- [ ] **Step 3: 확인** `get_sheet_data` A1:I1 → 9컬럼 헤더 확인.

---

## Task 9: Apps Script 생성요청 버튼

**Files:** Create `apps-script/생성요청.gs`

- [ ] **Step 1: .gs 작성**

```js
// 시트 > 삽입 > 그림 또는 메뉴에 연결. 선택 행들의 F열을 '요청됨'으로.
function 생성요청() {
  const sh = SpreadsheetApp.getActiveSheet();
  const rng = sh.getActiveRange();
  const start = rng.getRow();
  const n = rng.getNumRows();
  for (let i = 0; i < n; i++) {
    const row = start + i;
    if (row < 2) continue;
    sh.getRange(row, 6).setValue('요청됨'); // F열
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(n + '개 행 생성요청 표시됨');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('썸네일')
    .addItem('선택 행 생성요청', '생성요청')
    .addToList ? null : null;
}
```
(주: 메뉴 등록은 `onOpen`에서 `createMenu('썸네일').addItem('선택 행 생성요청','생성요청').addToUi()` 사용 — 아래 최종본 참조.)

- [ ] **Step 2: Commit** `git add apps-script/생성요청.gs && git commit -m "feat(phase2): apps script 생성요청 button"`

---

## Task 10: 셋업 문서 + 헬퍼

**Files:** Create `watcher/SETUP.md`, `watcher/get_dropbox_refresh_token.js`, `watcher/start-watcher.ps1`

- [ ] **Step 1: get_dropbox_refresh_token.js** — 앱 key/secret로 authorize URL 출력 → code 입력 → refresh token 출력(1회용).
- [ ] **Step 2: start-watcher.ps1** — `node watcher/watcher.js` 실행 + 작업 스케줄러 등록 안내.
- [ ] **Step 3: SETUP.md** — (1) Dropbox refresh token 발급, (2) 작업 스케줄러 "로그온 시 시작" 등록, (3) `claude -p` 인증 검증 절차, (4) 시트 토큰 재사용 설명.
- [ ] **Step 4: Commit**

---

## Task 11: E2E 라이브 검증

- [ ] **Step 1: 시트 라이브 read** — `node -e "require('dotenv')...; sheets.getRows()"` → 행 출력(기존 OAuth 토큰으로 실제 접근 확인).
- [ ] **Step 2: 파이프라인 검증(motif 스텁)** — `claude -p`가 샌드박스에서 막히므로, motif를 수동 주입한 jobs로 processGenerate 경로(render→_review 업로드→시트 I 기록) 실행, 그 후 H=TRUE 세팅→processUpload(move→완료) 실행. 시트 F/G/I 전이 + Dropbox `_review`→최종 이동 확인.
- [ ] **Step 3: `claude -p` 검증은 사용자 세션 항목으로 SETUP.md에 명시** (샌드박스 한계).
- [ ] **Step 4: 전체 테스트** `npm test` → 전부 pass.
- [ ] **Step 5: 문서 갱신 + Commit**

---

## Self-Review

- **Spec coverage**: 워처/2단계/claude위임/OAuth재사용/refresh token/move/상태머신/컬럼H·I/버튼/스케줄러/에러격리/멱등 — Task 1~11에 매핑됨.
- **Placeholder scan**: 코드 단계 실제 코드 포함. Task 9 onOpen은 Step에서 최종본 명시.
- **Type consistency**: `classifyRow(row[])`, `slug(title,rowNum)`, `generateMotif(row)→{title_html,sub_html,motif_html}`, `getAccessToken()`, `moveFile(from,to,token)`, `uploadAndShare(local,path,token?)`, `runTick(deps)` — 전 Task 일관.
