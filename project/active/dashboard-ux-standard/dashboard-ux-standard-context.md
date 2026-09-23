# 대시보드 UX 표준 — Context

**Last Updated: 2026-09-23**

## 배경

팀 내에서 여러 대시보드(우리카드, 불스원, 닥터원더, 퍼포먼스 마케팅 등)를 각자 만들면서
디자인 취향과 별개로 "고객 UX상 반드시 있어야 하는" 요소가 매번 재논의되는 문제가 있었음.
→ 취향과 무관한 UX 규칙만 뽑아 팀 표준 체크리스트로 고정하고, 이후 KPI/매체 구성까지 템플릿화하는 것이 목표.

## 목적

1. 신규 대시보드 제작 시 매번 "이거 넣어야 하나?" 논의를 줄인다.
2. 광고주/팀장이 실제로 보고서에 쓸 때 오해나 불편이 없도록 최소 기준을 강제한다.

(KPI 프리셋, 매체 프리셋 등 UX 이후 확장 범위는 팀 논의 전이라 이 문서에서는 다루지 않음)

## 핵심 자료 경로

- 이번 초안: [dashboard-ux-checklist.md](dashboard-ux-checklist.md)
- 관련 기존 메모리(팀 전체 규칙, 프로젝트 무관하게 적용):
  - 반응형 레이아웃 표준 — `feedback_dashboard_layout.md`
  - Chart.js 파이차트 legend 규칙 — `feedback_chartjs_pie.md`
  - 스크롤바 hover 숨김 — `feedback_dashboard_scrollbar.md`
  - 오픈 속도 우선 원칙 — `feedback_dashboard_open_speed_first.md`
  - 점검은 프록시 경유 — `feedback_dashboard_check_via_proxy.md`
  - 시간/캐시 확인 함정 — `reference_time_and_cache_pitfalls.md`
  - 대시보드 재사용 자산 전반 — `dashboard_playbook.md`
- 기존 실제 대시보드 저장소 구조(참고용, 이 repo와는 별도) — `project_dashboard_repo_structure.md` (site/src/archive/redirect/vendor 분리)
- 본 repo(`performance-dashboard`): Streamlit 기반 퍼포먼스 마케팅 대시보드(`dashboard.py`). 이 표준 문서는 특정 대시보드 구현체에 종속되지 않고, HTML/Cloudflare 계열과 Streamlit 계열 양쪽에 공통 적용 가능한 "규칙" 레벨로 작성함.

## 결정 사항

- 체크리스트에는 `(기존)`/`(신규)` 같은 출처 태그를 넣지 않는다. 작성자 기준 "기존"이지 팀원 입장에서는 전부 새 규칙이라 의미가 없음.
- 표준 위반 여부는 가능하면 사람 리뷰보다 자동 검증(grep 기반 린터 등)으로 확인하는 방향을 지향한다 (아직 미착수).
- 이 표준 문서 자체는 `build-dashboard` 스킬이 참조하도록 추후 연결 예정 (아직 미착수).
- KPI 프리셋/매체 프리셋은 팀 논의가 먼저 필요한 사안이라 별도 논의 이후 착수. 현재 이 프로젝트 범위에는 포함하지 않음.

## 진행 상태

- [x] UX 체크리스트 초안 (A~D) 완료
- [ ] `build-dashboard` 스킬 연결 착수 전
- [ ] grep 기반 표준 준수 검증 스크립트 착수 전
