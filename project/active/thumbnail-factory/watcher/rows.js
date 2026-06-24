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

// 상태 앞 이모지/기호(✅ 🔍 ⏳ ⚠️ 등)를 떼고 핵심 단어만 비교
function normalizeStatus(s) {
  return String(s || '').replace(/^[^가-힣A-Za-z]+/, '').trim();
}

// row = [A..J]: A0 B1 C2 D3 E4 생성요청5 상태6 미리보기7 결과링크8 승인9
function classifyRow(row) {
  const status = normalizeStatus(row[6]);
  const a = String(row[0] || '').trim();
  const b = String(row[1] || '').trim();
  const c = String(row[2] || '').trim();
  if ((status === '요청됨' || status === '재요청') && a && b && c) return 'generate';
  if (status === '검수대기' && truthy(row[9])) return 'upload';
  return 'skip';
}

module.exports = { slug, classifyRow, truthy, normalizeStatus };
