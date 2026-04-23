# Agora Review — 멀티 AI 코드 리뷰

## 0단계: 셋업 확인

먼저 Bash로 `.env.agora` 파일이 있는지 확인합니다:
```
test -f $HOME/Developer/agora/.env.agora && echo "READY" || echo "NEEDS_SETUP"
```

### NEEDS_SETUP인 경우 — 초기 셋업 대화

**환영 메시지를 먼저 표시합니다:**

```
🏛️ 안녕하세요! Agora입니다.

코드 리뷰를 3개 AI(Claude, Gemini, Copilot)에게 동시에 맡기고,
누가 뭘 발견했는지 비교해서 보여주는 도구예요.

Claude는 지금 이 세션에서 바로 리뷰하고 (별도 설정 불필요),
Gemini와 Copilot은 CLI로 호출합니다.

처음이시네요! 환경을 확인하고 설정을 도와드릴게요.
```

**사전 조건 확인 (Pre-flight Check):**

```
echo "=== Pre-flight Check ==="
echo "NODE: $(node --version 2>/dev/null || echo '미설치')"
echo "AGORA_DIR: $(test -d $HOME/Developer/agora/scripts && echo 'OK' || echo '미발견')"
echo "AGORA_DEPS: $(test -d $HOME/Developer/agora/node_modules && echo 'OK' || echo '미설치')"
```

사전 조건 실패 시:
- Node 미설치 → "Node.js가 필요합니다. `brew install node`를 실행해주세요."
- agora 디렉토리 미발견 → "agora가 ~/Developer/agora에 설치되어 있어야 합니다. SETUP-GUIDE.md를 확인해주세요."
- node_modules 미설치 → "의존성을 설치합니다..." → Bash로 `cd $HOME/Developer/agora && yarn install` 자동 실행. 실패 시 "yarn install에 실패했습니다. 네트워크 상태를 확인하고 수동으로 실행해주세요."

**환경 스캔:**

```
echo "=== 환경 스캔 ==="
echo "--- Claude Code ---"
echo "SESSION_MODEL: ${ANTHROPIC_MODEL:-감지 안 됨}"
echo "--- Gemini ---"
which gemini 2>/dev/null && echo "GEMINI_CLI: 설치됨 ($(gemini --version 2>/dev/null | head -1))" || echo "GEMINI_CLI: 미설치"
echo "--- Copilot ---"
if which gh &>/dev/null; then
  echo "GH_CLI: 설치됨 ($(gh --version 2>/dev/null | head -1))"
  gh auth status 2>&1 | head -3
  gh copilot --version 2>/dev/null && echo "COPILOT_EXT: 설치됨" || echo "COPILOT_EXT: 미설치"
else
  echo "GH_CLI: 미설치"
  echo "COPILOT_EXT: 미설치 (gh 필요)"
fi
echo "--- GitLab ---"
[ -n "$GITLAB_TOKEN" ] && echo "GITLAB_TOKEN: ${GITLAB_TOKEN:0:10}..." || echo "GITLAB_TOKEN: 없음"
[ -n "$GITLAB_PRIVATE_TOKEN" ] && echo "GITLAB_PRIVATE_TOKEN: ${GITLAB_PRIVATE_TOKEN:0:10}..." || echo "GITLAB_PRIVATE_TOKEN: 없음"
grep -h "GITLAB_TOKEN\|GITLAB_PRIVATE_TOKEN" ~/.zshrc ~/.bashrc ~/.zprofile ~/.zshenv 2>/dev/null | grep -v "^#" | head -1 || true
```

추가로 Claude memory에 저장된 GitLab 토큰이 있는지도 확인합니다.

**대시보드 표시:**

```
━━━ 환경 스캔 결과 ━━━━━━━━━━━━━━━━━━━━━━━

  도구        상태              비고
  ──────────  ───────────────  ──────────────────
  🐶 Claude   ✅ 자동          Claude Code 세션 사용 (설정 불필요)
  🐻 Gemini   {✅/❌} {상태}    {버전 또는 미설치}
  🐱 Copilot  {✅/⚠️/❌} {상태}  {상세}
  📋 GitLab   {✅/❌} {상태}    {토큰 출처}
  🎙️ MC       ✅ 자동          Claude Code ({모델명})

  준비됨: {N}/2 AI  |  {M}건 조치 필요
```

**모든 것이 준비된 경우 (Happy Path):**

Gemini + Copilot 모두 준비 완료인 경우, 전체 설정을 하나씩 물어보지 않고 단축 옵션을 제공합니다.

AskUserQuestion:
질문: "모든 AI가 준비되어 있습니다. 기본 설정으로 바로 진행할까요?"
선택지:
- A) 바로 진행 (권장) — 감지된 설정 그대로 사용
- B) 개별 설정 — AI마다 하나씩 확인

A 선택 시: 기본 모델(Gemini 2.0 Flash)로 .env.agora 생성 → 연결 테스트 → 완료.
B 선택 시: 아래 개별 설정 플로우로 진행.

**개별 AI 설정 (AskUserQuestion):**

