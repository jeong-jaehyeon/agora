# Agora Review — 멀티 AI 코드 리뷰

## 0단계: 셋업 확인

먼저 Bash로 `.env.agora` 파일이 있는지 확인합니다:
```
test -f $HOME/Developer/agora2/.env.agora && echo "READY" || echo "NEEDS_SETUP"
```

### NEEDS_SETUP인 경우 — 초기 셋업 대화

**환영 메시지를 먼저 표시합니다:**

```
🏛️ 안녕하세요! Agora입니다.

코드 리뷰를 3개 AI(Claude, Gemini, Copilot)에게 동시에 맡기고,
누가 뭘 발견했는지 비교해서 보여주는 도구예요.
합의한 이슈는 높은 확신으로, 의견이 갈린 이슈는 MC가 판정해드립니다.

처음이시네요! 환경을 확인하고 설정을 도와드릴게요.
```

**사전 조건 확인 (Pre-flight Check):**

먼저 Agora가 동작하기 위한 기본 조건을 확인합니다:
```
echo "=== Pre-flight Check ==="
echo "NODE: $(node --version 2>/dev/null || echo '미설치')"
echo "YARN: $(yarn --version 2>/dev/null || echo '미설치')"
echo "NPX: $(npx --version 2>/dev/null || echo '미설치')"
echo "AGORA_DIR: $(test -d $HOME/Developer/agora2/scripts && echo 'OK' || echo '미발견')"
echo "AGORA_DEPS: $(test -d $HOME/Developer/agora2/node_modules && echo 'OK' || echo '미설치')"
```

사전 조건 실패 시 먼저 해결합니다:
- Node 미설치 → "Node.js가 필요합니다. `brew install node`를 실행해주세요."
- agora2 디렉토리 미발견 → "agora2가 ~/Developer/agora2에 설치되어 있어야 합니다. SETUP-GUIDE.md를 확인해주세요."
- node_modules 미설치 → "의존성을 설치합니다..." → Bash로 `cd $HOME/Developer/agora2 && yarn install` 자동 실행

사전 조건이 모두 통과하면 환경 스캔으로 넘어갑니다.

**환경 스캔:**

Bash로 로컬 환경을 깊이 스캔합니다 (zshrc, bashrc, zprofile, zshenv, config 파일 모두 확인):
```
echo "=== 환경 스캔 ==="
echo "--- Claude ---"
[ -n "$ANTHROPIC_API_KEY" ] && echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:10}..." || echo "ANTHROPIC_API_KEY: 없음"
[ "$CLAUDE_CODE_USE_BEDROCK" = "1" ] && echo "BEDROCK: 사용 중" || echo "BEDROCK: 미사용"
[ -n "$ANTHROPIC_MODEL" ] && echo "MODEL: $ANTHROPIC_MODEL" || echo "MODEL: 감지 안 됨"
grep -h "ANTHROPIC_API_KEY" ~/.zshrc ~/.bashrc ~/.zprofile ~/.zshenv 2>/dev/null | grep -v "^#" | head -1 || true
echo "--- Gemini ---"
which gemini 2>/dev/null && echo "GEMINI_CLI: $(gemini --version 2>/dev/null | head -1)" || echo "GEMINI_CLI: 미설치"
echo "--- Copilot ---"
which gh 2>/dev/null && echo "GH_CLI: $(gh --version 2>/dev/null | head -1)" || echo "GH_CLI: 미설치"
gh auth status 2>&1 | head -3
gh copilot --version 2>/dev/null && echo "COPILOT_EXT: 설치됨 ($(gh copilot --version 2>/dev/null | head -1))" || echo "COPILOT_EXT: 미설치"
echo "--- GitLab ---"
[ -n "$GITLAB_TOKEN" ] && echo "GITLAB_TOKEN: ${GITLAB_TOKEN:0:10}..." || echo "GITLAB_TOKEN: 없음"
[ -n "$GITLAB_PRIVATE_TOKEN" ] && echo "GITLAB_PRIVATE_TOKEN: ${GITLAB_PRIVATE_TOKEN:0:10}..." || echo "GITLAB_PRIVATE_TOKEN: 없음"
grep -h "GITLAB_TOKEN\|GITLAB_PRIVATE_TOKEN" ~/.zshrc ~/.bashrc ~/.zprofile ~/.zshenv 2>/dev/null | grep -v "^#" | head -1 || true
echo "--- Claude Code ---"
echo "SESSION_MODEL: ${ANTHROPIC_MODEL:-감지 안 됨}"
```

