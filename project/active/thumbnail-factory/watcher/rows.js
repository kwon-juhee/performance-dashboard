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
  if ((status === '요청됨' || status === '재요청') && a && b && c) return 'generate';
  if (status === '검수대기' && truthy(row[7])) return 'upload';
  return 'skip';
}

module.exports = { slug, classifyRow, truthy };