Claude는 Claude Code 세션 자체를 사용하므로 설정이 불필요합니다. Gemini, Copilot, GitLab만 설정합니다.

**1) Gemini** — 스캔 결과에 따라 선택지 구성:

- CLI 설치됨 + 인증됨:
  질문: "Gemini CLI가 준비되어 있습니다 (v{버전})."
  선택지:
  - A) 이대로 사용 (권장)
  - B) 건너뛰기

  A 선택 시 모델 선택:
  질문: "Gemini 모델을 선택해주세요."
  선택지:
  - A) Gemini 2.0 Flash (권장, 빠르고 무료)
  - B) Gemini 2.5 Pro (더 정확, 유료 플랜 필요할 수 있음)
  - C) Gemini 2.5 Flash (균형형)

  → .env.agora에 `GEMINI_MODEL=선택한모델` 저장

- CLI 설치됨 + 인증 안 됨 (스캔에서 인증 상태 불확실):
  질문: "Gemini CLI가 설치되어 있지만 인증이 필요할 수 있습니다. 연결 테스트에서 확인합니다."
  선택지:
  - A) 이대로 사용 (권장, 연결 테스트에서 확인)
  - B) 건너뛰기

  A 선택 시 모델 선택 → .env.agora에 저장

- CLI 미설치:
  질문: "Gemini CLI가 설치되지 않았습니다."
  선택지:
  - A) 설치 안내 — "https://github.com/google-gemini/gemini-cli 에서 설치 후 `gemini auth login`으로 인증해주세요. 완료 후 `/agora-setup`으로 다시 설정하면 됩니다."
  - B) 건너뛰기

**2) GitHub Copilot** — 단계별 자동 해결:

- gh CLI 미설치:
  질문: "GitHub CLI(gh)가 필요합니다."
  선택지:
  - A) 자동 설치 — Bash로 `brew install gh` 실행. Homebrew 없으면 "https://cli.github.com 에서 설치 방법을 확인해주세요."
  - B) 건너뛰기 — Copilot 없이 진행

  A에서 설치 성공 → 다음 단계(인증)로 자동 진행

- gh 설치됨 + 인증 안 됨:
  질문: "GitHub 로그인이 필요합니다. 별도 터미널 창을 열어서 `gh auth login`을 실행해주세요. 완료되면 여기로 돌아와서 계속 진행하면 됩니다."
  선택지:
  - A) 인증 완료, 계속 진행
  - B) 건너뛰기

- gh 인증됨 + copilot 확장 미설치:
  질문: "Copilot CLI 확장을 설치할까요?"
  선택지:
  - A) 설치 — Bash로 `gh extension install github/gh-copilot` 자동 실행. 실패 시 "설치에 실패했습니다. 수동으로 실행해주세요."
  - B) 건너뛰기

  A 설치 성공 → "✅ 설치 완료!" 표시 후 다음 단계로

- 전부 OK:
  질문: "GitHub Copilot이 준비되어 있습니다. 이대로 사용할까요?"
  선택지:
  - A) 이대로 사용 (권장)
  - B) 건너뛰기

  A 선택 시 모델 선택:
  
  먼저 Bash로 사용 가능한 모델을 자동 테스트합니다:
  ```
  echo "=== Copilot 모델 테스트 ==="
  for model in claude-sonnet-4.6 gpt-5.2 gpt-4.1 claude-opus-4.6 claude-sonnet-4; do
    if gh copilot -- --model $model -p "hi" 2>&1 | grep -q "Error"; then
      echo "❌ $model"
    else
      echo "✅ $model"
    fi
  done
  ```

  테스트 결과에서 ✅인 모델만 선택지로 제공합니다.
  
  질문: "Copilot에서 사용할 모델을 선택해주세요. (사용 가능한 모델만 표시)"
  선택지: ✅인 모델들만 동적으로 구성. 예:
  - A) claude-sonnet-4.6 (Anthropic, 빠름)
  - B) gpt-5.2 (OpenAI 최신)
  - C) gpt-4.1 (OpenAI 안정)

  사용 가능한 모델이 1개뿐이면 자동 선택하고 질문을 건너뜁니다.

  → .env.agora에 `COPILOT_MODEL=선택한모델` 저장

참고: Copilot은 유료 구독(Individual $10/월, Business $19/월)이 필요합니다. 연결 테스트에서 확인됩니다.

**3) GitLab** — 스캔 결과에 따라 선택지 구성:

- 환경변수 또는 memory에서 토큰 발견 시:
  질문: "GitLab 토큰이 있습니다 ({앞 10자}...)."
  선택지:
  - A) 이 토큰 사용 (권장) → .env.agora에 `GITLAB_TOKEN=토큰값` 저장
  - B) 새 토큰 입력 → 입력받은 후 .env.agora에 저장
  - C) 건너뛰기 — 로컬 git diff만 사용

- 없을 때:
  질문: "GitLab MR URL로 리뷰하려면 토큰이 필요합니다."
  선택지:
  - A) 토큰 입력 — GitLab → Settings → Access Tokens에서 발급
  - B) 건너뛰기 — 로컬 git diff만 사용

