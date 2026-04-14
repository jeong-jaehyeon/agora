# Agora 포트폴리오 PDF 생성 프롬프트

아래 내용을 Claude Code에 붙여넣기하세요.

---

`/Users/wolgus104/Developer/agora2/` 프로젝트를 기반으로 포트폴리오 PDF를 생성해줘. 아래 정보와 지시사항을 따라서 `portfolio.html` 파일을 만들고, 그걸 PDF로 변환해줘.

## 프로젝트 정보

- **프로젝트명**: Agora — 멀티 AI 코드 리뷰 도구
- **기간**: 2026.04.09 ~ 2026.04.14 (6일)
- **역할**: 기획 + 설계 + 개발 (1인 개발)
- **기술스택**: TypeScript, Claude Code, Gemini CLI, GitHub Copilot CLI, Vitest, HTML/CSS/JS
- **활용 도구**: gstack (/office-hours로 YC 스타일 제품 검증, /plan-eng-review로 아키텍처 리뷰), Superpowers

## 핵심 기능

1. **3개 AI 동시 코드 리뷰**: Claude, Gemini, Copilot에게 MR diff를 동시에 보내 독립적 리뷰 수집
2. **MC(중재자) 판정 시스템**: 3개 AI 리뷰를 합의/고유/충돌로 자동 분류. 충돌 시 프로젝트 컨텍스트를 아는 MC가 편향 없이 판정
3. **인터랙티브 웹 리포트**: 다크/라이트 모드, severity 필터, 파일별 그룹핑, before/after 코드 비교, Claude Code 프롬프트 복사 버튼
4. **셋업 자동화**: 로컬 환경 스캔 → CLI 자동 설치 → 연결 테스트까지 대화형으로 진행
5. **리뷰 후 자동 수정**: 웹 리포트에서 수정할 이슈를 복수 선택하면 코드 자동 수정

## 설계 철학

"AI 하나보다 여러 AI의 합의가 더 신뢰할 수 있다" — 단일 AI의 편향과 맹점을 보완하기 위해, 서로 다른 AI 엔진의 리뷰를 교차 검증하는 접근

## 아키텍처

```
                    ┌─────────┐
                    │  사용자  │
                    │ /agora  │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              v          v          v
          Claude      Gemini     Copilot
         (자체리뷰)    (CLI)      (CLI)
              │          │          │
              └──────────┼──────────┘
                         │
                    ┌────v────┐
                    │   MC    │
                    │ (분류)   │
                    └────┬────┘
                         │
                    ┌────v────┐
                    │ 웹 리포트 │
                    └─────────┘
```

상세 흐름:
1. 사용자가 `/agora-review` 커맨드로 GitLab MR URL 또는 로컬 diff 전달
2. Claude Code가 직접 diff를 읽고 자체 리뷰 수행 (외부 API 호출 없음)
3. TypeScript 오케스트레이터(`agora-review.ts`)가 Gemini CLI와 Copilot CLI를 호출하여 독립 리뷰 수집
4. MC(Claude Code)가 3개 리뷰를 비교 — 같은 파일 ±5줄 이내 + 동일 주제이면 같은 이슈로 판정
5. 분류 결과: 합의(2+ AI), 고유(1 AI), 충돌(의견 차이 → MC가 프로젝트 컨텍스트 기반 판정)
6. HTML 웹 리포트 생성 → 브라우저 자동 오픈
7. 사용자가 수정할 이슈 선택 → 코드 자동 수정

## 프로젝트 구조

