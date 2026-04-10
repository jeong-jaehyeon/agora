# Agora Review — 멀티 AI 코드 리뷰

## 0단계: 셋업 확인

먼저 Bash로 `.env.agora` 파일이 있는지 확인합니다:
```
test -f /Users/wolgus104/Developer/agora2/.env.agora && echo "READY" || echo "NEEDS_SETUP"
```

### NEEDS_SETUP인 경우 — 초기 셋업 대화

먼저 Bash로 로컬 환경을 한번에 스캔합니다:
```
echo "=== 로컬 환경 스캔 ==="
echo "--- Claude ---"
[ -n "$ANTHROPIC_API_KEY" ] && echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..." || echo "ANTHROPIC_API_KEY: 없음"
[ "$CLAUDE_CODE_USE_BEDROCK" = "1" ] && echo "BEDROCK: 사용 중" || echo "BEDROCK: 미사용"
grep -h "ANTHROPIC_API_KEY" ~/.zshrc ~/.bashrc 2>/dev/null | grep -v "^#" | head -1 || true
echo "--- Gemini ---"
[ -n "$GEMINI_API_KEY" ] && echo "GEMINI_API_KEY: ${GEMINI_API_KEY:0:10}..." || echo "GEMINI_API_KEY: 없음"
[ -n "$GOOGLE_API_KEY" ] && echo "GOOGLE_API_KEY: ${GOOGLE_API_KEY:0:10}..." || echo "GOOGLE_API_KEY: 없음"
grep -h "GEMINI_API_KEY\|GOOGLE_API_KEY" ~/.zshrc ~/.bashrc 2>/dev/null | grep -v "^#" | head -1 || true
echo "--- Copilot ---"
gh auth status 2>&1 | head -3
gh copilot --version 2>/dev/null && echo "COPILOT: 설치됨" || echo "COPILOT: 미설치"
echo "--- GitLab ---"
[ -n "$GITLAB_TOKEN" ] && echo "GITLAB_TOKEN: ${GITLAB_TOKEN:0:10}..." || echo "GITLAB_TOKEN: 없음"
[ -n "$GITLAB_PRIVATE_TOKEN" ] && echo "GITLAB_PRIVATE_TOKEN: ${GITLAB_PRIVATE_TOKEN:0:10}..." || echo "GITLAB_PRIVATE_TOKEN: 없음"
grep -h "GITLAB_TOKEN\|GITLAB_PRIVATE_TOKEN" ~/.zshrc ~/.bashrc 2>/dev/null | grep -v "^#" | head -1 || true
```

추가로 Claude memory에 저장된 GitLab 토큰이 있는지도 확인합니다.

스캔 결과를 요약해서 사용자에게 보여주고, AskUserQuestion으로 각 AI 설정을 확인합니다.

**셋업 안내 메시지:**

```
━━━ Agora 초기 설정 ━━━━━━━━━━━━━━━━━━━━━━

Agora는 3개 AI에게 동시에 코드 리뷰를 요청합니다.
처음 사용이시네요! 로컬 환경을 확인했습니다.
```

그 다음 스캔 결과 요약을 표시합니다 (예시):
```
🐶 Claude    — AWS Bedrock 경유 사용 중
🐻 Gemini    — GOOGLE_API_KEY 발견 (AIzaSy...)
🐱 Copilot   — 준비 완료 (로그인됨)
📋 GitLab    — memory에 토큰 발견
```

**각 AI별 AskUserQuestion으로 확인:**

각 AI 설정을 AskUserQuestion 도구를 사용해 하나씩 확인합니다.

**1) Claude API** — 스캔 결과에 따라 선택지 구성:

- Bedrock 감지 시:
  질문: "AWS Bedrock 경유로 Claude를 사용하고 계시네요. Agora에서도 Bedrock으로 호출할까요?"
  선택지:
  - A) Bedrock 사용 (기존 AWS 인증 그대로)
  - B) Anthropic API 키 직접 입력

- ANTHROPIC_API_KEY 발견 시:
  질문: "Anthropic API 키가 이미 있습니다 ({앞 10자}...). 이 키를 사용할까요?"
  선택지:
  - A) 이 키 사용
  - B) 새 키 입력

- 둘 다 없을 때:
  질문: "Claude API 키를 찾지 못했습니다. Anthropic 콘솔(https://console.anthropic.com)에서 발급받을 수 있습니다."
  선택지:
  - A) API 키 입력 (직접 입력)
  - B) 건너뛰기 (Claude 없이 2개 AI로 진행)