**.env.agora 파일 생성:**

모든 설정이 끝나면 Bash로 `.env.agora` 파일을 생성합니다. 포맷:
```
# Agora 설정 파일 (자동 생성)
GEMINI_MODEL=gemini-2.0-flash
COPILOT_MODEL=claude-sonnet-4.6
GITLAB_TOKEN=glpat-xxxxx
```

Claude 관련 설정은 저장하지 않습니다 (Claude Code 세션 자체를 사용하므로).

**연결 테스트:**

"설정을 저장하고 연결을 확인합니다..."

```
cd $HOME/Developer/agora && npx tsx scripts/agora-review.ts --test
```

스크립트는 Gemini와 Copilot에 "Hello"를 보내고 응답 여부/시간을 JSON으로 반환합니다.

테스트 결과 대시보드:
```
━━━ 연결 테스트 ━━━━━━━━━━━━━━━━━━━━━━━━━━

  AI          상태     모델           응답 시간
  ──────────  ──────  ─────────────  ──────────
  🐶 Claude   ✅ 자동  {세션 모델}     —
  🐻 Gemini   ✅ 정상  2.0 Flash      1.2초
  🐱 Copilot  ✅ 정상  Sonnet 4.6     2.5초
```

Claude는 연결 테스트 대상이 아닙니다 (자체 리뷰이므로 항상 가용). 대시보드에 "✅ 자동"으로 표시.

**실패 시 처리:**

실패한 AI가 있으면 원인별 복구 안내:
- Gemini 인증 에러 → "Gemini 인증이 필요합니다. 별도 터미널 창을 열어서 `gemini auth login`을 실행해주세요."
- Copilot 라이센스 없음 → "Copilot 구독이 필요합니다. https://github.com/features/copilot 에서 구독하거나, 건너뛰어도 됩니다."
- 타임아웃 → "응답이 너무 느립니다. 네트워크 상태를 확인해주세요."

실패한 AI에 대해 AskUserQuestion (한번에, 실패한 AI 전체를 묶어서):
질문: "{실패 AI 목록} 연결에 실패했습니다. 어떻게 하시겠어요?"
선택지:
- A) 전체 재시도 (최대 1회)
- B) 실패한 AI 건너뛰고 진행
- C) 셋업 종료 — 나중에 `/agora-setup`으로 다시 설정

재시도는 **1회만** 허용합니다. 재시도 후에도 실패하면 자동으로 건너뛰기로 처리합니다.

**최소 AI 요건:**

Gemini + Copilot 중 최소 1개가 연결되어야 합니다 (Claude는 항상 가용).
- 2개 성공: "3개 AI 준비 완료!"
- 1개 성공: "⚠️ 2개 AI로 진행합니다. 비교 정확도가 떨어질 수 있습니다."
- 0개 성공: "❌ 외부 AI가 모두 실패했습니다. Claude 단독 리뷰만 가능합니다. 멀티 AI 비교를 원하면 `/agora-setup`으로 재설정해주세요."
  선택지:
  - A) Claude 단독 리뷰로 진행
  - B) 셋업 종료

**셋업 완료:**

```
━━━ 설정 완료! ━━━━━━━━━━━━━━━━━━━━━━━━━━━

  AI          상태        모델
  ──────────  ─────────  ──────────────
  🐶 Claude   ✅ 자동     {세션 모델}
  🐻 Gemini   ✅ CLI      {선택한 모델}
  🐱 Copilot  ✅ CLI      Sonnet 4.6
  📋 GitLab   ✅ 토큰     설정됨
  🎙️ MC       ✅ 자동     {세션 모델} (중재자)

  리뷰를 시작할 수 있습니다!
```

리뷰 대상 선택으로 넘어갑니다.

### READY인 경우 — 바로 리뷰 진행

.env.agora를 Bash로 읽어서 설정 상태를 간단히 표시합니다:
```
source $HOME/Developer/agora/.env.agora 2>/dev/null
echo "GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.0-flash}"
echo "ANTHROPIC_MODEL=${ANTHROPIC_MODEL:-감지 안 됨}"
```

```
🏛️ Agora 준비 완료!
```

아래 "리뷰 대상 선택"으로 넘어갑니다.

## 리뷰 대상 선택

사용자에게 AskUserQuestion으로 리뷰 대상을 물어봅니다:

질문: "리뷰 대상을 알려주세요."
선택지:
- A) GitLab MR URL 입력 — MR URL을 붙여넣으면 자동으로 diff를 가져옵니다
- B) 최근 커밋 리뷰 — `git diff HEAD~1`로 최근 커밋의 변경사항을 리뷰합니다
- C) 스테이징 변경사항 — `git diff`로 현재 작업 중인 변경사항을 리뷰합니다
- D) 셋업만 완료 — 지금은 리뷰하지 않고 설정만 저장합니다

사용자가 $ARGUMENTS에 URL을 직접 입력한 경우 (예: `/agora-review https://your-gitlab.com/...`), 이 질문을 건너뛰고 바로 1단계로 진행합니다.

