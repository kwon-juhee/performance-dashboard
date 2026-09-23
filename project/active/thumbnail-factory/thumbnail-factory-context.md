# 썸네일 팩토리 — Context

- **Last Updated**: 2026-06-25 (Phase 2 완료 — Claude Code `/loop` 방식으로 가동, 슬랙 알림 포함, E2E 검증)
- **담당**: media-rep@madup.com (LEVER Xpert PM)
- **목적**: 블로그 콘텐츠 썸네일을 LEVER Xpert 포맷으로 양산. 시트 입력 → 검수 → Dropbox/팀폴더 적재.

## 핵심 자료 경로
- 원본 템플릿: `content/ai-commerce-post/banner-template.html` → `template.html`로 파라미터화
- 레퍼런스: v1 `content/ai-commerce-post/banner_search-to-chat.png`, v2 `ad_v2.png`
- 운영 가이드: `watcher/SETUP.md` (← 최신 운영 방법은 여기)
- 설계/계획(역사적): `thumbnail-factory-design.md`, `-plan.md`, `-phase2-design.md`, `-phase2-plan.md`
  - ⚠️ Phase 2 설계/플랜 문서는 "로컬 Node 워처" 기준으로 작성됨. **실제 구현은 Claude Code `/loop` 방식으로 변경**(아래 참조). 운영은 SETUP.md를 따른다.

## 최종 아키텍처 (Phase 2, 가동 중)
- **운영 = Claude Code에서 `/loop 2m /thumbnail`** (운영 PC에 Claude Code 창 열어두기). 별도 Node 데몬·작업스케줄러 없음.
- 이유: 무인 Node 프로세스가 로컬 claude를 spawn하면 이 Windows 환경에서 실패(path/ENOENT). 그래서 **루프 주체 = Claude Code 자신**. motif(우측 비주얼)도 Claude가 직접 생성. **API 비용 0.**
- `/thumbnail` 절차: `engine/pending.js`(요청 행) → (Claude가 motif HTML 생성, `engine/generate.md` 규칙) → `engine/render.js`(Playwright PNG) → `engine/upload_review.js`(_review 업로드+검수대기+슬랙) → `engine/deposit_approved.js`(승인분 최종이동+팀폴더복사+완료+슬랙).
- 2단계 검수: 생성요청(F☑) → 🔍검수대기 → 승인(J☑) → ✅완료. 재생성=상태(G) 드롭다운 `🔄 재요청`.

## 연동 정보
- **spreadsheetId**: `14s1-yYUqQkZBE8xKhEgt8U8V_scUFKVAGmot9VP85jw` / 제목 `[CSM팀] 콘텐츠 썸네일 생성기`
- **시트 탭**: `thumnail factory` (⚠️ 공백 포함 → range 작은따옴표 필수). 데이터 6행부터(`DATA_START_ROW=6`).
- **컬럼**: A타이틀 B서브 C느낌 D강조 E참고URL **F생성요청☑** G상태(드롭다운) H미리보기 I결과링크 **J승인☑**
- **Dropbox**: App folder 타입(`LEVER Xpert-thumnail-factory`). refresh token으로 무인 갱신. 검수=`/thumbnails/_review/`, 최종=`/thumbnails/`.
- **팀 폴더(최종 실물)**: `LOCAL_OUTPUT_DIR` = `C:/Users/MADUP/주식회사매드업 Dropbox/CSM팀/콘텐츠/블로그/썸네일` (로컬 동기화 복사)
- **시트 접근**: 기존 `~/.claude/google-oauth-token.json` 재사용(서비스계정 불필요)
- **슬랙**: `SLACK_WEBHOOK` (검수대기/완료 시 알림). 설정은 모두 `watcher/.env`(gitignore).

## 완료된 셋업
- ✅ Dropbox refresh token / 시트(컬럼·드롭다운·안내블록) / Slack webhook / LOCAL_OUTPUT_DIR / Apps Script(생성요청.gs) 설치 / engine 검증(테스트 12 pass + row8 라이브 E2E)

## 남은 것 (선택)
- [ ] `feature/thumbnail-factory-phase2` → master 병합 (검토 후)
- [ ] (선택) 우측 비주얼 진짜 3D 일러스트 = nano-banana(이미지AI) 경로 추가
- [ ] 데모 row 8 정리(원하면)
