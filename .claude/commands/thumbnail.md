---
description: 썸네일 팩토리 — 시트의 대기 행을 읽어 썸네일 생성·검수·Dropbox 적재
---

# /thumbnail

프로젝트: `project/active/thumbnail-factory/`. 인자(`$ARGUMENTS`)로 spreadsheetId를 받을 수 있고, 없으면 `thumbnail-factory-context.md`의 ID를 사용한다.

## 절차

1. **컨텍스트 로드**: `project/active/thumbnail-factory/thumbnail-factory-context.md`에서 `spreadsheetId`, `DROPBOX_FOLDER` 확인. `engine/generate.md` 규칙을 읽는다.

2. **대기 행 읽기**: `mcp__google-sheets__get_sheet_data`로 A:G 전체를 읽어, **F(상태)가 빈** 행만 대상으로 한다. 각 행의 시트 행번호를 기억(writeback용). 대기 행이 없으면 그 사실을 보고하고 종료.

3. **행마다 생성** (generate.md 규칙 준수):
   - `강조 단어`(D)로 `title_html` 구성(`<span class="grad">`), 없으면 핵심 키워드 1개 자동 선택. 긴 제목은 한 줄 길이 가드레일대로 `<br>`로 끊는다.
   - `서브 문구`(B) → `sub_html` (앞부분 강조는 `<span class="pt">`).
   - `비주얼 느낌`(C) + `참고 이미지 URL`(E) → `motif_html` 생성.
   - 각 행을 `{ id: "<행번호>", title: "<A 원문>", title_html, sub_html, motif_html, outPath: "output/row<행번호>.png" }`로 누적.

4. **jobs.json 기록**: 누적 배열을 `project/active/thumbnail-factory/output/jobs.json`에 쓴다.

5. **렌더**: 프로젝트 디렉토리에서 `node engine/render.js output/jobs.json` 실행. `output/render_results.json` 생성됨(id·title·ok 포함).

6. **검수 갤러리**: `node engine/build_preview.js` 실행 → `output/_preview.html` 생성.

7. **미리보기 열기 + 검수 요청**: `_preview.html`을 사용자에게 보여주고(Read로 PNG 확인 또는 브라우저 open), "어느 행을 적재할까요? (전체/일부/없음)" 확인받는다. **검수 통과 전 업로드 금지.**

8. **승인분 업로드**: `.env`를 로드(`set -a; . ./.env; set +a`)한 뒤, 승인된 행마다
   `MSYS_NO_PATHCONV=1 node engine/upload_dropbox.js output/row<N>.png <DROPBOX_FOLDER>/<슬러그>.png`
   실행(슬러그 = A 타이틀 기반 영문/숫자 파일명). **Windows Git Bash는 `MSYS_NO_PATHCONV=1` 필수** — 없으면 `/thumbnails/...` 경로가 Windows 경로로 변환돼 업로드 실패. 반환 링크를 수집.

9. **시트 writeback**: 승인 행은 `mcp__google-sheets__update_cells`로 F='✅ 완료', G=<링크>. 미승인은 그대로(다음 실행 때 재처리), 실패 행은 F='⚠️ <사유>'.

10. **요약 보고**: 처리/성공/실패 건수 + `_preview.html` 경로 + 시트 링크.

## 주의
- 멱등성: F가 채워진 행은 재실행 시 건너뜀.
- 행 단위 격리: 한 행 실패가 전체를 막지 않는다.
- Dropbox 토큰 만료(4h) 시 `thumbnail-factory-plan.md` Task 5 안내로 재발급.
