# 썸네일 팩토리 Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팀원이 Google Sheet에 텍스트/느낌만 입력하면 LEVER Xpert 포맷 썸네일 PNG가 생성·검수 후 Dropbox에 적재되는 `/thumbnail` 슬래시 커맨드 파이프라인을 만든다.

**Architecture:** 고정 HTML 프레임(`template.html`)에 Claude가 행마다 생성한 우측 비주얼 HTML/SVG를 주입 → Node+Playwright로 1600×900 PNG 렌더 → 갤러리 `_preview.html`로 검수 → 승인분만 Dropbox 업로드 → 시트에 상태/링크 writeback. 순수 코드 단위(render/preview/upload)는 TDD, LLM·외부 연동 단위는 통합 검증.

**Tech Stack:** Node 18+ (내장 fetch, `node:test`), Playwright(chromium), Google Sheets MCP, Dropbox HTTP API.

---

## 파일 구조

```
project/active/thumbnail-factory/
  template.html              # 파라미터화 프레임 ({{TITLE_HTML}} {{SUB_HTML}} {{MOTIF_HTML}} {{LOGO_SRC}})
  assets/lever-white.png     # 로고 (content/ai-commerce-post 복사)
  package.json               # node:test 스크립트, playwright 의존
  .gitignore                 # .env, node_modules, output/*.png
  .env.example               # DROPBOX_TOKEN=
  engine/
    render.js                # buildHtml(), renderThumbnail(), CLI: node render.js jobs.json
    build_preview.js         # buildPreview() → output/_preview.html
    upload_dropbox.js        # uploadAndShare(local, dropboxPath)
    generate.md              # 우측 비주얼 생성 프롬프트 가드레일 (Claude가 읽는 규칙)
  tests/
    render.test.js
    build_preview.test.js
  output/                    # 렌더 PNG + _preview.html (gitignore)
.claude/commands/thumbnail.md  # /thumbnail 프로젝트 커맨드 (오케스트레이션)
```

각 단위 책임:
- **template.html**: 시각 프레임만. 로직 없음.
- **render.js**: HTML 문자열 조립 + PNG 렌더. 시트/Dropbox 모름.
- **build_preview.js**: PNG 목록 → 검수 갤러리 HTML. 렌더/업로드 모름.
- **upload_dropbox.js**: 로컬 파일 → Dropbox 업로드 + 공유 링크. 시트/렌더 모름.
- **generate.md / thumbnail.md**: Claude가 읽는 규칙·오케스트레이션. 코드 아님.

---

## Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `project/active/thumbnail-factory/package.json`
- Create: `project/active/thumbnail-factory/.gitignore`
- Create: `project/active/thumbnail-factory/.env.example`
- Copy: `content/ai-commerce-post/lever-white.png` → `project/active/thumbnail-factory/assets/lever-white.png`

- [ ] **Step 1: 로고 복사 + 폴더 생성**

Run:
```bash
cd "C:/Users/MADUP/Desktop/클로드 업무자동화1/project/active/thumbnail-factory"
mkdir -p assets engine tests output
cp "../../../content/ai-commerce-post/lever-white.png" assets/lever-white.png
```
Expected: `assets/lever-white.png` 존재.

- [ ] **Step 2: package.json 작성**

```json
{
  "name": "thumbnail-factory",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test tests/",
    "render": "node engine/render.js",
    "preview": "node engine/build_preview.js"
  },
  "dependencies": {
    "playwright": "^1.48.0"
  }
}
```

- [ ] **Step 3: .gitignore 작성**

```
node_modules/
.env
output/*.png
output/_preview.html
```

- [ ] **Step 4: .env.example 작성**

```
# Dropbox 개발자 앱에서 발급한 액세스 토큰
DROPBOX_TOKEN=
# 적재 폴더 (앱 폴더 기준 경로)
DROPBOX_FOLDER=/thumbnails
```

- [ ] **Step 5: 의존성 설치**

Run:
```bash
cd "C:/Users/MADUP/Desktop/클로드 업무자동화1/project/active/thumbnail-factory"
npm install
npx playwright install chromium
```
Expected: `node_modules/` 생성, chromium 다운로드 완료.

- [ ] **Step 6: Commit**