추가로 Claude memory에 저장된 GitLab 토큰이 있는지도 확인합니다.

**스캔 결과를 대시보드 형태로 보여줍니다:**

```
━━━ 환경 스캔 결과 ━━━━━━━━━━━━━━━━━━━━━━━

  도구        상태              비고
  ──────────  ───────────────  ──────────────────
  🐶 Claude   ✅ Bedrock       AWS 인증 사용
  🐻 Gemini   ✅ CLI v0.37.0   인증 필요 여부 확인
  🐱 Copilot  ⚠️ 확장 미설치    gh는 있음, 확장만 설치하면 OK
  📋 GitLab   ✅ 토큰 발견      memory에서 확인
  🎙️ MC       ✅ Opus 4.6      Claude Code 세션 모델

  준비됨: 2/3 AI  |  1건 조치 필요
```

이 대시보드를 보고 사용자가 전체 상황을 한눈에 파악할 수 있게 합니다.

**각 AI별 AskUserQuestion으로 확인 (4개 모두 물어봅니다):**

각 AI 설정을 물어볼 때, 스캔 결과에 따라 선택지를 동적으로 구성합니다.
이미 준비된 AI는 간단히 확인만, 설치가 필요한 AI는 자동 설치를 제안합니다.

**1) Claude** — 스캔 결과에 따라 선택지 구성:

- Bedrock 감지 시:
  질문: "Claude는 AWS Bedrock 경유로 사용 중입니다."
  선택지:
  - A) Bedrock 사용 (권장, 기존 AWS 인증 그대로)
  - B) Anthropic API 키 직접 입력

- ANTHROPIC_API_KEY 발견 시:
  질문: "Anthropic API 키가 있습니다 ({앞 10자}...)."
  선택지:
  - A) 이 키 사용 (권장)
  - B) 새 키 입력

- 둘 다 없을 때:
  질문: "Claude API 키를 찾지 못했습니다. Claude Code 구독과는 별개로 API 키를 따로 만들어야 합니다."
  선택지:
  - A) API 키 입력 — Anthropic 콘솔(https://console.anthropic.com)에서 발급
  - B) 건너뛰기 — Claude 리뷰어 없이 진행 (MC 역할은 계속 수행)

**2) Gemini** — 스캔 결과에 따라 선택지 구성:

- CLI 설치됨:
  질문: "Gemini CLI가 설치되어 있습니다 (v{버전})."
  선택지:
  - A) 이대로 사용 (권장)
  - B) 건너뛰기

  A 선택 시 모델 선택:
  질문: "Gemini 모델을 선택해주세요."
  선택지:
  - A) Gemini 2.0 Flash (권장, 빠르고 무료)
  - B) Gemini 2.5 Pro (더 정확, 유료 플랜 필요할 수 있음)
  - C) Gemini 2.5 Flash (균형형)

  .env.agora에 GEMINI_MODEL=선택한모델 저장

- CLI 미설치:
  질문: "Gemini CLI가 설치되지 않았습니다."
  선택지:
  - A) 자동 설치 시도 — Bash로 `npm install -g @anthropic-ai/gemini-cli 2>/dev/null || brew install gemini 2>/dev/null` 실행. 실패하면 https://github.com/google-gemini/gemini-cli 안내.
  - B) 건너뛰기

  A에서 설치 성공 시:
  "✅ Gemini CLI 설치 완료! `gemini auth login`으로 인증이 필요합니다."
  → Bash로 `! gemini auth login` 안내

**3) GitHub Copilot** — 단계별 자동 해결:

스캔 결과에 따라 **해결 가능한 건 자동으로 해결을 제안**합니다.

- gh CLI 미설치:
  질문: "GitHub CLI(gh)가 필요합니다."
  선택지:
  - A) 자동 설치 — Bash로 `brew install gh` 실행
  - B) 건너뛰기 — Copilot 없이 진행 (Claude + Gemini로 충분합니다)

  A에서 설치 성공 → 자동으로 다음 단계(인증)로 진행

- gh 설치됨 + 인증 안 됨:
  질문: "GitHub 로그인이 필요합니다."
  선택지:
  - A) 지금 인증 — "터미널에서 `! gh auth login`을 실행해주세요. 완료되면 엔터를 눌러주세요."
  - B) 건너뛰기

