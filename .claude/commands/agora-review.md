# Agora Review — 멀티 AI 코드 리뷰

사용자가 리뷰 대상을 제공합니다. MR URL 또는 로컬 diff입니다.

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