```bash
git add project/active/thumbnail-factory/package.json project/active/thumbnail-factory/.gitignore project/active/thumbnail-factory/.env.example project/active/thumbnail-factory/assets/lever-white.png
git commit -m "feat(thumbnail-factory): scaffold project (deps, logo, gitignore)"
```

---

## Task 2: template.html (파라미터화 프레임)

**Files:**
- Create: `project/active/thumbnail-factory/template.html`

원본 `content/ai-commerce-post/banner-template.html`의 스타일을 그대로 유지하되, 가변 영역 4곳을 플레이스홀더로 치환한다. (`<style>` 블록 전체는 원본과 동일 — 아래에 전문 포함.)

- [ ] **Step 1: template.html 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
  :root{
    --bg:#000; --surface:#16171C; --border:#2A2C33; --white:#ffffff;
    --sub:#9E9E9E; --blue:#005bf0; --blue-bright:#1b76f5; --purple:#6a4dff; --green:#00b37a;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{background:#000;}
  .banner{
    width:1600px;height:900px;position:relative;overflow:hidden;
    font-family:'Pretendard',sans-serif;
    background:
      radial-gradient(900px 620px at 88% 18%, rgba(106,77,255,.30) 0%, rgba(106,77,255,0) 60%),
      radial-gradient(1000px 700px at 6% 108%, rgba(0,91,240,.34) 0%, rgba(0,91,240,0) 58%),
      radial-gradient(700px 500px at 100% 100%, rgba(0,179,122,.12) 0%, rgba(0,179,122,0) 60%),
      #000;
    color:var(--white);
  }
  .banner::before{
    content:"";position:absolute;inset:0;
    background-image:radial-gradient(rgba(255,255,255,.10) 1.2px, transparent 1.2px);
    background-size:30px 30px;
    mask-image:linear-gradient(105deg,#000 0%,transparent 62%);
    -webkit-mask-image:linear-gradient(105deg,#000 0%,transparent 62%);
    opacity:.5;
  }
  .banner::after{
    content:"";position:absolute;left:0;right:0;top:0;height:5px;
    background:linear-gradient(90deg,var(--blue) 0%,var(--purple) 55%,var(--green) 100%);
  }
  .pad{position:absolute;inset:0;padding:88px 96px;display:flex;flex-direction:column;z-index:3;}
  .core{flex:1;display:flex;align-items:center;}
  .copy{max-width:880px;}
  h1{font-size:70px;font-weight:800;line-height:1.16;letter-spacing:-.02em;}
  h1 .grad{
    background:linear-gradient(92deg,#7d63ff 0%,#3f86ff 60%,#16d39a 120%);
    -webkit-background-clip:text;background-clip:text;color:transparent;
  }
  .sub{margin-top:26px;font-size:27px;font-weight:500;line-height:1.5;color:var(--sub);}
  .sub .pt{color:#cfd2da;font-weight:600;}
  .motif{position:absolute;right:-70px;top:50%;transform:translateY(-50%);width:760px;height:760px;z-index:2;}
  .ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(255,255,255,.10);}
  .ring.r2{inset:84px;border-color:rgba(255,255,255,.07);}
  .ring.r3{inset:176px;border-color:rgba(255,255,255,.05);}
  .glow{position:absolute;inset:150px;border-radius:50%;
    background:radial-gradient(circle at 50% 50%, rgba(106,77,255,.60), rgba(0,91,240,.28) 55%, transparent 72%);
    filter:blur(8px);}
  .chat{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
    background:linear-gradient(135deg,#6a4dff,#005bf0);color:#fff;font-size:42px;font-weight:800;letter-spacing:-.01em;
    padding:34px 44px;border-radius:32px 32px 32px 10px;box-shadow:0 30px 80px -20px rgba(63,99,255,.8);white-space:nowrap;}
  .chat .who{display:block;font-size:23px;font-weight:600;opacity:.82;margin-bottom:7px;}
  .spark{position:absolute;width:74px;height:74px;color:#fff;right:22px;top:16px;filter:drop-shadow(0 0 18px rgba(125,99,255,.95));}
  .pill{position:absolute;display:flex;align-items:center;gap:11px;background:rgba(22,23,28,.86);border:1px solid var(--border);
    border-radius:999px;padding:14px 24px;font-size:23px;font-weight:700;color:#fff;backdrop-filter:blur(4px);}
  .pill .dot{width:11px;height:11px;border-radius:50%;}
  .pill.p1{right:150px;top:120px;} .pill.p1 .dot{background:var(--green);}
  .pill.p2{left:20px;bottom:150px;} .pill.p2 .dot{background:var(--blue-bright);}
  .pill .mut{color:var(--sub);font-weight:600;}
  .foot{display:flex;align-items:center;}
  .logo-img{height:32px;width:auto;display:block;}
</style>
</head>
<body>
  <div class="banner">
    <div class="motif">{{MOTIF_HTML}}</div>
    <div class="pad">
      <div class="core">
        <div class="copy">
          <h1>{{TITLE_HTML}}</h1>
          <p class="sub">{{SUB_HTML}}</p>
        </div>
      </div>
      <div class="foot">
        <img class="logo-img" src="{{LOGO_SRC}}" alt="LEVER Xpert">
      </div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add project/active/thumbnail-factory/template.html
git commit -m "feat(thumbnail-factory): parameterized 1600x900 template frame"
```

---

## Task 3: render.js (HTML→PNG, TDD)

**Files:**
- Create: `project/active/thumbnail-factory/engine/render.js`
- Test: `project/active/thumbnail-factory/tests/render.test.js`

- [ ] **Step 1: 실패 테스트 작성** (`tests/render.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { renderThumbnail, buildHtml } = require('../engine/render.js');

function pngSize(buf) {
  // PNG IHDR: width @ byte 16, height @ byte 20 (big-endian uint32)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('buildHtml injects all placeholders', () => {
  const html = buildHtml({
    title_html: 'AAA <span class="grad">BBB</span>',
    sub_html: 'CCC',
    motif_html: '<div class="ring"></div>',
  });
  assert.match(html, /AAA/);
  assert.match(html, /class="grad">BBB/);
  assert.match(html, /CCC/);
  assert.match(html, /<div class="ring">/);
  assert.doesNotMatch(html, /\{\{/); // no leftover placeholders
});

test('renderThumbnail produces 1600x900 PNG', async () => {
  const out = path.join(os.tmpdir(), 'tf_render_test.png');
  if (fs.existsSync(out)) fs.unlinkSync(out);
  await renderThumbnail({
    title_html: '검색에서 <span class="grad">대화</span>로',
    sub_html: '테스트 서브 문구',
    motif_html: '<div class="ring"></div><div class="ring r2"></div>',
    outPath: out,
  });
  assert.ok(fs.existsSync(out), 'PNG should exist');
  const { width, height } = pngSize(fs.readFileSync(out));
  assert.strictEqual(width, 1600);
  assert.strictEqual(height, 900);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd project/active/thumbnail-factory && node --test tests/render.test.js`
Expected: FAIL — `Cannot find module '../engine/render.js'`

- [ ] **Step 3: render.js 구현**

```js
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
      results.push({ id: job.id, outPath: job.outPath, ok: true });
      console.log(`OK ${job.outPath}`);
    } catch (e) {
      results.push({ id: job.id, outPath: job.outPath, ok: false, error: e.message });
      console.error(`ERR ${job.outPath}: ${e.message}`);
    }
  }
  const resultPath = path.join(ROOT, 'output', 'render_results.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
}

if (require.main === module) main();
module.exports = { renderThumbnail, buildHtml };
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd project/active/thumbnail-factory && node --test tests/render.test.js`
Expected: PASS (2 tests). (chromium 미설치 시 Task 1 Step 5 먼저.)

- [ ] **Step 5: Commit**

```bash
git add project/active/thumbnail-factory/engine/render.js project/active/thumbnail-factory/tests/render.test.js
git commit -m "feat(thumbnail-factory): HTML->PNG renderer with tests"
```

---

## Task 4: build_preview.js (검수 갤러리, TDD)

**Files:**
- Create: `project/active/thumbnail-factory/engine/build_preview.js`
- Test: `project/active/thumbnail-factory/tests/build_preview.test.js`

- [ ] **Step 1: 실패 테스트 작성** (`tests/build_preview.test.js`)

```js
const test = require('node:test');
const assert = require('node:assert');
const { buildPreview } = require('../engine/build_preview.js');

test('buildPreview renders one figure per item with original link', () => {
  const html = buildPreview([
    { png: 'a.png', title: 'T1' },
    { png: 'b.png', title: 'T2' },
  ]);
  assert.strictEqual((html.match(/<figure>/g) || []).length, 2);
  assert.match(html, /href="a\.png"/);
  assert.match(html, /href="b\.png"/);
  assert.match(html, /총 2건/);
});

test('buildPreview escapes HTML in titles', () => {
  const html = buildPreview([{ png: 'x.png', title: '<script>bad' }]);
  assert.doesNotMatch(html, /<script>bad/);
  assert.match(html, /&lt;script&gt;bad/);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd project/active/thumbnail-factory && node --test tests/build_preview.test.js`
Expected: FAIL — `Cannot find module '../engine/build_preview.js'`

- [ ] **Step 3: build_preview.js 구현**

```js
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
  // output/render_results.json 을 읽어 미리보기 생성
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd project/active/thumbnail-factory && node --test tests/build_preview.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add project/active/thumbnail-factory/engine/build_preview.js project/active/thumbnail-factory/tests/build_preview.test.js
git commit -m "feat(thumbnail-factory): review gallery (_preview.html) with tests"
```

---

## Task 5: Dropbox 앱 셋업 + upload_dropbox.js

**Files:**
- Create: `project/active/thumbnail-factory/engine/upload_dropbox.js`
- Modify(사용자): `project/active/thumbnail-factory/.env` (gitignore됨)

- [ ] **Step 1: (사용자 수동) Dropbox 앱 생성 + 토큰 발급**

안내(브라우저):
1. https://www.dropbox.com/developers/apps → **Create app**
2. **Scoped access** 선택 → **App folder**(권장, 앱 전용 폴더만 접근) → 앱 이름 입력 (예: `lever-thumbnail-factory`)
3. 생성된 앱의 **Permissions** 탭 → `files.content.write`, `files.content.read`, `sharing.write` 체크 → **Submit**
4. **Settings** 탭 → **Generated access token** → **Generate** → 토큰 복사
5. (참고) 이 토큰은 단기(4시간) 만료. Phase 1 검증엔 충분. Phase 2에서 refresh token으로 교체 예정.

- [ ] **Step 2: .env 작성** (사용자)

`project/active/thumbnail-factory/.env`:
```
DROPBOX_TOKEN=sl.xxxxx_복사한_토큰
DROPBOX_FOLDER=/thumbnails
```

- [ ] **Step 3: upload_dropbox.js 구현**

```js
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DROPBOX_TOKEN;

function directLink(url) {
  // 미리보기(dl=0) → 직접 다운로드(dl=1)
  return url.replace('?dl=0', '?dl=1');
}

async function uploadAndShare(localPath, dropboxPath) {
  if (!TOKEN) throw new Error('DROPBOX_TOKEN not set (check .env)');
  const content = fs.readFileSync(localPath);

  const up = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  });
  if (!up.ok) throw new Error(`upload failed ${up.status}: ${await up.text()}`);

  const sh = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dropboxPath }),
  });
  if (sh.ok) {
    const j = await sh.json();
    return directLink(j.url);
  }

  // 이미 링크가 존재하면 409 → 기존 링크 조회
  const ls = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dropboxPath, direct_only: true }),
  });
  const lj = await ls.json();
  if (lj.links && lj.links[0]) return directLink(lj.links[0].url);
  throw new Error(`could not create/find shared link: ${await sh.text()}`);
}

