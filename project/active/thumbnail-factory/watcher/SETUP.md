# 썸네일 팩토리 — 셋업 & 운영 가이드 (Phase 2)

팀원이 시트에 입력→체크하면, **Claude Code가 `/thumbnail`을 주기 실행**하며 썸네일을 생성·검수대기로 올리고(슬랙 알림), 승인하면 Dropbox+팀폴더에 적재한다. **외부 비용 없음**(Claude Code 구독 내).

## 구조 (왜 이렇게?)
- 생성(우측 비주얼)은 지능이 필요 → **Claude Code 자신이** 한다. (별도 claude.exe 호출은 이 Windows 환경에서 불안정해서 안 씀)
- 나머지(시트 R/W, 렌더, Dropbox, 슬랙)는 `engine/*.js` 결정적 스크립트.
- "워처"는 **Claude Code에서 `/loop`** 로 구현 → 터미널 데몬·작업 스케줄러 불필요.

## 시트 컬럼
A 메인타이틀 | B 서브 | C 비주얼느낌 | D 강조단어 | E 참고URL | **F 생성요청☑** | G 상태(드롭다운) | H 미리보기링크 | I 결과이미지링크 | **J 승인☑**
(데이터는 6행부터, 상단 1~5행은 안내/헤더)

## 팀원 사용법
1. A~E 입력 (D 강조단어·E 참고URL은 선택).
2. **생성요청(F) 체크** → ~1~2분 뒤 상태 `🔍 검수대기` + 미리보기 링크 + **슬랙 "검수해주세요" 알림**.
3. 미리보기 확인 → 좋으면 **승인(J) 체크** → ~1~2분 뒤 `✅ 완료` + 결과링크 + 팀폴더 저장 + **슬랙 "완료" 알림**.
4. 다시 만들기(문구 수정 등): 상태(G) 드롭다운에서 `🔄 재요청` 선택(또는 생성요청 F 재체크).

## 운영자(PM) 셋업 — 1회
1. **의존성**: `npm install` + `npx playwright install chromium` (프로젝트 폴더에서).
2. **`watcher/.env`** 작성 (`.env.example` 참고): 시트ID/탭명, Dropbox refresh token, LOCAL_OUTPUT_DIR(팀 동기화폴더), SLACK_WEBHOOK.
   - Dropbox refresh token: `node watcher/get_dropbox_refresh_token.js <APP_KEY> <APP_SECRET>` → 출력 URL 허용 → 코드 입력 → 나온 값 .env에.
   - 시트 접근은 기존 `~/.claude/google-oauth-token.json` 재사용(추가 발급 불필요).
3. **Apps Script** 설치: 시트 > 확장 프로그램 > Apps Script 에 `apps-script/생성요청.gs` 붙여넣기 → 저장 → 새로고침(상단 `썸네일` 메뉴 생성).

## 가동 (상시 자동화)
운영자 PC에서 **Claude Code 창 하나**를 열고:
```
/loop 2m /thumbnail
```
→ 2분마다 시트를 확인해 처리. 이 창을 열어두는 동안(PC 켜진 동안) 자동 동작.
- 멈춤: 그 창에서 루프 중단(Esc) 또는 창 닫기.
- 수동 1회 실행: `/thumbnail`.

> 한계: 운영자 PC가 꺼져 있으면 그동안 요청은 시트에 쌓였다가, 다음에 켜고 `/loop` 돌 때 처리됨(유실 없음).