사용자가 D를 선택하면 여기서 종료합니다.
사용자가 A를 선택하면 "GitLab MR URL을 입력해주세요."라고 안내하고 **사용자의 다음 메시지를 URL로 받습니다** (AskUserQuestion을 다시 쓰지 않음. 사용자가 바로 URL을 타이핑하면 그것을 URL로 사용).
사용자가 B 또는 C를 선택하면 해당 git diff 명령어로 1단계를 시작합니다.

## 1단계: diff 획득

**모노레포 컨텍스트 감지:**

diff 획득 전에 Bash로 현재 프로젝트의 형제 프로젝트를 확인합니다:
```
echo "=== 모노레포 감지 ==="
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
PARENT=$(dirname "$REPO_ROOT" 2>/dev/null)
if [ -n "$PARENT" ] && [ "$PARENT" != "/" ]; then
  SIBLINGS=$(ls -d "$PARENT"/*/ 2>/dev/null | grep -v "$REPO_ROOT" | head -10)
  if [ -n "$SIBLINGS" ]; then
    echo "형제 프로젝트 발견:"
    echo "$SIBLINGS"
  else
    echo "형제 프로젝트 없음 (단독 레포)"
  fi
fi
```

형제 프로젝트가 감지되면 이 정보를 메모리에 보관합니다.
MC가 3단계에서 "하위 호환/호출자 검증"이 필요한 이슈를 만나면, 형제 프로젝트 경로에서 관련 코드를 Read로 확인합니다.
예: backend MR 리뷰 시, frontend/src/stores/build-store.ts에서 해당 API의 실제 호출 패턴을 확인.

사용자 입력을 확인합니다:

- **GitLab MR URL인 경우** (예: `https://your-gitlab.com/.../merge_requests/123`):
  URL에서 프로젝트 경로와 MR IID를 추출하고, Bash로 GitLab API를 호출하여 MR 정보와 diff를 가져옵니다:
  ```
  curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "https://your-gitlab.com/api/v4/projects/PROJECT_ID/merge_requests/MR_IID/changes"
  ```
  PROJECT_ID는 URL 인코딩된 프로젝트 경로 (예: `my-group%2Fmy-project%2Fbackend`)
  환경변수 GITLAB_TOKEN은 .env.agora 파일에서 로드합니다.

  **diff 정보를 먼저 표시합니다:**
  ```
  📋 MR #{IID}: {title}
     {변경 파일 수} 파일 변경 · {diff 줄 수}줄 · 상태: {state}

  리뷰를 시작합니다...
  ```

- **로컬 diff인 경우**: `git diff` 또는 `git diff HEAD~1` 명령어로 diff를 가져옵니다.
  ```
  📋 로컬 diff
     {변경 파일 수} 파일 변경 · {diff 줄 수}줄

  리뷰를 시작합니다...
  ```

- **아무 입력 없는 경우**: 현재 브랜치의 `git diff HEAD~1`을 사용합니다.

획득한 diff를 임시 파일(`/tmp/agora-diff-{timestamp}.txt`)에 저장합니다.

diff가 비어있으면: "변경사항이 없습니다. 리뷰할 내용이 없어요."로 안내하고 종료합니다.

diff가 3000줄을 초과하면:
"⚠️ diff가 {N}줄로 매우 큽니다. 일부 AI에서 잘림이 발생할 수 있습니다. 계속 진행할까요?"
선택지: A) 계속 진행 / B) 취소

## 2단계: AI 리뷰 수집

**진행 안내를 먼저 표시합니다:**

```
🏛️ 3개 AI에게 리뷰를 요청합니다. 1-2분 정도 걸릴 수 있어요.

🐶 Claude 리뷰 중... (자체 리뷰)
🐻 Gemini + 🐱 Copilot 호출 중... (CLI)
```

**2-A) Claude 리뷰 (자체 생성) — 스크립트 실행과 동시에 진행**

Bash 도구로 스크립트(2-B)를 실행한 직후, 스크립트 결과를 기다리는 동안 Claude Code 자신이 직접 diff를 읽고 리뷰합니다. 외부 API 호출 없음.

diff 내용을 분석하고, 아래를 한번에 생성합니다:
- MR 요약 (아래 가이드라인 참조)
- 발견한 이슈 (severity, 파일명, 줄번호, 설명, 개선 제안)
- 이슈 없으면 "이슈 없음"

**간결하게 작성합니다.** 이슈당 2-3줄이면 충분. 긴 설명은 웹 리포트에서.

**MR 요약 작성 가이드라인:**

처음 보는 사람도 "아, 이런 변경이구나"를 10초 안에 이해할 수 있게 작성합니다.

1) **한 줄 핵심**: 이 MR이 뭘 하는지 한 문장으로. 기술 용어 최소화.
   - 나쁜 예: "handleUnauthorized 함수의 분기 로직을 리팩토링"
   - 좋은 예: "로그아웃할 때 거쳐가던 대기 화면을 없애고, 바로 메인 페이지로 이동하게 변경"