async function main() {
  const [localPath, dropboxPath] = process.argv.slice(2);
  if (!localPath || !dropboxPath) {
    console.error('usage: node upload_dropbox.js <local.png> </dropbox/path.png>');
    process.exit(1);
  }
  const link = await uploadAndShare(localPath, dropboxPath);
  console.log(link);
}

if (require.main === module) main();
module.exports = { uploadAndShare, directLink };
```

- [ ] **Step 4: 통합 검증 (실제 토큰 필요)**

Run:
```bash
cd "C:/Users/MADUP/Desktop/클로드 업무자동화1/project/active/thumbnail-factory"
node -e "require('dotenv')?.config?.()" 2>/dev/null; \
DROPBOX_TOKEN=$(grep ^DROPBOX_TOKEN .env | cut -d= -f2) \
node engine/upload_dropbox.js output/tf_render_test.png /thumbnails/_smoketest.png
```
Expected: `https://www.dropbox.com/...?dl=1` 출력. Dropbox 앱 폴더에 파일 확인.
참고: `.env` 자동 로드는 커맨드(thumbnail.md)에서 처리. 여기선 셸 변수로 주입해 검증.

- [ ] **Step 5: Commit**

```bash
git add project/active/thumbnail-factory/engine/upload_dropbox.js
git commit -m "feat(thumbnail-factory): Dropbox upload + shared link"
```