**2) Gemini API** — 스캔 결과에 따라 선택지 구성:

- GEMINI_API_KEY 또는 GOOGLE_API_KEY 발견 시:
  질문: "Gemini API 키가 이미 있습니다 ({앞 10자}...). 이 키를 사용할까요?"
  선택지:
  - A) 이 키 사용
  - B) 새 키 입력

- 없을 때:
  질문: "Gemini API 키를 찾지 못했습니다. Google AI Studio(https://aistudio.google.com/apikey)에서 무료로 발급 가능합니다."
  선택지:
  - A) API 키 입력 (직접 입력)
  - B) 건너뛰기 (Gemini 없이 진행)

**3) GitHub Copilot** — 자동 확인:

- 인증 + 확장 모두 OK → "🐱 GitHub Copilot 준비 완료!" (선택지 없이 자동 진행)
- 인증 안 됨 → AskUserQuestion:
  질문: "GitHub Copilot을 사용하려면 인증이 필요합니다."
  선택지:
  - A) 지금 인증하기 (터미널에서 `! gh auth login` 실행 안내)
  - B) 건너뛰기 (Copilot 없이 진행)

- 확장 미설치 → AskUserQuestion:
  질문: "GitHub Copilot CLI 확장이 설치되지 않았습니다."
  선택지:
  - A) 지금 설치하기 (`gh extension install github/gh-copilot` 실행)
  - B) 건너뛰기

**4) GitLab 토큰** — 스캔 결과에 따라 선택지 구성:

- 환경변수 또는 memory에서 토큰 발견 시:
  질문: "GitLab 토큰이 이미 있습니다 ({앞 10자}...). 이 토큰을 사용할까요?"
  선택지:
  - A) 이 토큰 사용
  - B) 새 토큰 입력
  - C) 건너뛰기 (로컬 git diff만 사용)

- 없을 때:
  질문: "GitLab MR URL로 리뷰하려면 토큰이 필요합니다. 로컬 git diff만 사용하려면 건너뛰어도 됩니다."
  선택지:
  - A) 토큰 입력 (직접 입력)
  - B) 건너뛰기

**셋업 완료 후:**

모든 선택이 끝나면 Bash로 `.env.agora` 파일을 생성합니다.
(사용자가 선택한 값들로 파일을 구성)

그리고 설정 결과를 요약합니다:
```
━━━ 설정 완료! ━━━━━━━━━━━━━━━━━━━━━━━━━━━

🐶 Claude: Bedrock 경유 / API 키 / 미설정
🐻 Gemini: API 키 설정됨 / 미설정
🐱 Copilot: 준비 완료 / 미설정
📋 GitLab: 토큰 설정됨 / 건너뜀

최소 2개 AI가 설정되어야 Agora를 사용할 수 있습니다.
이제 리뷰를 시작할 수 있습니다!
리뷰 대상을 알려주세요 (MR URL, 또는 바로 엔터를 치면 최근 변경사항을 리뷰합니다).
```

만약 설정된 AI가 2개 미만이면:
"최소 2개 AI가 필요합니다. 추가 설정이 필요합니다."로 안내하고 부족한 AI 설정으로 돌아갑니다.

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

**2-A) Claude 리뷰 (자체 생성)**

Claude Code 자신이 직접 diff를 읽고 리뷰합니다. 외부 API 호출 없음.
diff 내용을 분석하고, 아래 형식으로 Claude의 리뷰를 생성합니다:
- MR 요약 (비유 포함, 비개발자도 이해 가능)
- 발견한 이슈 (severity, 파일명, 줄번호, 설명, 개선 제안)
- 이슈 없으면 "이슈 없음"

이 리뷰 결과를 메모리에 보관합니다 (3단계에서 MC 역할 시 사용).

**2-B) Gemini + Copilot 리뷰 (외부 CLI 호출)**

Bash 도구로 스크립트를 실행합니다:
```
cd /Users/wolgus104/Developer/agora2 && npx tsx scripts/agora-review.ts /tmp/agora-diff-{timestamp}.txt
```

스크립트가 Gemini CLI와 Copilot CLI를 호출하여 각각 리뷰를 받고, 결과를 JSON으로 stdout에 출력합니다.

## 3단계: 리포트 생성

스크립트 출력(JSON)을 읽고, Claude 자체 리뷰와 합쳐서 리포트를 생성합니다.