2) **일상 비유**: 코드 변경을 일상적인 상황에 비유. 구체적일수록 좋음.
   - 나쁜 예: "시스템을 개선했습니다"
   - 좋은 예: "퇴근할 때 '안녕히 가세요' 로비에서 3초 기다리던 걸 없애고, 출구로 바로 나가게 만든 것"

3) **왜 이 변경이 필요한지**: 배경을 한 문장으로.
   - 예: "기존에는 로그아웃 후 3초 대기 화면이 있어서 사용자 경험이 불편했습니다."

4) **뭐가 바뀌는지 구체적으로**: 사용자가 체감할 변화를 나열.
   - 예: "로그아웃 → 바로 메인 페이지 이동, 중복 리다이렉트 방지, 세션 오류 시 처리 개선"

5) **형식**: 3-5문장. 첫 문장이 비유, 나머지가 구체적 설명.

예시:
```
백화점에서 퇴근하는 고객이 "안녕히 가세요" 로비에서 3초 기다리던 절차를 없애고, 
바로 정문으로 나가게 만든 MR입니다.

기존에는 로그아웃 시 /logout 페이지를 거쳐 3초 후 리다이렉트했는데, 
이제는 바로 /main으로 이동합니다. 여러 번 동시에 로그아웃 요청이 들어와도 
꼬이지 않도록 중복 방지 장치도 추가했고, 세션 만료나 중복 로그인 시 
처리 방식도 개선했습니다.
```

이 리뷰 결과를 메모리에 보관합니다 (3단계에서 MC 역할 시 사용).

**필수: 한국어 오타/맞춤법 교정 (모든 출력에 적용)**

Gemini/Copilot의 한국어 응답에서 LLM 토크나이저 오류로 자모 조합이 깨지는 경우가 있습니다.
MC가 모든 텍스트를 출력하기 전에 반드시 교정합니다:
- 자모 깨짐: "멈쫈는지" → "멈췄는지", "됬습니다" → "됐습니다" 등
- 맞춤법: "되요" → "돼요", "않됩니다" → "안 됩니다" 등
- 비유/설명문의 어색한 표현을 자연스럽게 다듬기
- 원문의 기술적 의미는 절대 변경하지 않음, 표기/표현만 교정
이 규칙은 MR 요약, 이슈 설명, 웹 리포트, 터미널 출력 등 모든 한국어 텍스트에 적용합니다.

**2-B) Gemini + Copilot 리뷰 (병렬 CLI 호출)**

Bash 도구로 **2개 스크립트를 동시에 실행**합니다:
```
cd $HOME/Developer/agora && \
npx tsx scripts/agora-review.ts --gemini-only /tmp/agora-diff-{timestamp}.txt > /tmp/agora-gemini-result.json 2>&1 & \
npx tsx scripts/agora-review.ts --copilot-only /tmp/agora-diff-{timestamp}.txt > /tmp/agora-copilot-result.json 2>&1 & \
wait
```

`&`로 백그라운드 실행 + `wait`로 둘 다 끝날 때까지 대기. Gemini와 Copilot이 **동시에** 호출됩니다.

결과는 2개의 JSON 파일에 저장됩니다:
- `/tmp/agora-gemini-result.json` — Gemini 리뷰 결과
- `/tmp/agora-copilot-result.json` — Copilot 리뷰 결과

두 파일을 Bash로 읽습니다:
```
cat /tmp/agora-gemini-result.json
cat /tmp/agora-copilot-result.json
```

**완료 표시:**

```
🐶 Claude ✅ 완료
🐻 Gemini ✅ 완료 ({소요 시간})
🐱 Copilot ✅ 완료 ({소요 시간})
```

실패한 AI가 있으면 구체적 에러 메시지와 복구 안내를 표시합니다:
- "🐻 Gemini ❌ 실패: 인증이 만료되었을 수 있습니다. `gemini auth login`을 실행해주세요."
- "🐱 Copilot ❌ 실패: 타임아웃. 네트워크를 확인해주세요."

## 3단계: 리포트 생성

스크립트 출력(JSON)을 읽고, Claude 자체 리뷰와 합쳐서 리포트를 생성합니다.

### 분류 기준
- **같은 이슈 판정**: 같은 파일 내 ±5줄 이내 + 동일 주제 → 같은 이슈
- **그 외**: description의 의미적 유사도로 판단

### 분류 카테고리
- **합의** (2+ AI 동일 이슈): 높은 확신. 우선 수정 권장.
- **고유** (1 AI만 발견): 참고용. 해당 AI 이름 표시.
- **충돌** (AI 간 명시적 의견 차이): 양쪽 근거를 함께 표시. MC 판정 포함.

### MC 합의 재검증 (🔴 필수 이슈만)

합의(2/3 또는 3/3) 이슈 중 🔴 필수로 분류된 것은 MC가 반드시 독립적으로 재검증합니다.
**"합의 = 높은 확신"이라는 전제를 맹신하지 않습니다. 3개 AI가 모두 틀릴 수 있습니다.**

