---
description: 썸네일 팩토리 — 시트 요청 행을 생성·검수대기·승인적재 (Claude Code가 직접 처리, 무료)
---

# /thumbnail

프로젝트: `project/active/thumbnail-factory/`. 모든 node 스크립트는 그 폴더에서 실행한다.
LLM(우측 비주얼 motif) 생성은 **Claude Code(너)가 직접** 한다 — 외부 claude 호출 없음.

## 절차

1. `cd "project/active/thumbnail-factory"`.
2. `node engine/pending.js` → 생성 대기 행(요청됨/재요청) JSON 확인.
3. **대기 행이 있으면**, 각 행마다 `engine/generate.md` 규칙대로 motif 생성:
   - `title_html`: 메인 타이틀. `강조 단어(emph)`를 `<span class="grad">`로 감쌈. **한글 줄바꿈 규칙 준수**(단어 중간 자르기·조사/외톨이 글자 줄머리 금지 → 앞 줄로 올림).
   - `sub_html`: 서브 문구. 앞부분 강조는 `<span class="pt">`.
   - `motif_html`: `feel`(+`ref`) 기반 우측 비주얼. **요청하지 않은 텍스트(라벨·카피·숫자) 임의 생성 금지.**
   - `output/jobs.json`에 배열로 저장: `[{ "id":"<rowNum>", "rowNum":<n>, "title":"<A원문>", "title_html":"…", "sub_html":"…", "motif_html":"…", "outPath":"output/row<n>.png" }]`
4. `node engine/render.js output/jobs.json` → PNG 렌더.
5. `node engine/upload_review.js` → Dropbox `_review/` 업로드 + 시트 `🔍 검수대기` + 미리보기 링크(H) + 슬랙 "검수해주세요" 알림.
6. `node engine/deposit_approved.js` → 승인된 행(검수대기 & 승인 J=✅) 최종 폴더 이동 + 팀 동기화폴더 복사 + 결과 링크(I) + `✅ 완료` + 슬랙 "완료" 알림.
7. 처리 결과 요약 보고(생성 N건 / 적재 M건 / 오류).

## 상시 자동화 (무료)
`/loop 2m /thumbnail` → 2분마다 위 절차 반복. **Claude Code 창을 하나 열어두면** 팀원이 시트에 입력→체크만으로 동작. (PC가 켜져 있고 이 창이 떠 있는 동안)

## 주의
- 생성 대기·승인 대기 모두 없으면 "처리할 항목 없음"만 보고하고 종료(불필요한 작업·비용 없음).
- 스크립트가 행 단위로 에러를 격리하므로 한 행 실패가 전체를 막지 않는다.
- 재생성: 시트에서 상태(G)를 `🔄 재요청`으로 바꾸거나 생성요청(F) 체크 → 다음 루프에 다시 생성.
