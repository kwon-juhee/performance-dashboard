# 썸네일 팩토리 — 설계 문서 (Design Spec)

- **작성일**: 2026-06-24
- **상태**: 승인됨 (사용자 확정)
- **목적**: 블로그 콘텐츠 썸네일을 LEVER Xpert 포맷으로 일관되게 양산. 팀원이 시트에 텍스트/느낌만 입력하면 썸네일 PNG가 Dropbox에 적재된다.
- **원본 레퍼런스**: `content/ai-commerce-post/banner-template.html` (1600×900 HTML→PNG), v1(링+말풍선), v2(ChatGPT 광고 목업)

## 1. 핵심 결정 사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 생성 엔진 | **하이브리드** — Claude가 우측 비주얼 HTML/SVG 생성 → Playwright 렌더 | AI 픽셀 생성은 한글 텍스트를 못 씀. HTML 렌더만 정확도+포맷 일관성 보장 |
| 비주얼 처리 | 주제별 **AI 자유 생성** (단, 코드 생성 방식) | 매번 다른 관련 비주얼 + 포맷 고정 |
| 입력 시트 | **Google Sheets** (신규 생성) | 공유·동시편집·MCP 자동화 |
| 운영 방식 | **Phase 1**: 수동 `/thumbnail` 커맨드 + 미리보기 검수 | 디자인 검수 원칙 + 배포 0 |
| 렌더러 | **Node + Playwright** | Phase 2 Cloudflare Worker(JS) 코드 재사용 |
| 적재 위치 | **Dropbox** (앱/토큰 신규 생성 필요) | 사용자 지정 |

## 2. 전체 흐름 (Phase 1)

```
[Google Sheet 행 입력]  ← 팀원 (A~E 컬럼)
        │  /thumbnail 실행 (PM)
        ▼
[1] pending 행 읽기 (F 상태 비어있는 행)
[2] 행마다 Claude가 우측 비주얼 HTML/SVG 생성
     · C 비주얼 느낌 + E 참고 이미지 URL 해석
     · pill 라벨(개념 태그)도 주제에서 도출
[3] template.html 에 주입 → A 타이틀 / D 강조단어 / B 서브 / 로고 + 우측 비주얼
[4] Playwright로 1600×900 PNG 렌더
[5] 갤러리 output/_preview.html 생성 → 브라우저로 한눈에 검수
        │  OK한 행만
        ▼
[6] Dropbox 업로드 → [7] 시트에 F 상태='완료' + G 이미지 링크 기록
```

## 3. 시트 스키마 (7컬럼)

| 컬럼 | 이름 | 입력 주체 | 비고 |
|---|---|---|---|
| A | 메인 타이틀 | 팀원 | 줄바꿈 `\n` 또는 자동 |
| B | 서브 문구 | 팀원 | |
| C | 비주얼 느낌 | 팀원 | 자유 서술 (예: "링+말풍선, AI 추천 받는 느낌") |
| D | 강조 단어 | 팀원(선택) | 타이틀 중 그라데이션 처리할 단어. 비우면 Claude 자동 선택 |
| E | 참고 이미지 URL | 팀원(선택) | 있으면 우측 목업으로 다듬어 배치(v2 방식) |
| F | 상태 | **자동** | (빈칸)=대기 → ⟳ 생성중 → ✅ 완료 / ⚠️ 오류 |
| G | 결과 이미지 링크 | **자동** | Dropbox 공유 링크 |

팀원은 A~E만 채운다. F·G는 스크립트가 writeback.

## 4. 구성요소 (독립 단위)

1. **`template.html`** — 고정 프레임. 배경(다크 그라데이션+도트 텍스처+상단 액센트), 좌측 텍스트 블록(h1+강조 span, 서브, 로고), 우측 빈 `.motif` 슬롯. `banner-template.html`을 파라미터화한 것.
   - 입력 인터페이스: `{{TITLE_HTML}}`, `{{SUB_HTML}}`, `{{MOTIF_HTML}}` 플레이스홀더.
2. **비주얼 생성기** (`engine/generate.md`) — (C 느낌, E 참고URL) → 우측 motif용 HTML/SVG + pill 라벨. Claude가 담당. **포맷 가드레일**(크기·여백·컬러 토큰·pill 위치 규칙)을 프롬프트에 고정해 일관성 유지.
3. **렌더러** (`engine/render.js`) — 합쳐진 HTML 문자열 → 1600×900 PNG. Node + Playwright(`page.setContent` → `screenshot`).
4. **검수 갤러리** (`output/_preview.html`) — 썸네일 격자, 브라우저 자동 맞춤, 클릭 시 원본. (사용자 선호 포맷 `_preview.html`)
5. **Dropbox 업로더** (`engine/upload_dropbox.js`) — 승인분만 업로드(`files/upload`), 공유 링크 생성(`sharing/create_shared_link_with_settings`).
6. **시트 동기화** — 상태·링크 writeback (Google Sheets MCP).

## 5. 파일 구조

```
project/active/thumbnail-factory/
  thumbnail-factory-design.md     # 이 문서
  thumbnail-factory-context.md    # 자료 경로·결정·Last Updated
  thumbnail-factory-tasks.md      # 단계별 체크리스트
  template.html                   # 파라미터화된 프레임
  assets/lever-white.png          # 로고 (content/ai-commerce-post 에서 복사)
  engine/
    generate.md                   # 비주얼 생성 프롬프트 규칙(포맷 가드레일)
    render.js                     # HTML→PNG (Playwright)
    upload_dropbox.js             # Dropbox 업로드 + 공유 링크
  output/                         # 렌더 PNG + _preview.html
  .env                            # DROPBOX_TOKEN (gitignore)
~/.claude/commands/thumbnail.md   # /thumbnail 슬래시 커맨드
```

## 6. 에러 처리

- 행 단위 격리: 한 행 실패해도 나머지 진행. 실패 행은 F='⚠️ 오류 + 사유' 기록.
- 참고 URL 접근 실패 → 느낌만으로 폴백 생성, 경고 기록.
- Dropbox 업로드 실패 → PNG는 output/에 남기고 F에 오류 표기, 재시도 가능.
- 렌더 타임아웃/폰트 미로딩 → Pretendard 웹폰트 로드 대기 후 캡처.

## 7. 검증 (Definition of Done, Phase 1)

- 샘플 행 2~3개로 v1·v2와 동급 품질의 PNG가 나온다.
- `_preview.html`에서 한눈에 검수 가능.
- 승인분이 Dropbox에 적재되고 시트 G에 링크가 기록된다.
- 새 행 추가 → `/thumbnail` 재실행 시 신규 행만 처리(멱등성).

## 8. Phase 2 (엔진 검증 후, 별도 스펙)

Phase 1의 `engine/`(생성 규칙 + 렌더 + 업로드)을 **Cloudflare Worker + Browser Rendering**으로 이식. 시트에 `①생성`(미리보기 링크) / `②확정`(Dropbox 적재) 2버튼(Apps Script→Worker 웹훅) → 팀원 셀프서비스. Phase 1 코드 재사용.

## 9. 외부 의존성 / 셋업 필요

- **Dropbox 앱 생성 + 액세스 토큰** (scoped: `files.content.write`, `sharing.write`). 토큰은 `.env`.
- **Google Sheet 신규 생성** (위 스키마 + 헤더 행). Claude가 생성 후 링크 공유.
- **Node + Playwright** 설치 (`npm i playwright` + 브라우저 바이너리).
