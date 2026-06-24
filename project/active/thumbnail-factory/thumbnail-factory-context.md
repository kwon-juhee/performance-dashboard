# 썸네일 팩토리 — Context

- **Last Updated**: 2026-06-24 (Phase 2 구축 완료 — 로컬 워처 E2E 라이브 검증, 사용자 검토 대기)
- **담당**: media-rep@madup.com (LEVER Xpert PM)
- **목적**: 블로그 콘텐츠 썸네일을 LEVER Xpert 포맷으로 양산. 시트 입력 → Dropbox 적재.

## 핵심 자료 경로
- 원본 템플릿: `content/ai-commerce-post/banner-template.html`
- 레퍼런스 이미지: v1 `content/ai-commerce-post/banner_search-to-chat.png`, v2 `ad_v2.png`
- 로고: `content/ai-commerce-post/lever-white.png`
- 설계: `thumbnail-factory-design.md` / 계획: `thumbnail-factory-plan.md`

## 결정 사항
- 생성 엔진: 하이브리드(Claude가 우측 비주얼 HTML/SVG 생성 → Playwright 렌더). AI 픽셀 생성은 한글 불가.
- 시트: Google Sheets 신규 생성. 7컬럼(A 메인타이틀 / B 서브 / C 비주얼느낌 / D 강조단어 / E 참고URL / F 상태(자동) / G 링크(자동)).
- 운영: Phase 1 = `/thumbnail` 수동 커맨드 + `_preview.html` 검수. **Phase 2 = 로컬 워처(상시 폴링) + 2단계 검수** (Cloudflare 버튼 대신 로컬 워처로 결정 — 무비용·~1분 체감).
- 렌더러: Node + Playwright.
- 적재: Dropbox. Phase 2는 refresh token으로 무인 갱신.
- 시트 접근(Phase 2 워처): 기존 `~/.claude/google-oauth-token.json` 재사용(서비스계정 불필요).
- LLM(Phase 2 motif 생성): `claude -p` 위임(무료), 폴백 `ANTHROPIC_API_KEY`.

## 연동 정보
- **spreadsheetId**: `14s1-yYUqQkZBE8xKhEgt8U8V_scUFKVAGmot9VP85jw`
- **스프레드시트 제목**: `[CSM팀] 콘텐츠 썸네일 생성기` (사용자가 변경)
- **시트 탭 이름**: `thumnail factory` (⚠️ 원래 `시트1`에서 변경됨. 비ASCII/공백 → range는 작은따옴표 필수)
- **컬럼**: A~E 입력 / F 상태 / G 결과링크 / H 승인(체크박스) / I 미리보기링크
- **DROPBOX_FOLDER**: `/thumbnails` (검수용 `/_review/` 하위 폴더 사용)

## 미해결 / 대기 (사용자 검토 후)
- [ ] Dropbox refresh token 발급 (`watcher/get_dropbox_refresh_token.js`, SETUP.md 2번) — 무인 4h 갱신용
- [ ] `claude -p` 실제 세션 인증 확인 (SETUP.md 3번)
- [ ] 작업 스케줄러 등록 (`start-watcher.ps1 -Register`)
- [ ] Apps Script `생성요청.gs` 설치 + 시트 팀 편집 공유
- [ ] Phase 1 `/thumbnail` 커맨드의 시트명 `시트1`→`thumnail factory` 갱신(현재 stale)