### 분류 기준
- **같은 이슈 판정**: 같은 파일 내 ±5줄 이내 + 동일 주제 → 같은 이슈
- **그 외**: description의 의미적 유사도로 판단

### 분류 카테고리
- **합의** (2+ AI 동일 이슈): 높은 확신. 우선 수정 권장.
- **고유** (1 AI만 발견): 참고용. 해당 AI 이름 표시.
- **충돌** (AI 간 명시적 의견 차이): 양쪽 근거를 함께 표시. MC 판정 포함.

### Severity 아이콘
- 🔴 error: 반드시 수정해야 하는 버그/보안 이슈
- 🟡 warning: 수정을 권장하는 이슈
- 🔵 info: 알아두면 좋은 참고 사항

### 출력 형식

리포트는 "위에서 아래로 읽으면 핵심부터 세부까지" 구조로 작성합니다.

```
━━━ Agora Review ━━━━━━━━━━━━━━━━━━━━━━━━━

📋 이 MR은 뭘 바꾸나요?

{비유를 포함한 쉬운 설명. 2-3문장.}

변경 파일: {파일 목록 간단히}

━━━ 한눈에 보기 ━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 N건  🟡 N건  🔵 N건
합의 N건 | 고유 N건 | 충돌 N건
참여: 🐶 Claude  🐻 Gemini  🐱 Copilot

━━━ 수정이 필요한 것들 ━━━━━━━━━━━━━━━━━━━

파일별로 그룹핑합니다. severity 높은 순서로 정렬.
합의/고유/충돌 구분 없이 "이 파일에서 뭘 고쳐야 하는지"를 중심으로.

### `파일명`

🔴 **line:N — 이슈 제목**
  {설명 1-2줄}
  💡 {개선 제안}
  👥 🐶🐻🐱 합의 (3/3)

🟡 **line:N — 이슈 제목**
  {설명 1-2줄}
  💡 {개선 제안}
  👤 🐱 Copilot만 발견

### `다른파일명`

🟡 **line:N — 이슈 제목**
  {설명}
  💡 {개선 제안}
  👥 🐶🐻 합의 (2/3)

━━━ 의견이 갈린 것들 ━━━━━━━━━━━━━━━━━━━━

충돌이 있는 경우에만 이 섹션을 표시합니다.

⚡ **`파일명`:line — {주제}**

  🐶 Claude: {의견}
  🐻 Gemini: {의견}
  🐱 Copilot: {의견}

  🐙 MC 판정: {MC로서 어떤 의견이 맞는지, 왜 그런지 판단. 프로젝트 컨텍스트를 아는 MC만 할 수 있는 판단을 포함.}

━━━ 참고만 하세요 ━━━━━━━━━━━━━━━━━━━━━━━

🔵 severity의 info 이슈들. 간결하게 한 줄씩.

- `파일:line` — {내용} ({어떤 AI가 발견})

━━━ 액션 아이템 ━━━━━━━━━━━━━━━━━━━━━━━━━

위 리뷰 결과를 기반으로, 실제로 해야 할 작업을 우선순위별로 정리합니다.

- [ ] 🔴 {가장 중요한 수정}
- [ ] 🟡 {두 번째 수정}
- [ ] 🟡 {세 번째 수정}
- [ ] 🔵 {선택적 개선}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 출력 원칙
1. **파일 기준으로 그룹핑**: 같은 파일의 이슈는 묶어서 보여줌. 사용자가 파일 하나씩 열어서 고칠 때 편리.
2. **severity 순서**: 🔴 → 🟡 → 🔵. 중요한 것부터.
3. **합의 표시는 뱃지로**: `👥 🐶🐻🐱 합의 (3/3)` 또는 `👤 🐱 Copilot만 발견`. 본문 아래에 작게.
4. **충돌은 별도 섹션**: 의견이 갈린 것은 MC 판정과 함께 독립 섹션으로.
5. **액션 아이템은 체크리스트**: 리뷰 끝에 "그래서 뭘 해야 하는데?"를 명확히.
6. **MC 판정에 프로젝트 컨텍스트 활용**: MC(Claude Code)는 프로젝트 구조를 알고 있으므로, 일반론이 아닌 이 프로젝트에 맞는 판단을 내림.

스크립트 실행 중 에러가 있으면 (일부 AI 실패 등) "한눈에 보기" 섹션에 경고를 함께 표시합니다.

$ARGUMENTS
