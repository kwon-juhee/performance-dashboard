# 썸네일 팩토리 — Tasks (Phase 1)

상세 단계는 `thumbnail-factory-plan.md` 참조.

- [x] **Task 1** 프로젝트 스캐폴드 (package.json, .gitignore, .env.example, 로고 복사, npm install + playwright)
- [x] **Task 2** template.html 파라미터화 프레임
- [x] **Task 3** render.js (HTML→PNG) + 테스트 (2 pass)
- [x] **Task 4** build_preview.js (검수 갤러리) + 테스트 (2 pass)
- [x] **Task 5** upload_dropbox.js + Dropbox 토큰 연결 + 스모크 테스트 ✅
- [x] **Task 6** Google Sheet 생성 (시트1, 헤더+샘플 2행)
- [x] **Task 7** generate.md 비주얼 생성 가드레일 (줄 길이 규칙 포함)
- [x] **Task 8** /thumbnail 오케스트레이션 커맨드
- [x] **Task 9** E2E 검증 — 렌더·미리보기·품질 + Dropbox 적재 2건 + 시트 writeback ✅

## Phase 1 완료 (2026-06-24)
- 샘플 2건 Dropbox 적재 완료, 시트 F열 '✅ 완료' + G열 링크 기록 확인.
- 테스트 4/4 통과.

## 다음 (선택)
1. 시트 팀 공유 (편집 권한)
2. Phase 2: Cloudflare Worker + 시트 2버튼 셀프서비스 (refresh token 교체)
