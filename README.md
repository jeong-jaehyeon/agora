# 🐙 Agora — 멀티 AI 코드 리뷰

> 3개 AI에게 동시에 코드 리뷰를 받고, 누가 뭘 발견했는지 한눈에 비교하는 도구

## 이게 뭔가요?

MR(Merge Request)을 올리고 코드 리뷰를 받을 때, AI 하나만 쓰면 놓치는 게 있습니다.
Claude는 잡는데 Gemini는 못 잡고, Copilot은 다른 관점에서 보고, 때로는 서로 반대 의견을 내기도 합니다.

Agora는 이 문제를 해결합니다:

1. **3개 AI에게 동시에 리뷰 요청** (Claude, Gemini, GitHub Copilot)
2. **결과를 자동으로 비교 분류** (합의 / 고유 발견 / 의견 충돌)
3. **웹 리포트로 보기 좋게 출력** (다크/라이트 모드, 필터, 액션 아이템)

```
                    ┌─────────┐
                    │  사용자  │
                    │ /agora  │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          🐶 Claude  🐻 Gemini  🐱 Copilot
          (자체리뷰)   (CLI)      (CLI)
              │          │          │
              └──────────┼──────────┘
                         │
                    ┌────▼────┐
                    │ 🐙 MC   │
                    │ (분류)   │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │ 웹 리포트 │
                    └─────────┘
```

## 빠른 시작

### 1. 설치

```bash
cd agora2
yarn install
```

### 2. 실행

Claude Code에서:

```
/agora-review https://gitlab.nexon.com/qualitysolution/tovice/tovice-server/-/merge_requests/131
```

처음 실행하면 셋업 대화가 시작됩니다. 로컬 환경을 자동으로 스캔해서 기존 API 키를 찾아줍니다.

### 3. 결과 확인

브라우저에서 웹 리포트가 자동으로 열립니다:

- 🔴 Error / 🟡 Warning / 🔵 Info 로 severity 분류
- 파일별로 이슈를 묶어서 표시
- 합의(3/3), 고유(1 AI), 충돌(의견 차이) 뱃지
- 충돌 이슈에는 MC의 판정 포함
- 체크박스로 할 일 관리

## 리뷰 대상 지정 방법

```bash
# GitLab MR URL
/agora-review https://gitlab.nexon.com/.../merge_requests/131

# 로컬 git diff (자동)
/agora-review

# 특정 브랜치 비교
/agora-review git diff develop..feature/my-branch
```

## 참여 AI

| AI | 아이콘 | 호출 방식 | 인증 |
|----|--------|-----------|------|
| Claude | 🐶 | Claude Code 자체 리뷰 (외부 호출 없음) | 불필요 |
| Gemini | 🐻 | `gemini -p "$PROMPT" -o text` CLI | Google OAuth |
| Copilot | 🐱 | `gh copilot -p "$PROMPT"` CLI | `gh auth login` |

**Claude는 두 가지 역할을 합니다:**
- **리뷰어**: diff를 직접 읽고 이슈를 발견
- **MC (중재자)**: 3개 AI 결과를 비교하고, 합의/고유/충돌로 분류하고, 충돌 시 프로젝트 컨텍스트를 기반으로 판정

## 셋업

처음 `/agora-review`를 실행하면 자동으로 셋업이 시작됩니다.

```
━━━ Agora 초기 설정 ━━━━━━━━━━━━━━━━━━━━━━

로컬 환경을 확인했습니다.

🐶 Claude    — AWS Bedrock 경유 사용 중 → 그대로 사용할까요?
🐻 Gemini    — GOOGLE_API_KEY 발견 → 이 키를 사용할까요?
🐱 Copilot   — 준비 완료
📋 GitLab    — 토큰 발견 → 이 토큰을 사용할까요?
```

각 AI별로 선택지가 제공되며, 기존에 설정된 키가 있으면 자동으로 감지합니다.

### 지원하는 Claude 인증 방식

| 방식 | 환경변수 | 설명 |
|------|----------|------|
| AWS Bedrock | `CLAUDE_USE_BEDROCK=1` | AWS 인증(~/.aws/credentials) 그대로 사용 |
| Anthropic API | `ANTHROPIC_API_KEY=sk-ant-...` | Anthropic 직접 API 키 |

셋업 결과는 `.env.agora` 파일에 저장됩니다 (`.gitignore` 대상).

## 웹 리포트

리뷰 결과는 브라우저에서 열리는 HTML 리포트로 제공됩니다.

### 구성

