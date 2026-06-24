const fs = require('fs');
const { google } = require('googleapis');

const TOKEN_PATH = process.env.GOOGLE_OAUTH_TOKEN
  || `${process.env.USERPROFILE || process.env.HOME}/.claude/google-oauth-token.json`;
const ID = process.env.SPREADSHEET_ID;
const SHEET = process.env.SHEET_NAME || '시트1';
const Q = `'${SHEET.replace(/'/g, "''")}'`; // 비ASCII 시트명은 작은따옴표 필요
const DATA_START = parseInt(process.env.DATA_START_ROW || '2', 10); // 헤더/안내 블록 아래 첫 데이터 행

function client() {
  const tok = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(tok.client_id, tok.client_secret);
  auth.setCredentials({ refresh_token: tok.refresh_token });
  return google.sheets({ version: 'v4', auth });
}

async function getRows() {
  const sheets = client();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ID, range: `${Q}!A${DATA_START}:J`, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return (res.data.values || []).map((values, i) => ({ rowNum: i + DATA_START, values }));
}

async function setCell(rowNum, colLetter, value) {
  const sheets = client();
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: `${Q}!${colLetter}${rowNum}`,
    valueInputOption: 'USER_ENTERED', requestBody: { values: [[value]] },
  });
}

const setStatus = (rowNum, status) => setCell(rowNum, 'G', status); // 상태 = G열

module.exports = { getRows, setCell, setStatus };