- gh 인증됨 + copilot 확장 미설치:
  질문: "Copilot CLI 확장을 설치할까요? (자동)"
  선택지:
  - A) 설치 — Bash로 `gh extension install github/gh-copilot` 자동 실행
  - B) 건너뛰기

- 전부 OK:
  질문: "GitHub Copilot이 준비되어 있습니다 (Sonnet 4.6)."
  선택지:
  - A) 이대로 사용 (권장)
  - B) 건너뛰기

참고: Copilot은 유료 구독(Individual $10/월, Business $19/월)이 필요합니다.

**4) GitLab** — 스캔 결과에 따라 선택지 구성:

- 환경변수 또는 memory에서 토큰 발견 시:
  질문: "GitLab 토큰이 있습니다 ({앞 10자}...)."
  선택지:
  - A) 이 토큰 사용 (권장)
  - B) 새 토큰 입력
  - C) 건너뛰기 — 로컬 git diff만 사용

- 없을 때:
  질문: "GitLab MR URL로 리뷰하려면 토큰이 필요합니다."
  선택지:
  - A) 토큰 입력 — GitLab → Settings → Access Tokens에서 발급
  - B) 건너뛰기 — 로컬 git diff만 사용

**연결 테스트:**

모든 설정이 끝나면 `.env.agora` 파일을 생성하고, 설정된 AI의 연결을 테스트합니다.

"설정을 저장하고 연결을 확인합니다..."

Bash로 테스트 실행:
```
cd $HOME/Developer/agora2 && npx tsx scripts/agora-review.ts --test
```

테스트 결과를 대시보드로 보여줍니다:
```
━━━ 연결 테스트 ━━━━━━━━━━━━━━━━━━━━━━━━━━

  AI          상태              응답 시간
  ──────────  ───────────────  ──────────
  🐻 Gemini   ✅ 정상           1.2초
  🐱 Copilot  ✅ 정상           2.5초
```

실패한 AI가 있으면 원인별 복구 안내 + 재시도 옵션:

```
  🐱 Copilot  ❌ 실패           —
     원인: Copilot 구독이 필요합니다
     조치: 구독 없이도 Claude + Gemini 2개 AI로 리뷰 가능합니다
```

실패 시 AskUserQuestion:
질문: "{AI명} 연결에 실패했습니다."
선택지:
- A) 재시도 — 다시 테스트 실행
- B) 설정 변경 — 해당 AI 설정으로 돌아가기
- C) 건너뛰기 — 이 AI 없이 진행

2개 이상 성공하면 진행 가능.
전체 실패 시: "❌ 모든 AI 연결에 실패했습니다. `/agora-setup`으로 재설정해주세요."

**셋업 완료:**

```
━━━ 설정 완료! ━━━━━━━━━━━━━━━━━━━━━━━━━━━

  AI          상태        모델
  ──────────  ─────────  ──────────────
  🐶 Claude   ✅ Bedrock  Opus 4.6
  🐻 Gemini   ✅ CLI      2.0 Flash
  🐱 Copilot  ✅ CLI      Sonnet 4.6
  📋 GitLab   ✅ 토큰     설정됨
  🎙️ MC       ✅ 자동     Opus 4.6

  3개 AI + MC 준비 완료! 리뷰를 시작할 수 있습니다.
```

리뷰 대상 선택으로 넘어갑니다 (아래 "리뷰 대상 선택" 참조).

만약 설정된 AI가 2개 미만이면:
"최소 2개 AI가 필요합니다." → 부족한 AI 설정으로 돌아갑니다.

### READY인 경우 — 바로 리뷰 진행

.env.agora를 Bash로 읽어서 설정 상태를 간단히 표시합니다:
```
source $HOME/Developer/agora2/.env.agora 2>/dev/null
echo "CLAUDE_USE_BEDROCK=${CLAUDE_USE_BEDROCK:-0}"
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

사용자가 $ARGUMENTS에 URL을 직접 입력한 경우 (예: `/agora-review https://gitlab.nexon.com/...`), 이 질문을 건너뛰고 바로 1단계로 진행합니다.

사용자가 D를 선택하면 여기서 종료합니다.
사용자가 A를 선택하면 URL을 입력받고 1단계로 진행합니다.
사용자가 B 또는 C를 선택하면 해당 git diff 명령어로 1단계를 시작합니다.

