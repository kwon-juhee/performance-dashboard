/**
 * 썸네일 팩토리 — 시트 버튼/메뉴
 * 설치: 확장 프로그램 > Apps Script 에 이 코드를 붙여넣고 저장.
 *  - onOpen 이 '썸네일' 메뉴를 만든다.
 *  - 그림/버튼에 '생성요청' 함수를 연결해도 됨.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('썸네일')
    .addItem('선택 행 생성요청', '생성요청')
    .addToUi();
}

// 선택한 행들의 F열(상태)을 '요청됨'으로 표시 → 로컬 워처가 우선 처리.
function 생성요청() {
  const sh = SpreadsheetApp.getActiveSheet();
  const rng = sh.getActiveRange();
  const start = rng.getRow();
  const n = rng.getNumRows();
  let count = 0;
  for (let i = 0; i < n; i++) {
    const row = start + i;
    if (row < 2) continue; // 헤더 보호
    sh.getRange(row, 6).setValue('요청됨'); // F열 = 6
    count++;
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(count + '개 행을 생성요청으로 표시했습니다.', '썸네일', 4);
}

// (선택) 완료된 행을 다시 만들고 싶을 때: 선택 행 F열을 '재요청'으로.
function 재요청() {
  const sh = SpreadsheetApp.getActiveSheet();
  const rng = sh.getActiveRange();
  const start = rng.getRow();
  const n = rng.getNumRows();
  let count = 0;
  for (let i = 0; i < n; i++) {
    const row = start + i;
    if (row < 2) continue;
    sh.getRange(row, 6).setValue('재요청');
    sh.getRange(row, 8).setValue(false); // H열 승인 해제
    count++;
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(count + '개 행을 재요청으로 표시했습니다.', '썸네일', 4);
}
