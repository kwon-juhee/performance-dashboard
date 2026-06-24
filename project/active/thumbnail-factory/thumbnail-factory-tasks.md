# 썸네일 팩토리 — Tasks (Phase 1)

상세 단계는 `thumbnail-factory-plan.md` 참조.

- [x] **Task 1** 프로젝트 스캐폴드 (package.json, .gitignore, .env.example, 로고 복사, npm install + playwright)
- [x] **Task 2** template.html 파라미터화 프레임
- [x] **Task 3** render.js (HTML→PNG) + 테스트 (2 pass)
- [x] **Task 4** build_preview.js (검수 갤러리) + 테스트 (2 pass)
- [x] **Task 5** upload_dropbox.js 코드 ✅ / 앱·토큰 발급 ⏳ (사용자 대기)
- [x] **Task 6** Google Sheet 생성 (시트1, 헤더+샘플 2행)
- [x] **Task 7** generate.md 비주얼 생성 가드레일 (줄 길이 규칙 포함)
- [x] **Task 8** /thumbnail 오케스트레이션 커맨드
- [~] **Task 9** E2E 검증 — 렌더·미리보기·품질 ✅ / Dropbox 적재·writeback ⏳ (토큰 후)

## 남은 작업 (사용자)
1. Dropbox 앱 생성 + 토큰 → `.env`
2. 시트 팀 공유
→ 이후 `/thumbnail` 첫 실전 실행으로 Task 9 마무리
