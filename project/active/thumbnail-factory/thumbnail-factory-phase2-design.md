# 썸네일 팩토리 Phase 2 — 설계 문서 (Design Spec)

- **작성일**: 2026-06-24
- **상태**: 승인됨 (사용자 확정)
- **목적**: Phase 1(PM 수동 `/thumbnail`)을 팀원 셀프서비스로 확장. 팀원이 시트에 입력하면 **로컬 워처**가 ~1분 내 자동 생성·검수대기, 사람 승인 시 Dropbox 적재.
- **전제**: Phase 1 완료(master 병합). 엔진(`template.html`/`render.js`/`build_preview.js`/`upload_dropbox.js`/`generate.md`) 재사용.

## 1. 핵심 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 트리거 | **로컬 워처**(Node 상시 실행, ~20초 폴링) | 체감 ~1분 / 유휴 시 LLM 미실행 = 무비용 / Cloudflare·API키 불필요 |
| 검수 | **2단계**(생성→검수대기→사람 승인→적재) | 디자인 검수 원칙 유지 |
| 지능 호출 | motif 생성만 `claude -p` 위임 | 별도 Anthropic API 키·비용 없이 기존 Claude Code 사용. 헤드리스 MCP 인증 문제 회피 |
| 시트 접근(워처) | **기존 Google OAuth 토큰 재사용**(`~/.claude/google-oauth-token.json`, spreadsheets+drive 스코프+refresh_token) | 서비스계정 신규 생성 불필요 — 이미 발급된 authorized-user 자격을 googleapis로 사용 |
| Dropbox | **refresh token**으로 액세스 토큰 자동 갱신 | 워처가 4h 이상 상주 |
| 상시 실행 | Windows 작업 스케줄러(로그온 시 시작) | 데몬 관리 단순 |

## 2. 아키텍처

```
[Google Sheet] ◀──(서비스계정 read/write)──┐
   ▲ ~20초 폴링                              │
[watcher.js (상시 실행)] ─────────────────────┤  작업 감지 시:
                                            │   1) claude -p → motif HTML (지능 필요 부분만)
                                            │   2) render.js → output/row<N>.png
                                            │   3) upload_dropbox.js → /thumbnails/_review/ (생성)
                                            │      또는 moveFile → /thumbnails/ (승인 적재)
                                            └   4) 시트에 상태/링크 기록
```
- 워처는 결정적 Node. motif 생성만 LLM. 나머지 전부 Phase 1 스크립트 재사용.

## 3. 상태 머신 (시트 F열)

```
(빈칸 또는 '요청됨')
      │  워처: 생성 단계
      ▼
'검수대기'  (+ I열 미리보기 링크)
      │  사람: H열 ✅ 체크
      ▼
'승인'
      │  워처: 적재 단계 (_review → 최종 이동)
      ▼
'완료'  (+ G열 결과 링크)

분기: 생성/적재 실패 → '⚠️ <사유>'  |  사람이 '재요청' 입력 → 빈칸 취급해 재생성
```

## 4. 시트 스키마 (Phase 1 A~G + 2컬럼)

| 컬럼 | 이름 | 입력 주체 |
|---|---|---|
| A~E | 메인타이틀/서브/비주얼느낌/강조단어/참고URL | 팀원 |
| F | 상태 | 워처(자동) / 사람(재요청·승인 보조) |
| G | 결과 이미지 링크 | 워처(자동) |
| **H** | **승인 (체크박스 TRUE/FALSE)** | **사람** |
| **I** | **미리보기 링크** | 워처(자동) |

## 5. 구성요소 (독립 단위)

