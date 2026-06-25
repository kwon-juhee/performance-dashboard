const fs = require('fs');

function directLink(url) {
  // 미리보기(dl=0) → 직접 다운로드(dl=1). 신·구 링크 형식(?dl=0 / &dl=0) 모두 대응.
  return url.replace(/dl=0/, 'dl=1');
}

function tokenCacheFrom(json, now) {
  // 만료 5분 전 갱신되도록 skew 적용
  return { token: json.access_token, exp: now + (json.expires_in - 300) * 1000 };
}

// Dropbox-API-Arg 는 HTTP 헤더라 ASCII만 허용 → 비ASCII(한글 등)를 \uXXXX 로 이스케이프
function httpHeaderSafeJson(obj) {
  return JSON.stringify(obj)
    .split('')
    .map(c => (c.charCodeAt(0) > 127 ? '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0') : c))
    .join('');
}

let _cache = { token: null, exp: 0 };
async function getAccessToken(now = Date.now()) {
  if (!process.env.DROPBOX_REFRESH_TOKEN) {
    if (process.env.DROPBOX_TOKEN) return process.env.DROPBOX_TOKEN; // Phase 1 4h 폴백
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
      'Dropbox-API-Arg': httpHeaderSafeJson({ path: dropboxPath, mode: 'overwrite', mute: true }),
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
  // 이미 링크가 존재(409) → 기존 링크 조회
  const ls = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dropboxPath, direct_only: true }),
  });
  const lj = await ls.json();
  if (lj.links && lj.links[0]) return directLink(lj.links[0].url);
  throw new Error(`could not create/find shared link: ${await sh.text()}`);
}

async function deleteFile(dropboxPath, token) {
  await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dropboxPath }),
  });
}

async function moveFile(fromPath, toPath, token) {
  let r = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_path: fromPath, to_path: toPath, autorename: false }),
  });
  if (r.status === 409) {
    // 최종 경로에 같은 파일 존재 → 덮어쓰기(기존 삭제 후 재이동)
    await deleteFile(toPath, token);
    r = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_path: fromPath, to_path: toPath, autorename: false }),
    });
  }
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
  if (!localPath || !dropboxPath) {
    console.error('usage: node upload_dropbox.js <local.png> </dropbox/path.png>');
    process.exit(1);
  }
  console.log(await uploadAndShare(localPath, dropboxPath));
}
if (require.main === module) main();
module.exports = { directLink, tokenCacheFrom, httpHeaderSafeJson, getAccessToken, uploadFile, createSharedLink, moveFile, deleteFile, uploadAndShare };
