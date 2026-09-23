/**
 * Dropbox refresh token 1회 발급 헬퍼.
 * 사용법:
 *   node watcher/get_dropbox_refresh_token.js <APP_KEY> <APP_SECRET>
 * 절차:
 *   1) 출력된 URL을 브라우저에서 열고 동의 → 인증 코드 복사
 *   2) 터미널에 코드 붙여넣고 Enter
 *   3) 출력된 refresh_token 을 watcher/.env 의 DROPBOX_REFRESH_TOKEN 에 저장
 *      (DROPBOX_APP_KEY / DROPBOX_APP_SECRET 도 함께 채울 것)
 */
const readline = require('readline');

const [appKey, appSecret] = process.argv.slice(2);
if (!appKey || !appSecret) {
  console.error('usage: node watcher/get_dropbox_refresh_token.js <APP_KEY> <APP_SECRET>');
  process.exit(1);
}

const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&token_access_type=offline`;
console.log('\n1) 아래 URL을 브라우저에서 열고 "허용" 후 표시되는 코드를 복사하세요:\n');
console.log('   ' + authUrl + '\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('2) 인증 코드 붙여넣기: ', async (code) => {
  rl.close();
  const body = new URLSearchParams({
    code: code.trim(),
    grant_type: 'authorization_code',
    client_id: appKey,
    client_secret: appSecret,
  });
  const r = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!r.ok) { console.error('FAIL:', r.status, await r.text()); process.exit(1); }
  const j = await r.json();
  console.log('\n=== watcher/.env 에 아래를 채우세요 ===');
  console.log('DROPBOX_APP_KEY=' + appKey);
  console.log('DROPBOX_APP_SECRET=' + appSecret);
  console.log('DROPBOX_REFRESH_TOKEN=' + j.refresh_token);
  console.log('\n(refresh_token 은 만료되지 않으니 워처가 무인으로 4h 액세스 토큰을 자동 갱신합니다.)');
});