재검증 절차:
1. 해당 이슈의 전제를 식별 (예: "구버전 클라이언트가 undefined를 보낼 수 있다")
2. 전제가 프로젝트 코드에서 실제로 성립하는지 확인:
   - Read 도구로 관련 파일을 직접 열어서 확인
   - 특히 "하위 호환/regression/API 스키마 변경" 관련 이슈는 **주 호출자 코드를 반드시 확인**
   - 모노레포인 경우 형제 프로젝트(web, runner 등)의 해당 호출 코드를 찾아봄
3. 전제가 성립하지 않으면:
   - severity를 🔴→🟡 또는 "이슈 아님"으로 강등
   - JSON에 `"needsVerification": false` + `"mcVerdict"` 필드에 검증 결과 기록
4. 전제가 성립하면: 🔴 유지, `"needsVerification": false`, `"mcVerdict"` 에 확인 내용
5. 전제를 확인할 수 없으면: `"needsVerification": true`, `"mcVerdict"` 에 판단 불가 사유

`mcVerdict` 필드 형식:
```json
{
  "mcVerdict": {
    "result": "강등" | "유지" | "미검증",
    "reason": "frontend/build-store.ts에서 notifyOnCreate 기본값이 false. 의도적 opt-in 설계.",
    "evidence": "build-store.ts:42 → notifyOnCreate: false",
    "originalSeverity": "error"
  }
}
```

웹 리포트에서 `mcVerdict`가 있는 이슈는 desc 아래에 **별도 MC 재검증 박스**로 표시:
```
🎙️ MC 재검증 결과: {강등/유지/미검증}
   {reason}
   근거: {evidence}
```
이 박스는 이슈 desc와 분리되어 시각적으로 구분됩니다.

AI 응답에 "[가설: 호출자 확인 필요]"가 포함된 이슈는 자동으로 재검증 대상입니다.

### Cross-project 검증 프로토콜

모노레포 환경에서 형제 프로젝트(web, server, runner 등)의 코드를 참조해야 할 때,
**로컬 working tree 파일을 직접 읽지 마세요.** 로컬 파일은 main 브랜치 기준이라 MR의 source branch 코드와 다를 수 있습니다.

대신 GitLab API 기반 헬퍼 스크립트를 사용합니다:

1. **형제 프로젝트 파일 조회** (MR source branch 기준):
   ```bash
   cd $HOME/Developer/agora && npx tsx scripts/fetch-sibling-file.ts "my-group/my-project/{프로젝트명}" "{파일경로}" "{source_branch 또는 ref}"
   ```
   예: `npx tsx scripts/fetch-sibling-file.ts "my-group/my-project/frontend" "src/stores/build-store.ts" "feature/my-branch"`

2. **형제 프로젝트 관련 MR 검색**:
   ```bash
   cd $HOME/Developer/agora && npx tsx scripts/find-related-sibling-mrs.ts "my-group/my-project/{프로젝트명}" "{검색 키워드}"
   ```
   예: `npx tsx scripts/find-related-sibling-mrs.ts "my-group/my-project/frontend" "BuildMachineStatus"`

MC 재검증 시 이 스크립트를 호출하여 cross-project 전제를 검증합니다.
검증 과정을 JSON의 `verificationAudit` 필드에 기록합니다:

```json
{
  "verificationAudit": {
    "crossProjectChecks": [
      {
        "project": "frontend",
        "file": "src/stores/build-store.ts",
        "ref": "develop",
        "method": "gitlab-api",
        "finding": "notifyOnCreate 필드가 optional로 선언됨. 기본값 없음."
      }
    ],
    "localOnly": false
  }
}
```

- `method`: `"gitlab-api"` (헬퍼 사용) 또는 `"local-read"` (로컬 파일 직접 읽음)
- `localOnly`: 모든 cross-project 확인이 로컬 파일로만 이루어졌으면 `true`. 웹 리포트에 경고 배너 표시.

### Severity 아이콘
- 🔴 필수: 반드시 수정해야 하는 버그/보안 이슈
- 🟡 권장: 수정하면 좋은 이슈
- 🔵 참고: 알아두면 좋은 사항

### 터미널 출력

터미널에는 **요약만** 출력합니다. 상세 내용은 웹 리포트에서 봅니다.

```
🏛️ Agora 리뷰 완료!

🔴 N건  🟡 N건  🔵 N건 | 합의 N건 · 고유 N건 · 충돌 N건

웹 리포트를 열고 있습니다...
```

터미널에 이슈 상세 내용, 코드 스니펫, 개선안 등을 출력하지 않습니다. 전부 웹 리포트에서 보여줍니다.