```
┌─────────────────────────────────────────┐
│ 🐙 Agora Review          요약 이슈 액션 🌙│  ← sticky 헤더 + 네비 + 다크/라이트 토글
├─────────────────────────────────────────┤
│ 발견된 이슈  │  AI 합의   │  참여 AI      │  ← 대시보드
│     10      │    3      │ 🐶🐻🐱       │
├─────────────────────────────────────────┤
│ 📋 이 MR은 뭘 바꾸나요?                   │  ← MR 요약 (비유 포함)
│ 주방에서 여러 요리가...                    │
├─────────────────────────────────────────┤
│ 수정이 필요한 것들 (7)  [전체 펼치기]       │  ← 이슈 목록
│ [전체] [Error] [Warning] [합의만]         │     필터 바
│                                         │
│ ▸ 🔴 :203 권한 체크 위조       합의 3/3    │  ← 접이식 카드
│ ▸ 🟡 :295 N+1 쿼리            합의 3/3    │
│ ▸ 🟡 :57  중복 실행 위험       🐱 Copilot  │
├─────────────────────────────────────────┤
│ 의견이 갈린 것들 (1)                       │  ← 충돌 + MC 판정
│ ⚡ NODE_ENV 조건                          │
│   🐻 Gemini: ...  🐱 Copilot: ...        │
│   🐙 MC 판정: 이슈 아님. TOVICE는...       │
├─────────────────────────────────────────┤
│ 할 일 목록              ━━━━━━━━ 0/6     │  ← 액션 아이템
│ ☐ 🔴 validator.ts — 전용 권한 등록        │     체크박스 + 프로그레스 바
│ ☐ 🟡 poller.ts — N+1 쿼리 수정           │
└─────────────────────────────────────────┘
```

### 기능

- **다크/라이트 모드** — 오른쪽 상단 🌙/☀️ 토글
- **접이식 이슈 카드** — 클릭해서 펼치기/접기, "전체 펼치기" 버튼
- **필터** — 전체 / Error만 / Warning만 / 합의만
- **파일별 그룹핑** — 같은 파일의 이슈를 묶어서 표시
- **MC 판정** — 의견 충돌 시 프로젝트 컨텍스트를 아는 MC가 판정
- **액션 아이템** — 체크하면 프로그레스 바 실시간 갱신
- **모바일 반응형** — 768px 이하 대응

## 프로젝트 구조

```
agora2/
├── .claude/commands/
│   └── agora-review.md          # Claude Code 커스텀 커맨드 (셋업 + 리뷰 플로우)
├── scripts/
│   ├── agora-review.ts          # Gemini/Copilot CLI 호출 오케스트레이터
│   ├── agora-review.test.ts     # 테스트 (10개, vitest)
│   └── report-template.html     # 웹 리포트 HTML 템플릿
├── .env.agora                   # API 키 (gitignore, 셋업 시 자동 생성)
├── .env.agora.example           # 키 템플릿
├── .gitignore
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 분류 기준

### 같은 이슈 판정
- 같은 파일 내 ±5줄 이내 + 동일 주제 → 같은 이슈
- 그 외는 MC가 description 의미적 유사도로 판단

### 카테고리
| 카테고리 | 의미 | 리포트 표시 |
|----------|------|------------|
| 합의 | 2개 이상 AI가 같은 이슈 발견 | 👥 합의 3/3 (초록) |
| 고유 | 1개 AI만 발견 | 👤 🐻 Gemini (파랑) |
| 충돌 | AI 간 의견이 다름 | ⚡ + MC 판정 |

## 테스트

```bash
yarn test        # 전체 테스트 실행
yarn test:watch  # 워치 모드
```

10개 테스트 커버리지:
- Gemini CLI 호출 (정상/실패/타임아웃)
- Copilot CLI 호출 (정상/미설치/실패)
- 오케스트레이터 (전체 성공/부분 실패/전체 실패/대형 diff 경고)

## 향후 계획

### Phase 2: MC 토론 라운드
- 충돌 이슈에 대해 AI 간 토론 진행
- MC가 각 AI에게 "근거를 대라"고 요청하여 수렴
- 사용자 개입 가능 (방향 지시, 건너뛰기)

### 확장
- 커스텀 AI 등록 (사용자가 원하는 AI 추가)
- 리뷰 이력 관리
- GitLab MR 코멘트 자동 등록
- 리뷰 결과 마크다운 리포트 저장

## 왜 "Agora"인가?

아고라(Ἀγορά)는 고대 그리스의 광장입니다. 시민들이 모여 토론하고 합의를 이끌어내던 장소.
Agora에서는 AI들이 모여 코드에 대해 토론하고, MC가 합의를 이끌어냅니다.