## 1단계: diff 획득

사용자 입력을 확인합니다:

- **GitLab MR URL인 경우** (예: `https://gitlab.nexon.com/.../merge_requests/123`):
  URL에서 프로젝트 경로와 MR IID를 추출하고, Bash로 GitLab API를 호출하여 MR 정보와 diff를 가져옵니다:
  ```
  curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "https://gitlab.nexon.com/api/v4/projects/PROJECT_ID/merge_requests/MR_IID/changes"
  ```
  PROJECT_ID는 URL 인코딩된 프로젝트 경로 (예: `qualitysolution%2Ftovice%2Ftovice-server`)
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

**2-A) Claude 리뷰 (자체 생성)**

Claude Code 자신이 직접 diff를 읽고 리뷰합니다. 외부 API 호출 없음.
diff 내용을 분석하고, 아래 형식으로 Claude의 리뷰를 생성합니다:
- MR 요약 (아래 가이드라인 참조)
- 발견한 이슈 (severity, 파일명, 줄번호, 설명, 개선 제안)
- 이슈 없으면 "이슈 없음"

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

**2-B) Gemini + Copilot 리뷰 (외부 CLI 호출)**

Bash 도구로 스크립트를 실행합니다:
```
cd $HOME/Developer/agora2 && npx tsx scripts/agora-review.ts /tmp/agora-diff-{timestamp}.txt
```

스크립트가 Gemini CLI와 Copilot CLI를 호출하여 각각 리뷰를 받고, 결과를 JSON으로 stdout에 출력합니다.

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

1. `$HOME/Developer/agora2/scripts/report-template.html`을 읽어서 구조를 참고합니다.
2. 3단계의 리뷰 결과를 HTML로 작성합니다. 템플릿의 스타일과 구조를 그대로 사용하되, 실제 데이터로 채웁니다.
   - 대시보드: severity 카운트, AI 합의 수, 참여 AI + 모델명
   - MR 요약: 위 가이드라인에 따라 작성 (한 줄 핵심 + 일상 비유 + 배경 + 구체적 변화. 3-5문장)
   - 이슈 카드: 파일별 그룹핑, 접이식, severity 색상, 합의/고유 뱃지
   - 이슈 카드의 코드 스니펫: **모든 이슈에** 해당 diff 코드를 포함합니다.
     - 1단계에서 획득한 diff에서 해당 이슈의 파일 + 줄번호 주변 코드를 추출
     - 변경된 줄은 diff 형식으로 표시 (+는 추가, -는 삭제)
     - HTML에서 +줄은 class="diff-add", -줄은 class="diff-del"로 마크업
     - 코드 스니펫이 없는 이슈 카드가 있으면 안 됩니다 (일관성)
   - 이슈 카드의 개선안: 가능한 경우 "현재 코드"와 "개선안 코드"를 before/after로 나란히 표시. HTML에서 현재 코드는 class="code-before", 개선안 코드는 class="code-after"로 마크업. 사용자가 개선안을 바로 복붙할 수 있게.
   - 충돌 섹션: 각 AI 의견 + MC 판정
   - 액션 아이템: 체크박스 + 프로그레스 바
   - 푸터: 소요 시간 포함
3. 리포트를 `~/.agora/reviews/` 디렉토리에 저장합니다:
   ```
   mkdir -p ~/.agora/reviews
   ```
   파일명: `{YYYY-MM-DD}-{MR번호 또는 local}-review.html`
4. Bash로 브라우저에서 엽니다:
   ```
   open ~/.agora/reviews/{파일명}
   ```
5. 사용자에게 안내합니다:
   ```
   🌐 웹 리포트를 브라우저에서 열었습니다.
      파일: ~/.agora/reviews/{파일명}
   ```

## 5단계: 수정 항목 선택 및 자동 수정

웹 리포트를 연 후, AskUserQuestion(multiSelect: true)으로 수정할 항목을 선택하게 합니다.

발견된 이슈 중 🔴 필수와 🟡 권장 이슈만 선택지로 제공합니다 (🔵 참고 제외).
severity 순서로 번호를 매깁니다.

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

사용자가 아무것도 선택하지 않거나 "건너뛰기"를 선택하면:
"수정 없이 리뷰만 완료합니다. 웹 리포트에서 개별 항목의 복사 버튼으로 나중에 수정할 수 있어요."

$ARGUMENTS
