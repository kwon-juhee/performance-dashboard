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
  return `다음 규칙에 따라 썸네일 1건의 HTML 조각을 생성하라.

=== 규칙 ===
${rules}

=== 입력 ===
메인 타이틀(A): ${row[0]}
서브 문구(B): ${row[1]}
비주얼 느낌(C): ${row[2]}
강조 단어(D): ${row[3] || '(자동 선택)'}
참고 이미지 URL(E): ${row[4] || '(없음)'}

=== 출력 형식 ===
오직 아래 JSON 하나만 출력(설명·코드펜스 없이):
{"title_html":"...","sub_html":"...","motif_html":"..."}`;
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