### 출력 원칙
1. **파일 기준으로 그룹핑**: 같은 파일의 이슈는 묶어서 보여줌. 사용자가 파일 하나씩 열어서 고칠 때 편리.
2. **severity 순서**: 🔴 → 🟡 → 🔵. 중요한 것부터.
3. **합의 표시는 뱃지로**: `👥 🐶🐻🐱 합의 (3/3)` 또는 `👤 🐱 Copilot만 발견`. 본문 아래에 작게.
4. **충돌은 별도 섹션**: 의견이 갈린 것은 MC 판정과 함께 독립 섹션으로.
5. **액션 아이템은 체크리스트**: 리뷰 끝에 "그래서 뭘 해야 하는데?"를 명확히.
6. **MC 판정에 프로젝트 컨텍스트 활용**: MC(Claude Code)는 프로젝트 구조를 알고 있으므로, 일반론이 아닌 이 프로젝트에 맞는 판단을 내림.
7. **모든 이슈에 코드 스니펫 포함**: 이슈를 설명할 때 관련 diff 코드를 함께 보여줌. 코드 없이 텍스트만 있는 이슈 카드는 없어야 함.
8. **개선안은 코드로 보여줌**: 텍스트 설명뿐 아니라 "현재 코드 → 개선안 코드"를 before/after로 표시. 사용자가 바로 복붙할 수 있게.
9. **복사 버튼 포함**: 각 이슈 카드의 before/after 코드 비교 아래에 "📋 이 수정사항을 Claude Code에 요청하기" 버튼을 추가. 클릭하면 해당 이슈를 Claude Code에서 바로 수정할 수 있는 상세 프롬프트(파일 경로, 줄번호, 현재 코드, 개선 방향)가 클립보드에 복사됨. HTML에서 `<button class="copy-lg" onclick="copyPrompt(this)" data-prompt="프롬프트 내용">📋 이 수정사항을 Claude Code에 요청하기</button>` 형태로 구현. 웹 리포트 기본 테마는 라이트 모드. (`<html data-theme="light">`)

스크립트 실행 중 에러가 있으면 (일부 AI 실패 등) "한눈에 보기" 섹션에 경고를 함께 표시합니다.

## 4단계: 웹 리포트

터미널 출력 후, 반드시 웹 리포트를 생성하고 브라우저에서 엽니다.

**JSON 데이터 생성 → 스크립트로 HTML 한번에 변환 (빠름)**

1. 3단계의 분류 결과를 JSON 파일로 생성합니다. Write 도구로 `/tmp/agora-report-data.json`에 저장:

```json
{
  "title": "MR #{번호} — {제목}",
  "summary": {
    "text": "{MR 요약. 비유 포함. 오타 교정 완료.}",
    "fileGroups": [
      { "dir": "src/apis/v1/build-result/", "tags": ["controller", "route", "service"] },
      { "dir": "src/middlewares/", "tags": ["validator"] }
    ]
  },
  "stats": {
    "total": 10, "error": 1, "warning": 6, "info": 3,
    "consensus": 3, "solo": 5, "conflict": 1,
    "fileCount": 6, "diffLines": 302
  },
  "participants": [
    { "key": "c", "icon": "🐶", "name": "Claude", "model": "{세션 모델명}" },
    { "key": "g", "icon": "🐻", "name": "Gemini", "model": "{선택한 모델}" },
    { "key": "p", "icon": "🐱", "name": "Copilot", "model": "{선택한 모델}" },
    { "key": "mc", "icon": "🎙️", "name": "MC", "model": "{세션 모델명}" }
  ],
  "duration": {
    "total": "{총 소요}",
    "perAi": { "claude": "자체", "gemini": "{시간}", "copilot": "{시간}" }
  },
  "fileGroups": [
    {
      "file": "{파일 경로}",
      "issues": [
        {
          "severity": "error",
          "loc": ":{줄번호}",
          "name": "{이슈 제목}",
          "consensus": true,
          "consensusLabel": "합의 3/3",
          "desc": "{이슈 설명. 오타 교정 완료.}",
          "fix": "{개선 제안}",
          "codeSnippet": "{diff 코드. +줄/-줄 형식 유지}",
          "comparison": { "before": "{현재 코드}", "after": "{개선 코드}" },
          "prompt": "{Claude Code 수정 프롬프트: 파일경로, 줄번호, 현재코드, 개선방향}"
        }
      ]
    }
  ],
  "conflicts": [
    {
      "title": "{파일:줄 — 주제}",
      "opinions": [
        { "key": "g", "icon": "🐻", "name": "Gemini", "text": "{의견}" },
        { "key": "p", "icon": "🐱", "name": "Copilot", "text": "{의견}" },
        { "key": "c", "icon": "🐶", "name": "Claude", "text": "{의견}" }
      ],
      "verdict": "{MC 판정. 프로젝트 컨텍스트 기반.}"
    }
  ],
  "infos": [
    { "file": "{파일:줄}", "text": "{내용}", "badge": "🐻" }
  ],
  "actions": [
    { "severity": "error", "file": "{파일명}", "text": "{할 일}" }
  ],
  "date": "{YYYY-MM-DD}",
  "verificationAudit": {
    "crossProjectChecks": [
      {
        "project": "{형제 프로젝트명}",
        "file": "{확인한 파일}",
        "ref": "{branch 또는 commit}",
        "method": "gitlab-api",
        "finding": "{발견 내용}"
      }
    ],
    "localOnly": false
  }
}
```

   JSON 생성 시 규칙:
   - 모든 텍스트에서 한국어 오타/맞춤법 교정 완료
   - codeSnippet: diff의 +줄/-줄 형식 그대로 유지 (스크립트가 하이라이팅 처리)
   - comparison: 가능한 경우 before/after 코드 포함
   - prompt: 파일 경로 + 줄번호 + 현재 코드 + 개선 방향 포함
   - fileGroups: 파일별 그룹핑 완료, 각 파일 내 severity 순 정렬
   - actions: 웹 리포트 이슈 순서와 동일하게 정렬
   - verificationAudit: MC 재검증 시 cross-project 확인 내역 기록. 헬퍼 스크립트 사용 시 method="gitlab-api", 로컬 파일만 읽은 경우 method="local-read" + localOnly=true