---

## Task 6: Google Sheet 생성 (MCP)

**Tooling:** Google Sheets MCP (`mcp__google-sheets__*`).

- [ ] **Step 1: 스프레드시트 생성**

`mcp__google-sheets__create_spreadsheet` 호출, title=`썸네일 팩토리 입력`.
반환된 `spreadsheetId` 기록.

- [ ] **Step 2: 헤더 행 작성**

`mcp__google-sheets__update_cells` (sheet=Sheet1, range=`A1:G1`):
```
[["메인 타이틀","서브 문구","비주얼 느낌","강조 단어","참고 이미지 URL","상태","결과 이미지 링크"]]
```

- [ ] **Step 3: 샘플 행 2개 입력** (검증용, range=`A2:E3`)

```
[
 ["검색에서 대화로, AI가 추천하는 브랜드의 시대","아모레·롯데·CJ는 왜 챗GPT 안으로 들어갔을까 — 에이전틱 커머스가 바꾸는 마케팅의 무대","우측에 동심원 링 + 파란 말풍선 '이거 추천해줘', AI 추천 받는 느낌. pill: 'AI 추천','대화형 커머스'","대화",""],
 ["오픈AI X 크리테오, ChatGPT 광고 시대와 AI 커머스","생성형 AI와 애드테크의 전략적 만남 — 소비자의 구매 여정이 어떻게 바뀌는가","우측에 ChatGPT 대화 UI 목업 + 스폰서 광고 카드. pill: 'ChatGPT 광고','오픈AI X 크리테오'","ChatGPT 광고 시대",""]
]
```

