/**
 * 썸네일 팩토리 — 시트 트리거
 * 설치: 확장 프로그램 > Apps Script 에 이 코드 전체를 붙여넣고 저장 → 시트 새로고침.
 *
 * 컬럼: F=생성요청(체크박스), G=상태(드롭다운), H=미리보기링크, I=결과이미지링크, J=승인(체크박스)
 * 동작:
 *   - 첫 생성: F열(생성요청) 체크 → G(상태)='요청됨' + 승인 해제 → 워처가 생성.
 *   - 재생성: G(상태) 드롭다운에서 '🔄 재요청' 선택(문구 수정 후) → 승인 해제 → 워처가 다시 생성.
 *   - 메뉴(썸네일 > 생성요청/재요청)로 여러 행 일괄도 가능.
 */

var COL = { REQUEST: 6, STATUS: 7, PREVIEW: 8, RESULT: 9, APPROVE: 10 }; // F,G,H,I,J

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('썸네일')
    .addItem('선택 행 생성요청', '생성요청')
    .addItem('선택 행 재요청(다시 만들기)', '재요청')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;
  var r = e.range;
  var row = r.getRow();
  if (row < 6) return; // 데이터는 6행부터
  var sh = r.getSheet();
  var col = r.getColumn();

  // 1) 생성요청(F) 체크 → 상태='요청됨', 승인 해제, 체크 해제
  if (col === COL.REQUEST && (e.value === 'TRUE' || e.value === true)) {
    sh.getRange(row, COL.STATUS).setValue('📝 요청됨');
    sh.getRange(row, COL.APPROVE).setValue(false);
    r.setValue(false);
    return;
  }

  // 2) 상태(G) 드롭다운을 재요청/요청됨으로 → 승인 해제(반드시 재검수 후 적재)
  if (col === COL.STATUS) {
    var v = String(e.value || '');
    if (v.indexOf('재요청') !== -1 || v.indexOf('요청됨') !== -1) {
      sh.getRange(row, COL.APPROVE).setValue(false);
    }
  }
}

// 선택 행들의 상태(G)를 '요청됨'으로 (첫 생성 일괄)
function 생성요청() {
  setStatusForSelection_('📝 요청됨', false);
}

// 선택 행들 다시 만들기: 상태='재요청', 승인(J) 해제
function 재요청() {
  setStatusForSelection_('🔄 재요청', true);
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
