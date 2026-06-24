const fs = require('fs');

const TOKEN = process.env.DROPBOX_TOKEN;

function directLink(url) {
  // 미리보기(dl=0) → 직접 다운로드(dl=1). 신·구 링크 형식(?dl=0 / &dl=0) 모두 대응.
  return url.replace(/dl=0/, 'dl=1');
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