- [ ] **Step 4: 공유 + 링크 기록**

`mcp__google-sheets__share_spreadsheet` 로 팀 도메인/사용자 편집 권한 부여.
`spreadsheetId`를 `thumbnail-factory-context.md`에 기록.

- [ ] **Step 5: (코드 변경 없음, 커밋 불필요)** — context.md 업데이트만.

---

## Task 7: generate.md (우측 비주얼 생성 가드레일)

**Files:**
- Create: `project/active/thumbnail-factory/engine/generate.md`

Claude가 `/thumbnail` 실행 시 읽고 따르는 규칙. 포맷 일관성을 위한 제약을 명시한다.

- [ ] **Step 1: generate.md 작성**

````markdown
# 우측 비주얼 생성 규칙 (motif HTML/SVG)

입력: 행의 `비주얼 느낌`(C), `참고 이미지 URL`(E, 선택).
출력: `template.html`의 `.motif`(760×760, 우측, `right:-70px`) 안에 들어갈 **HTML/SVG 조각만**. `<div class="motif">`는 쓰지 말 것 (이미 존재).

## 고정 규칙 (포맷 일관성)
- 컬러는 CSS 변수만 사용: `--purple #6a4dff`, `--blue #005bf0`, `--blue-bright #1b76f5`, `--green #00b37a`, `--surface #16171C`, `--border #2A2C33`.
- 배경 장식은 동심원 링 3개(`.ring .r2 .r3`) + 중앙 글로우(`.glow`)를 **기본 베이스로 항상 포함**해 톤을 통일.
- 개념 라벨은 **pill 2개**(`.pill.p1`, `.pill.p2`)로. p1=우상단(녹색 dot), p2=좌하단(파란 dot). 라벨 텍스트는 주제에서 도출.
- 중앙 주인공 요소 1개(말풍선/카드/목업 등)만. 요소 3개 이상 금지(잡해짐).
- 폰트는 상속(Pretendard). 인라인 폰트 지정 금지.
- 한글 텍스트는 반드시 실제 텍스트 노드로(이미지로 굽지 말 것).

