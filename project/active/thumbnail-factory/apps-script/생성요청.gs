/**
 * 썸네일 팩토리 — 시트 트리거
 * 설치: 확장 프로그램 > Apps Script 에 이 코드 전체를 붙여넣고 저장 → 시트 새로고침.
 *
 * 컬럼: F=생성요청(체크박스), G=상태, H=미리보기링크, I=결과이미지링크, J=승인(체크박스)
 * 동작:
 *   - F열(생성요청) 체크 → onEdit 가 G열(상태)을 '요청됨'으로 바꾸고 F 체크 해제 → 워처가 생성.
 *   - 메뉴(썸네일 > 선택 행 생성요청/재요청)로도 가능.
 */

var COL = { REQUEST: 6, STATUS: 7, PREVIEW: 8, RESULT: 9, APPROVE: 10 }; // F,G,H,I,J

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('썸네일')
    .addItem('선택 행 생성요청', '생성요청')
    .addItem('선택 행 재요청(다시 만들기)', '재요청')
    .addToUi();
}

// F열(생성요청) 체크 시 자동 실행 → G(상태)='요청됨', F 체크 해제
function onEdit(e) {
  if (!e || !e.range) return;
  var r = e.range;
  if (r.getColumn() !== COL.REQUEST || r.getRow() < 6) return; // 데이터는 6행부터
  if (e.value !== 'TRUE' && e.value !== true) return; // 체크될 때만
  var sh = r.getSheet();
  var row = r.getRow();
  sh.getRange(row, COL.STATUS).setValue('요청됨'); // G
  r.setValue(false); // 생성요청 체크 해제(접수됨)
}

// 선택 행들의 F열(상태)을 '요청됨'으로
function 생성요청() {
  setStatusForSelection_('요청됨', false);
}

// 완료된 행 다시 만들기: F='재요청', H(승인) 해제
function 재요청() {
  setStatusForSelection_('재요청', true);
}

function setStatusForSelection_(status, clearApprove) {
  var sh = SpreadsheetApp.getActiveSheet();
  var rng = sh.getActiveRange();
  var start = rng.getRow();
  var n = rng.getNumRows();
  var count = 0;
  for (var i = 0; i < n; i++) {
    var row = start + i;
    if (row < 6) continue; // 데이터는 6행부터
    sh.getRange(row, COL.STATUS).setValue(status); // G
    if (clearApprove) sh.getRange(row, COL.APPROVE).setValue(false); // J 승인 해제
    count++;
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(count + '개 행: ' + status, '썸네일', 4);
}
