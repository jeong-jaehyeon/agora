# Agora Review — 멀티 AI 코드 리뷰

## 0단계: 셋업 확인

먼저 Bash로 `.env.agora` 파일이 있는지 확인합니다:
```
test -f /Users/wolgus104/Developer/agora2/.env.agora && echo "READY" || echo "NEEDS_SETUP"
```

### NEEDS_SETUP인 경우 — 초기 셋업 대화

사용자에게 다음과 같이 안내합니다:

```
━━━ Agora 초기 설정 ━━━━━━━━━━━━━━━━━━━━━━

Agora는 3개 AI에게 동시에 코드 리뷰를 요청합니다.
처음 사용이시네요! API 키를 하나씩 설정하겠습니다.
```

**1) Claude API 키**

사용자에게 안내합니다:
- Anthropic 콘솔(https://console.anthropic.com)에서 API 키를 발급받을 수 있습니다
- Claude Code 구독과는 별개입니다. API 키를 따로 만들어야 합니다.
- "API 키를 입력해주세요 (sk-ant-로 시작합니다):"

사용자가 키를 입력하면 `.env.agora`에 `ANTHROPIC_API_KEY=입력값`을 기록합니다.

**2) Gemini API 키**

사용자에게 안내합니다:
- Google AI Studio(https://aistudio.google.com/apikey)에서 무료로 발급 가능합니다
- Google 계정으로 로그인 후 "Create API key" 버튼을 누르면 됩니다
- "API 키를 입력해주세요:"

사용자가 키를 입력하면 `.env.agora`에 `GEMINI_API_KEY=입력값`을 추가합니다.

**3) GitHub Copilot**

Bash로 인증 상태를 확인합니다:
```
gh auth status 2>&1 | head -3
```

- 인증되어 있으면: "GitHub Copilot 준비 완료!" 표시
- 인증 안 되어 있으면: "`gh auth login`을 먼저 실행해주세요. 터미널에서 `! gh auth login`을 입력하면 됩니다." 안내

Copilot 확장 설치 여부도 확인합니다:
```
gh copilot --version 2>/dev/null && echo "COPILOT_OK" || echo "COPILOT_MISSING"
```

COPILOT_MISSING이면: "`gh extension install github/gh-copilot`을 실행해주세요." 안내

**4) GitLab 토큰 (선택)**

사용자에게 안내합니다:
- GitLab MR URL로 리뷰하려면 GitLab 토큰이 필요합니다
- 로컬 git diff만 사용하려면 건너뛰어도 됩니다
- "GitLab Private Token을 입력해주세요 (건너뛰려면 엔터):"

입력하면 `.env.agora`에 `GITLAB_TOKEN=입력값`을 추가합니다.
건너뛰면 GITLAB_TOKEN 줄을 빈 값으로 추가합니다.

**셋업 완료 후:**

`.env.agora` 파일을 Bash로 작성합니다. 그리고 사용자에게:
```
━━━ 설정 완료! ━━━━━━━━━━━━━━━━━━━━━━━━━━━

🐶 Claude API: 설정됨
🐻 Gemini API: 설정됨
🐱 GitHub Copilot: {상태}
📋 GitLab: {설정됨 / 건너뜀}

이제 리뷰를 시작할 수 있습니다!
리뷰 대상을 알려주세요 (MR URL, 또는 바로 엔터를 치면 최근 변경사항을 리뷰합니다).
```

사용자가 리뷰 대상을 입력하면 아래 1단계부터 진행합니다.
리뷰 대상 없이 셋업만 한 경우, 여기서 종료합니다.

### READY인 경우 — 바로 리뷰 진행

아래 1단계부터 시작합니다.

## 1단계: diff 획득

사용자 입력을 확인합니다:

- **GitLab MR URL인 경우** (예: `https://gitlab.nexon.com/.../merge_requests/123`):
  URL에서 프로젝트 경로와 MR IID를 추출하고, Bash로 GitLab API를 호출하여 diff를 가져옵니다:
  ```
  curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "https://gitlab.nexon.com/api/v4/projects/PROJECT_ID/merge_requests/MR_IID/changes"
  ```
  PROJECT_ID는 URL 인코딩된 프로젝트 경로 (예: `qualitysolution%2Ftovice%2Ftovice-server`)
  환경변수 GITLAB_TOKEN은 .env.agora 파일에서 로드합니다.

- **로컬 diff인 경우**: `git diff` 명령어로 diff를 가져옵니다.

- **아무 입력 없는 경우**: 현재 브랜치의 `git diff HEAD~1`을 사용합니다.

획득한 diff를 임시 파일(`/tmp/agora-diff-{timestamp}.txt`)에 저장합니다.

## 2단계: AI 리뷰 수집

Bash 도구로 스크립트를 실행합니다:
```
cd /Users/wolgus104/Developer/agora2 && npx tsx scripts/agora-review.ts /tmp/agora-diff-{timestamp}.txt
```

스크립트가 3개 AI(Claude, Gemini, Copilot)에게 병렬로 리뷰를 요청하고, 결과를 JSON으로 stdout에 출력합니다.

## 3단계: 리포트 생성

스크립트 출력(JSON)을 읽고 아래 형식으로 리포트를 생성합니다.

먼저 **MR 요약**을 작성합니다. Claude 리뷰어의 `summary` 필드를 기반으로:
- 이 MR이 무엇을 변경하는지 비유를 포함해 쉽게 설명
- 주요 변경 파일과 변경의 목적

그 다음 **리뷰 결과**를 분류합니다:

### 분류 기준
- **같은 이슈 판정**: 같은 파일 내 ±5줄 이내 + 동일 category → 같은 이슈
- **그 외**: description의 의미적 유사도로 판단

### 분류 카테고리
- **합의** (2+ AI 동일 이슈): 높은 확신. 우선 수정 권장.
- **고유** (1 AI만 발견): 참고용. 해당 AI 이름 표시.
- **반대** (AI 간 명시적 충돌): 양쪽 근거를 함께 표시. 사용자 판단 필요.

### 출력 형식

```
━━━ Agora Review Report ━━━━━━━━━━━━━━━━━━━━

📋 MR 요약
{Claude 리뷰어가 생성한 MR 설명. 비유 포함.}

━━━ 합의 사항 (높은 확신) ━━━━━━━━━━━━━━━━━━

🐶🐻🐱 [severity] file:line
  {description}
  💡 {suggestion}

━━━ 고유 발견 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🐶 Claude만 발견:
  [severity] file:line — {description}

🐻 Gemini만 발견:
  [severity] file:line — {description}

🐱 Copilot만 발견:
  [severity] file:line — {description}

━━━ 의견 충돌 (판단 필요) ━━━━━━━━━━━━━━━━━━

⚡ file:line — {topic}
  🐶 Claude: {opinion}
  🐻 Gemini: {opinion}
  🐱 Copilot: {opinion}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
합의: N건 | 고유: N건 | 충돌: N건
```

스크립트 실행 중 에러가 있으면 (일부 AI 실패 등) 경고를 함께 표시합니다.

$ARGUMENTS