## 참고 이미지가 있을 때
- URL 내용을 해석해 같은 톤의 **HTML/SVG 목업으로 재현**(직접 임베드 X — 스타일 안 맞음). 예: ChatGPT 광고 스크린샷 → 다크 채팅 UI + 스폰서 카드를 코드로 재현.

## 예시 (v1: 대화형 커머스)
```html
<div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div>
<div class="glow"></div>
<div class="pill p1"><span class="dot"></span>AI 추천</div>
<div class="pill p2"><span class="dot"></span>대화형 커머스</div>
<div class="chat"><span class="who">소비자</span>“이거 추천해줘”
  <svg class="spark" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/></svg>
</div>
```

## 타이틀/강조/서브 처리
- `메인 타이틀`(A): `<h1>` 안에 들어감. `강조 단어`(D)에 해당하는 부분을 `<span class="grad">…</span>`로 감싼다. D가 비면 핵심 키워드 1개를 직접 선택.
- 줄바꿈은 `<br>`로. 2줄 권장.
- `서브 문구`(B): `.sub` 안에. 앞부분 강조는 `<span class="pt">…</span>`.
````

- [ ] **Step 2: Commit**

```bash
git add project/active/thumbnail-factory/engine/generate.md
git commit -m "docs(thumbnail-factory): visual generation guardrails"
```

---

## Task 8: /thumbnail 커맨드 (오케스트레이션)

**Files:**
- Create: `.claude/commands/thumbnail.md`

Claude가 실행하는 절차서. 코드 단위들을 엮는다.

- [ ] **Step 1: thumbnail.md 작성**

````markdown
---
description: 썸네일 팩토리 — 시트의 대기 행을 읽어 썸네일 생성·검수·Dropbox 적재
---

# /thumbnail

프로젝트: `project/active/thumbnail-factory/`. 인자(`$ARGUMENTS`)로 spreadsheetId를 받을 수 있고, 없으면 `thumbnail-factory-context.md`의 ID를 사용한다.

## 절차

1. **컨텍스트 로드**: `project/active/thumbnail-factory/thumbnail-factory-context.md`에서 `spreadsheetId`, `DROPBOX_FOLDER` 확인. `engine/generate.md` 규칙을 읽는다.

2. **대기 행 읽기**: `mcp__google-sheets__get_sheet_data`로 A:G 전체를 읽어, **F(상태)가 빈** 행만 대상으로 한다. 각 행의 행번호를 기억(writeback용).

3. **행마다 생성** (generate.md 규칙 준수):
   - `강조 단어`(D)로 `title_html` 구성(`<span class="grad">`), 없으면 자동 선택.
   - `서브 문구`(B) → `sub_html`.
   - `비주얼 느낌`(C) + `참고 이미지 URL`(E) → `motif_html` 생성.
   - 각 행을 `{ id: "<행번호>", title: "<A 원문>", title_html, sub_html, motif_html, outPath: "output/row<행번호>.png" }`로 누적.

4. **jobs.json 기록**: 누적 배열을 `project/active/thumbnail-factory/output/jobs.json`에 쓴다.

5. **렌더**: `node engine/render.js output/jobs.json` 실행. (`output/render_results.json` 생성됨. 각 result에 `title`을 jobs에서 매핑해 넣으려면 render.js가 job 전체를 보존 — 현재는 id/outPath만. 미리보기 제목은 jobs.json과 results를 id로 조인해 보강한다.)

6. **검수 갤러리**: results(ok=true)와 jobs를 id로 조인해 `{png, title}` 목록 구성 → `node -e`로 `build_preview.writePreview(items)` 호출하거나, render_results.json에 title을 채운 뒤 `node engine/build_preview.js` 실행. `output/_preview.html` 생성.

7. **미리보기 열기 + 검수 요청**: `_preview.html`을 브라우저로 열고(Playwright MCP 또는 OS open), 사용자에게 "어느 행을 적재할까요? (전체/일부/없음)" 확인받는다. **검수 통과 전 업로드 금지.**