2. Bash로 리포트 생성 + 브라우저 열기:
   ```
   mkdir -p ~/.agora/reviews && cd $HOME/Developer/agora && npx tsx scripts/generate-report.ts /tmp/agora-report-data.json -o ~/.agora/reviews/{YYYY-MM-DD}-{MR번호 또는 local}-review.html && open ~/.agora/reviews/{파일명}
   ```

3. 사용자에게 안내:
   ```
   🌐 웹 리포트를 브라우저에서 열었습니다.
      파일: ~/.agora/reviews/{파일명}
   ```

## 5단계: 수정 항목 선택 및 자동 수정 (개발 중)

웹 리포트를 연 후, AskUserQuestion(multiSelect: true)으로 수정할 항목을 선택하게 합니다.

**수정 전 안전 확인:**

먼저 현재 작업 디렉토리에 커밋되지 않은 변경사항이 있는지 Bash로 확인합니다:
```
git status --short
```

변경사항이 있으면 사용자에게 안내합니다:
"⚠️ 커밋되지 않은 변경사항이 있습니다. 자동 수정 전에 커밋하거나 stash해두는 것을 권장합니다."

발견된 이슈 중 🔴 필수와 🟡 권장 이슈만 선택지로 제공합니다 (🔵 참고 제외).
**웹 리포트에 표시된 순서와 동일하게** 번호를 매깁니다 (파일별 그룹핑 → severity 순).
리포트의 이슈 목록과 선택지의 순서/번호가 1:1로 대응해야 합니다.

예시:
```
🏛️ 리뷰가 완료되었습니다. 수정할 항목을 선택하세요. (복수 선택 가능)
```

선택지 (AskUserQuestion의 multiSelect: true 사용):
- 1) 🔴 validator.ts:203 — 권한 체크를 위해 경로/메서드를 위조
- 2) 🟡 build-result-poller.ts:295,335 — N+1 쿼리
- 3) 🟡 auth.ts:52 — href vs replace 불일치
- ...

사용자가 항목을 선택하면:

1. 선택된 항목을 severity 순서로 정렬 (🔴 먼저)
2. 각 항목에 대해 순서대로 실제 코드를 수정합니다:
   - 해당 파일을 Read로 읽기
   - 3단계에서 생성한 개선안(before/after)을 기반으로 Edit으로 수정
   - 수정 후 "✅ {파일명}:{줄번호} — {이슈 제목} 수정 완료" 출력
3. 모든 수정이 끝나면:
   ```
   ━━━ 수정 완료 ━━━━━━━━━━━━━━━━━━━━━━━━━
   
   ✅ {N}건 수정 완료:
   - validator.ts:203 — 권한 체크 위조 제거
   - build-result-poller.ts:295 — N+1 쿼리 개선
   
   ⏭️ 건너뛴 항목: {M}건
   
   수정된 파일을 확인하고 커밋해주세요.
   ```
4. 수정된 내용을 보여줍니다:
   ```
   git diff --stat
   ```

5. 커밋 메시지를 생성하고 사용자에게 보여줍니다:
   수정한 항목들을 기반으로 커밋 메시지를 작성합니다. 형식:
   ```
   Agora 리뷰 반영: {수정 요약}
   
   - {파일명}: {수정 내용}
   - {파일명}: {수정 내용}
   
   Reviewed by: Agora (Claude + Gemini + Copilot)
   ```

   AskUserQuestion으로 커밋 여부를 물어봅니다:
   질문: "수정이 완료되었습니다. 커밋 & 푸시할까요?"
   선택지:
   - A) 커밋 & 푸시 — 위 메시지로 커밋하고 원격에 푸시합니다
   - B) 커밋만 — 커밋만 하고 푸시는 나중에
   - C) 커밋 메시지 수정 — 메시지를 직접 수정한 후 커밋
   - D) 건너뛰기 — 커밋하지 않고 종료 (나중에 직접 커밋)

   A 선택 시: `git add {수정된 파일들}` → `git commit -m "{메시지}"` → `git push`
   B 선택 시: `git add {수정된 파일들}` → `git commit -m "{메시지}"`
   C 선택 시: 사용자가 메시지를 입력하면 해당 메시지로 커밋
   D 선택 시: "문제가 있으면 `git checkout -- .`으로 되돌릴 수 있습니다."

사용자가 아무것도 선택하지 않거나 "건너뛰기"를 선택하면:
"수정 없이 리뷰만 완료합니다. 웹 리포트에서 개별 항목의 복사 버튼으로 나중에 수정할 수 있어요."

$ARGUMENTS
