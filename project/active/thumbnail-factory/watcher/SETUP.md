# 썸네일 워처 (Phase 2) — 셋업 가이드

팀원이 시트에 입력하면 로컬 워처가 ~1분 내 자동 생성→검수대기, 사람이 H열 체크하면 Dropbox 적재.

## 0. 동작 개요
- `watcher/watcher.js` 가 `POLL_INTERVAL_MS`(기본 20초)마다 시트를 확인.
- **생성**: F(상태)가 빈칸/요청됨/재요청 인 행 → motif 생성(`claude -p`) → 렌더 → Dropbox `_review/` 업로드 → F='검수대기', I열에 미리보기 링크.
- **적재**: F='검수대기' & H(승인)=✅ → `_review/`→최종 폴더 이동 → F='완료', G열에 결과 링크.

## 1. 사전 준비 (이미 됨)
- `watcher/.env` 작성됨 (시트 ID·탭명, Dropbox 폴더).
- 시트 접근: 기존 `~/.claude/google-oauth-token.json` 재사용 (서비스계정 불필요).
- 시트에 H(승인 체크박스)·I(미리보기 링크) 컬럼 추가됨.

## 2. Dropbox refresh token (무인 운영 필수, 1회)
4시간짜리 액세스 토큰 대신 만료 없는 refresh token으로 자동 갱신.

1. https://www.dropbox.com/developers/apps → 기존 앱 선택 → **Settings** 탭에서 **App key / App secret** 확인.
2. 발급 헬퍼 실행:
   ```bash
   cd project/active/thumbnail-factory
   node watcher/get_dropbox_refresh_token.js <APP_KEY> <APP_SECRET>
   ```
3. 출력된 URL을 브라우저에서 열고 허용 → 코드 복사 → 터미널에 붙여넣기.
4. 출력된 `DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN` 을 `watcher/.env` 에 채운다.
   (refresh token이 있으면 워처가 4h 토큰을 자동 재발급. 없으면 기존 `DROPBOX_TOKEN`(4h)로만 동작 → 4시간 후 멈춤.)

## 3. `claude -p` 인증 검증 (생성 단계 핵심)
워처는 motif 생성을 `claude -p` 에 위임한다(별도 API 비용 없음). 실제 로그인 세션에서 동작하는지 1회 확인:
```bash
claude -p "Reply with exactly: OK"
```
- `OK` 가 나오면 정상.
- `Not logged in` 이 나오면: 일반 터미널에서 `claude` 로 1회 로그인 후 재시도. 그래도 안 되면 `watcher/.env` 에 `LLM_BACKEND=api` + `ANTHROPIC_API_KEY=...` 설정(이 경우 API 사용료 발생).

## 4. 실행
테스트(포그라운드):
```bash
cd project/active/thumbnail-factory
npm run watch
```
로그온 시 자동 시작(상시 운영):
```powershell
powershell -ExecutionPolicy Bypass -File watcher\start-watcher.ps1 -Register
schtasks /Run /TN ThumbnailWatcher   # 지금 바로 시작
```
- 로그: `watcher/watcher.log`
- 해제: `schtasks /Delete /TN ThumbnailWatcher /F`
- ⚠️ 이 PC가 켜져 있어야 동작(로컬 워처).

## 5. 팀원 사용법
1. 시트에 A~E 입력 (메인타이틀/서브/비주얼느낌/강조단어/참고URL).
2. (선택) `썸네일` 메뉴 > `선택 행 생성요청` (안 눌러도 빈칸 행은 자동 처리).
3. ~1분 뒤 F='검수대기', I열 미리보기 링크 → 확인.
4. 좋으면 **H열 체크** → ~1분 뒤 F='완료', G열에 최종 Dropbox 링크.
5. 다시 만들려면 `썸네일` 메뉴 > 재요청(또는 F를 '재요청'으로).

## 6. Apps Script 설치
`apps-script/생성요청.gs` 내용을 시트 > 확장 프로그램 > Apps Script 에 붙여넣고 저장 → 새로고침하면 `썸네일` 메뉴 생성.