```
agora2/
├── .claude/commands/
│   ├── agora-review.md     # Claude Code 커스텀 커맨드 (500줄, 셋업+리뷰 전체 플로우)
│   └── agora-setup.md      # 설정 재설정 커맨드
├── scripts/
│   ├── agora-review.ts     # Gemini/Copilot CLI 오케스트레이터
│   ├── agora-review.test.ts # 테스트 10개 (vitest)
│   └── report-template.html # 웹 리포트 HTML 템플릿 (950줄)
├── SETUP-GUIDE.md          # 팀원 배포용 설치 가이드
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 성과

- MR당 리뷰 시간 30분 → 추정 5~10분으로 단축 (66~83% 감소)
- gstack /office-hours로 YC 스타일 제품 검증 (6가지 강제 질문으로 수요 현실 검증)
- gstack /plan-eng-review로 아키텍처 리뷰 + outside voice 확보
- 에이전트 팀(Claude Code Agent Team)을 활용한 병렬 개발/테스트
- 팀원 배포용 SETUP-GUIDE.md 포함 — 5분 설치, 글로벌 커맨드 등록

## 테스트

- Vitest 기반 10개 테스트 케이스
- Gemini CLI: 정상/실패/타임아웃
- Copilot CLI: 정상/미설치/실패
- 오케스트레이터: 전체 성공/부분 실패/전체 실패/대형 diff 경고
- 모델 파싱, 히스토리 저장 등 유틸리티 테스트

## 웹 리포트 주요 UI 요소

- sticky 헤더 + 네비게이션 (요약/이슈/충돌/액션)
- 대시보드: severity 카운트, AI 합의 수, 참여 AI + 모델명, 소요 시간
- MR 요약: 일상 비유 포함 (비개발자도 이해 가능)
- 접이식 이슈 카드: severity 색상 태그, 합의/고유 뱃지, 코드 스니펫
- before/after 코드 비교 (나란히 배치)
- "Claude Code에 요청하기" 복사 버튼
- 충돌 섹션: 각 AI 의견 + MC 판정
- 액션 아이템: 체크박스 + 실시간 프로그레스 바
- 다크/라이트 모드 토글
- 모바일 반응형 (768px 이하)

---

## HTML 생성 지시사항

### 디자인 스타일

- **모던 미니멀**: 깔끔한 여백, 카드 기반 레이아웃
- **색상 팔레트**: 다크 배경(#0a0e14) + 악센트 블루(#4b8ade) + 서브 컬러(success green, warning amber, error red)
- **타이포그래피**: system-ui 폰트 스택, 제목은 큰 font-weight, 본문은 가독성 중심
- **A4 인쇄 최적화**: @media print 스타일 포함, 페이지 브레이크 적절히 배치

### 포트폴리오 구성 (1페이지 ~ 2페이지)

**헤더 영역:**
- 프로젝트명 "Agora" + 부제 "멀티 AI 코드 리뷰 도구"
- 기간: 2026.04 (6일)
- 역할: 1인 기획/설계/개발
- 기술스택 태그 (pill 형태)

**프로젝트 소개 영역:**
- 2-3문장으로 프로젝트의 핵심 가치 설명
- 설계 철학 인용구 형태로 강조

**아키텍처 다이어그램 영역:**
- 위의 아키텍처 정보를 기반으로 순수 HTML/CSS로 다이어그램 그리기
- flexbox/grid로 노드와 화살표를 시각적으로 배치
- 각 노드에 아이콘과 역할 설명 포함

**핵심 기능 영역:**
- 카드 그리드로 5개 핵심 기능 표시
- 각 카드: 아이콘 + 제목 + 1-2문장 설명

**웹 리포트 스크린샷 영역:**
- "실제 웹 리포트 화면" 제목
- 회색 placeholder 박스 (가로 전체, 세로 300px)
- placeholder 안에 "스크린샷을 여기에 삽입하세요" 텍스트
- 캡션: "다크/라이트 모드, 필터, before/after 코드 비교, 체크리스트를 지원하는 인터랙티브 웹 리포트"
- placeholder 2개: 하나는 다크 모드, 하나는 라이트 모드 예시용

**성과 영역:**
- 수치 기반 메트릭 카드 (리뷰 시간 66~83% 단축, 10개 테스트, 6일 개발, 팀 배포 가이드)
- gstack 활용 성과 (YC 스타일 검증, 아키텍처 리뷰)

**기술 상세 영역:**
- 프로젝트 구조 트리
- 테스트 커버리지 요약
- 주요 기술적 결정 (왜 CLI 호출? 왜 HTML 리포트?)

**푸터:**
- "Agora - 2026.04" + 이름

### 파일 생성

1. `/Users/wolgus104/Developer/agora2/portfolio.html` 경로에 HTML 파일 생성
2. 모든 스타일은 인라인(style 태그) — 외부 CSS 파일 없음
3. 모든 다이어그램/아이콘은 순수 HTML/CSS — 외부 이미지 없음
4. @media print 스타일로 A4 인쇄 시 깔끔하게 나오도록

### PDF 변환

HTML 생성 후 아래 명령어로 PDF 변환:

```bash
# macOS에서 Chrome 헤드리스 모드로 PDF 변환
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --print-to-pdf="/Users/wolgus104/Developer/agora2/portfolio.pdf" \
  --no-margins \
  "/Users/wolgus104/Developer/agora2/portfolio.html"
```

Chrome이 없으면 다른 방법 시도:
```bash
# wkhtmltopdf 사용
wkhtmltopdf --page-size A4 --margin-top 10mm --margin-bottom 10mm --margin-left 15mm --margin-right 15mm \
  "/Users/wolgus104/Developer/agora2/portfolio.html" "/Users/wolgus104/Developer/agora2/portfolio.pdf"
```

둘 다 안 되면:
```bash
# Puppeteer 일회성 사용
npx puppeteer-core print "/Users/wolgus104/Developer/agora2/portfolio.html" "/Users/wolgus104/Developer/agora2/portfolio.pdf"
```

### 최종 확인

PDF 생성 후:
1. `open /Users/wolgus104/Developer/agora2/portfolio.pdf`로 결과 확인
2. HTML도 `open /Users/wolgus104/Developer/agora2/portfolio.html`로 브라우저에서 확인
3. 두 파일의 경로를 알려줘

---

이 프롬프트를 Claude Code에 붙여넣기하면 자동으로 portfolio.html을 생성하고 PDF로 변환합니다.
