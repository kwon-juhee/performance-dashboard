# 썸네일 팩토리 Phase 2 — Tasks

상세는 `thumbnail-factory-phase2-plan.md`.

- [x] **Task 1** 워처 스캐폴드 (googleapis/dotenv, .env.example)
- [x] **Task 2** upload_dropbox 확장 (refresh token + moveFile + header escape) + 테스트
- [x] **Task 3** rows.js (slug, classifyRow) + 테스트
- [x] **Task 4** motif.js (claude -p / api, extractMotifJson) + 테스트
- [x] **Task 5** sheets_client.js (기존 OAuth 토큰 재사용) — 라이브 검증 ✅
- [x] **Task 6** tick.js (runTick + processGenerate/Upload) + 테스트
- [x] **Task 7** watcher.js 메인 루프
- [x] **Task 8** 시트 H(체크박스)·I 컬럼 추가 (라이브)
- [x] **Task 9** Apps Script 생성요청/재요청 버튼
- [x] **Task 10** SETUP.md + get_dropbox_refresh_token.js + start-watcher.ps1
- [x] **Task 11** E2E 라이브 검증 (생성→검수대기→승인→완료, 시트+Dropbox 실거래)

## 검증 결과 (2026-06-24)
- 단위 테스트 16/16 통과.
- 라이브 E2E: 데모행 입력 → 렌더 → `_review/` 업로드 → 검수대기+미리보기링크 → H승인 → 최종 이동 → 완료+결과링크. 검증 후 데모행/파일 정리.
- 한글 파일명(Dropbox 헤더 이스케이프) 버그 발견·수정.
- 미검증(샌드박스 한계): `claude -p` 실제 세션 인증 → SETUP.md 3번으로 사용자 확인.

## 사용자 셋업 잔여 (SETUP.md 참조)
1. Dropbox refresh token 발급 → watcher/.env
2. `claude -p` 인증 확인
3. 작업 스케줄러 등록
4. Apps Script 설치 + 시트 팀 공유