1. **`watcher/watcher.js`** — 폴링 루프. 매 틱: (a) 생성 대상(F∈{빈칸,요청됨,재요청}) 처리, (b) 적재 대상(F='검수대기' & H=TRUE) 처리. 행 단위 try/catch 격리. 동시성 1(순차)로 단순화.
2. **`watcher/sheets_client.js`** — `googleapis` OAuth2(authorized-user, 기존 토큰 재사용, 자동 refresh). `getRows()`, `setStatus(row, status)`, `setCell(row, col, val)`.
3. **`watcher/generate_motif.js`** — `child_process`로 `claude -p` 실행. 입력: 행 데이터 + `engine/generate.md` 규칙. 출력: motif HTML 문자열(+ title_html/sub_html). JSON으로 회수(파싱 가드).
4. **`engine/upload_dropbox.js` 확장** — `getAccessToken()`(refresh token 교환·캐시), `moveFile(fromPath, toPath)`(files/move_v2). 기존 `uploadAndShare`는 access token 주입형으로 리팩터.
5. **`watcher/.env`** — `GOOGLE_OAUTH_TOKEN` (기본 `~/.claude/google-oauth-token.json`), `SPREADSHEET_ID`, `SHEET_NAME`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_FOLDER`, `POLL_INTERVAL_MS`, `LLM_BACKEND`(claude|api), `ANTHROPIC_API_KEY`(폴백 시).
6. **Apps Script 버튼**(선택) — `생성요청`: 선택 행 F='요청됨'. 승인은 H 체크박스라 버튼 없음.
7. **작업 스케줄러 등록** — `watcher/start-watcher.ps1` + 등록 안내(로그온 시 `node watcher/watcher.js`).

## 6. 데이터 흐름 (1틱)

1. `sheets_client.getRows()` → A:I 스냅샷.
2. **생성**: F∈{'',요청됨,재요청} & A·B·C 채워진 행마다 →
   `generate_motif()` → jobs 1건 작성 → `render.js` → `_review/<slug>.png` 업로드 →
   `setStatus(검수대기)`, `setCell(I, 미리보기링크)`.
3. **적재**: F='검수대기' & H=TRUE 행마다 →
   `moveFile(_review/<slug>.png → /thumbnails/<slug>.png)` → 공유링크 →
   `setStatus(완료)`, `setCell(G, 결과링크)`, (H 그대로 둠).
4. sleep(POLL_INTERVAL_MS).

slug = A 타이틀 → 영문/숫자/하이픈 정규화 + 행번호 suffix(충돌 방지).

## 7. 에러 처리

- 행 단위 try/catch: 한 행 실패가 루프를 멈추지 않음. F='⚠️ <사유 80자>'.
- `claude -p` 실패/비정상 출력(파싱 불가) → 해당 행 ⚠️, 다음 틱 재시도 안 함(무한 재시도 방지: '재요청' 수동 입력으로만 재처리).
- Dropbox access token 만료 → `getAccessToken()`이 refresh로 자동 재발급. refresh 실패 시 로그 + 다음 틱 재시도.
- 시트 API 일시 오류 → 틱 스킵, 다음 틱 재시도.
- 멱등성: 상태 전이 기준이라 워처 재시작해도 중복 처리 없음(검수대기는 재생성 안 함, 완료는 건너뜀).

## 8. 테스트 전략

- **단위(TDD)**: `slug()` 정규화, `moveFile` 호출 URL/바디 구성(fetch 모킹), 상태 전이 판정 함수(`classifyRow(row) → 'generate'|'upload'|'skip'`), refresh-token 교환 파서.
- **통합(수동)**: 서비스계정 시트 read/write 1회, Dropbox refresh→access 교환 + move 1회.
- **E2E**: 새 행 → ~1분 내 검수대기+미리보기 / H체크 → ~1분 내 완료 / '재요청' → 재생성 / 워처 재시작 후 이어서.

## 9. 새 셋업 (사용자 1회)

- ~~Google 서비스 계정~~ → **불필요. 기존 `~/.claude/google-oauth-token.json`(spreadsheets+drive 스코프, refresh_token 포함) 재사용.** 시트가 그 토큰 소유 계정 소유면 추가 공유도 불필요.
- **Dropbox refresh token**: 기존 scoped 앱의 App key/secret로 OAuth code flow 1회(`token_access_type=offline`) → refresh token 획득.
- **작업 스케줄러**: 로그온 시 watcher 자동 시작 등록.

## 10. 비목표 (YAGNI)

- 실시간 푸시(웹훅)·서버 상주 → 로컬 워처로 충분.
- 다중 PC·고가용성 → 단일 PC.
- 동시 다중 렌더 → 순차로 충분(요청 빈도 낮음).
- 승인 버튼 → H 체크박스로 대체.
