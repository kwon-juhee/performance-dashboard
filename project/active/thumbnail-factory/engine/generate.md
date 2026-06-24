# 우측 비주얼 생성 규칙 (motif HTML/SVG)

입력: 행의 `비주얼 느낌`(C), `참고 이미지 URL`(E, 선택).
출력: `template.html`의 `.motif`(760×760, 우측, `right:-70px`) 안에 들어갈 **HTML/SVG 조각만**. `<div class="motif">`는 쓰지 말 것 (이미 존재).

## 고정 규칙 (포맷 일관성)
- 컬러는 CSS 변수만 사용: `--purple #6a4dff`, `--blue #005bf0`, `--blue-bright #1b76f5`, `--green #00b37a`, `--surface #16171C`, `--border #2A2C33`.
- 배경 장식은 동심원 링 3개(`.ring .r2 .r3`) + 중앙 글로우(`.glow`)를 **기본 베이스로 항상 포함**해 톤을 통일.
- 개념 라벨은 **pill 2개**(`.pill.p1`, `.pill.p2`)로. p1=우상단(녹색 dot), p2=좌하단(파란 dot). 라벨 텍스트는 주제에서 도출.
- 중앙 주인공 요소 1개(말풍선/카드/목업 등)만. 요소 3개 이상 금지(잡해짐).
- 폰트는 상속(Pretendard). 인라인 폰트 지정 금지.
- 한글 텍스트는 반드시 실제 텍스트 노드로(이미지로 굽지 말 것).
- 추가 스타일이 필요하면 motif 조각 안에 `<style>` 블록을 같이 넣어도 됨(클래스명 충돌 주의 — `m-` 접두사 권장).

## 참고 이미지가 있을 때
- URL 내용을 해석해 같은 톤의 **HTML/SVG 목업으로 재현**(직접 임베드 X — 스타일 안 맞음). 예: ChatGPT 광고 스크린샷 → 다크 채팅 UI + 스폰서 카드를 코드로 재현.

## 예시 (v1: 대화형 커머스)
```html
<div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div>
<div class="glow"></div>
<div class="pill p1"><span class="dot"></span>AI 추천</div>
<div class="pill p2"><span class="dot"></span>대화형 커머스</div>
<div class="chat"><span class="who">소비자</span>“이거 추천해줘”
  <svg class="spark" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/></svg>
</div>
```

## 타이틀/강조/서브 처리
- `메인 타이틀`(A): `<h1>` 안에 들어감. `강조 단어`(D)에 해당하는 부분을 `<span class="grad">…</span>`로 감싼다. D가 비면 핵심 키워드 1개를 직접 선택.
- 줄바꿈은 `<br>`로. 2줄 권장(긴 제목은 3줄). **한 줄 길이 가드레일**: copy 영역 폭 880px / h1 70px 기준 한 줄이 넘치면 마지막 글자가 다음 줄로 흘러내린다(고아 글자). 한글 약 14자, 영문 혼용 시 더 짧게 잡아 `<br>`로 끊을 것. 단어 중간이 깨지지 않도록 의미 단위로 끊는다.
- `서브 문구`(B): `.sub` 안에. 앞부분 강조는 `<span class="pt">…</span>`.
