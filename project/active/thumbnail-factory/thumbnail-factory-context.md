# 썸네일 팩토리 — Context

- **Last Updated**: 2026-06-24 (Phase 1 완료 — E2E 검증, 샘플 2건 Dropbox 적재)
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
- 운영: Phase 1 = `/thumbnail` 수동 커맨드 + `_preview.html` 검수. Phase 2 = Cloudflare Worker + 시트 2버튼 셀프서비스.
- 렌더러: Node + Playwright (Phase 2 JS 재사용).
- 적재: Dropbox (앱 폴더, scoped token).

## 연동 정보
- **spreadsheetId**: `14s1-yYUqQkZBE8xKhEgt8U8V_scUFKVAGmot9VP85jw`
- **시트 이름**: `시트1` (기본 시트, 영문 "Sheet1" 아님 주의)
- **DROPBOX_FOLDER**: `/thumbnails`

## 미해결 / 대기
- [ ] Dropbox 앱 생성 + 토큰 (사용자 수동, plan Task 5) → `.env`에 DROPBOX_TOKEN
- [ ] 시트 팀 공유 권한 부여 (편집)