8. **승인분 업로드**: 승인된 행마다
   - `node engine/upload_dropbox.js output/row<N>.png <DROPBOX_FOLDER>/<슬러그>.png` 실행(.env 토큰 로드 필요 — 실행 전 `set -a; source .env; set +a` 또는 셸 변수 주입).
   - 반환 링크를 수집.

9. **시트 writeback**: 승인 행은 `mcp__google-sheets__update_cells`로 F='✅ 완료', G=<링크>. 미승인/실패 행은 F='⚠️ <사유>'.

10. **요약 보고**: 처리/성공/실패 건수 + _preview.html 경로 + 시트 링크.

## 주의
- 멱등성: F가 채워진 행은 재실행 시 건너뜀.
- 행 단위 격리: 한 행 실패가 전체를 막지 않는다.
- Dropbox 토큰 만료(4h) 시 Task 5 안내로 재발급.
````

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/thumbnail.md
git commit -m "feat(thumbnail-factory): /thumbnail orchestration command"
```

---

## Task 9: End-to-End 검증 (샘플 2행)

**목표:** Task 6의 샘플 2행으로 v1·v2 동급 품질 확인.

- [ ] **Step 1: `/thumbnail` 실행** (또는 절차 수동 수행)

Expected: `output/row2.png`, `output/row3.png` 생성(1600×900), `output/_preview.html` 생성.

- [ ] **Step 2: 미리보기 비교 검수**

`_preview.html`을 열어 원본 `ad_v2.png`(v2), `content/ai-commerce-post/banner_search-to-chat.png`(v1)와 톤·레이아웃 비교.
기준: 배경/도트/액센트/로고 위치 동일, 한글 정확, pill 2개, 중앙 요소 1개, 포맷 일관.
미달 시 generate.md 규칙 보강 후 재렌더.

- [ ] **Step 3: 승인분 Dropbox 적재 + writeback 확인**

Expected: Dropbox 앱 폴더에 PNG 2개, 시트 F열 '✅ 완료', G열 링크.

- [ ] **Step 4: 멱등성 확인**

`/thumbnail` 재실행 → "대기 행 없음" 보고(이미 완료된 2행 스킵). 새 행 1개 추가 후 재실행 → 그 행만 처리.

- [ ] **Step 5: context/tasks 문서 갱신 + Commit**

`thumbnail-factory-context.md`(Last Updated, spreadsheetId, Dropbox 폴더), `thumbnail-factory-tasks.md`(완료 체크) 갱신.
```bash
git add project/active/thumbnail-factory/thumbnail-factory-context.md project/active/thumbnail-factory/thumbnail-factory-tasks.md
git commit -m "docs(thumbnail-factory): Phase 1 verified, update project docs"
```

---

## Self-Review (작성자 점검)

**Spec coverage:**
- 시트 7컬럼 → Task 6 ✓ / 하이브리드 생성 → Task 7+8 ✓ / 렌더 → Task 3 ✓ / 검수 갤러리 → Task 4 ✓ / Dropbox → Task 5 ✓ / writeback → Task 8 ✓ / 멱등성·에러격리 → Task 8·9 ✓ / 파일구조 → 전 Task ✓.
- 강조 단어(D)·참고 URL(E) 처리 → Task 7 generate.md + Task 8 절차 ✓.

**Placeholder scan:** 코드 단계는 전부 실제 코드 포함. TODO/TBD 없음.

**Type consistency:** `renderThumbnail({title_html, sub_html, motif_html, outPath})` / `buildHtml({title_html, sub_html, motif_html})` / `buildPreview(items:[{png,title}])` / `writePreview(items)` / `uploadAndShare(localPath, dropboxPath)` — Task 3·4·5·8 전반에서 동일 시그니처 사용. jobs.json 객체 키(`id,title,title_html,sub_html,motif_html,outPath`)는 Task 8에서 정의하고 render.js가 소비.

**알려진 보강 포인트(실행 중 처리):** render_results.json에 `title` 미포함 → Task 8 Step 6에서 jobs.json과 id 조인으로 보강(미리보기 제목용). 이는 절차서에 명시됨.
