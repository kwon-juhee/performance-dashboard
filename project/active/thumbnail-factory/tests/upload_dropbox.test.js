const test = require('node:test');
const assert = require('node:assert');
const { directLink, tokenCacheFrom, httpHeaderSafeJson } = require('../engine/upload_dropbox.js');

test('directLink converts dl=0 to dl=1 (both URL forms)', () => {
  assert.match(directLink('https://x/y?rlkey=a&dl=0'), /dl=1/);
  assert.match(directLink('https://x/y?dl=0'), /dl=1/);
});

test('tokenCacheFrom computes token + expiry with 5min skew', () => {
  const c = tokenCacheFrom({ access_token: 'AT', expires_in: 14400 }, 1_000_000);
  assert.strictEqual(c.token, 'AT');
  assert.strictEqual(c.exp, 1_000_000 + (14400 - 300) * 1000);
});

test('httpHeaderSafeJson escapes non-ASCII to \\uXXXX and round-trips', () => {
  const korean = '/한글.png'; // /한글.png
  const s = httpHeaderSafeJson({ path: korean });
  assert.ok([...s].every(c => c.charCodeAt(0) <= 127), 'output is pure ASCII');
  assert.match(s, /\\ud55c/); // 한 = U+D55C
  assert.strictEqual(JSON.parse(s).path, korean); // round-trips back to Korean
});
