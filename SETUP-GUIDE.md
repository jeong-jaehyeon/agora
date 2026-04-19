# 🏛️ Agora 설치 가이드

> 3개 AI에게 동시에 코드 리뷰를 받고, 결과를 비교해서 보여주는 도구입니다.

## 설치 (5분)

### 1. agora 폴더를 받으세요

팀원에게 `agora.zip`을 전달받았다면:

```bash
unzip agora.zip -d ~/Developer/
```

또는 폴더를 직접 복사:
```bash
cp -r /전달받은경로/agora ~/Developer/agora
```

> **중요:** `~/Developer/agora` 경로에 놓아야 합니다.

### 2. 의존성 설치

```bash
cd ~/Developer/agora
yarn install
```

### 3. 글로벌 커맨드 등록

이 명령어를 실행하면 어떤 프로젝트에서든 `/agora-review`를 사용할 수 있습니다.

```bash
mkdir -p ~/.claude/commands
cp ~/Developer/agora/.claude/commands/agora-review.md ~/.claude/commands/
cp ~/Developer/agora/.claude/commands/agora-setup.md ~/.claude/commands/
```

### 4. 끝!

아무 프로젝트에서 Claude Code를 열고:

```
/agora-review
```

처음 실행하면 자동으로 설정 대화가 시작됩니다.

---

## 첫 실행 시 무슨 일이 일어나나요?

```
🏛️ 안녕하세요! Agora입니다.

코드 리뷰를 3개 AI(Claude, Gemini, Copilot)에게 동시에 맡기고,
누가 뭘 발견했는지 비교해서 보여주는 도구예요.

처음이시네요! 간단한 설정부터 시작할게요.
```

로컬 환경을 자동으로 스캔해서 이미 있는 API 키나 인증 정보를 찾아줍니다.
각 AI마다 선택지가 나오고, 기존 키가 있으면 "이 키를 사용할까요?"로 물어봅니다.

### 필요한 인증 정보

| AI | 필요한 것 | 없으면? |
|----|-----------|---------|
| 🐶 Claude | 별도 설정 불필요 (Claude Code 세션 사용) | - |
| 🐻 Gemini | `gemini` CLI + Google OAuth | `gemini auth login` 실행 |
| 🐱 Copilot | `gh auth login` + `gh copilot` 확장 | 안내해줌 |
| 📋 GitLab | GitLab Private Token | MR URL 사용 시만 필요 |

설정이 끝나면 연결 테스트를 자동으로 해줍니다.

---

## 사용법

### GitLab MR 리뷰
```
/agora-review https://gitlab.nexon.com/qualitysolution/tovice/tovice-server/-/merge_requests/131
```

### 최근 커밋 리뷰
```
/agora-review
→ "최근 커밋 리뷰" 선택
```

### 결과

1-2분 후 브라우저에서 웹 리포트가 자동으로 열립니다:
- 🔴 필수 / 🟡 권장 / 🔵 참고 분류
- 3개 AI가 합의한 이슈는 높은 확신
- 의견이 갈린 이슈는 MC가 판정
- 체크박스로 할 일 관리

---

## 문제가 생기면

### 설정을 다시 하고 싶을 때
```
/agora-setup
```

### Gemini가 안 될 때
```bash
gemini auth login
```

### Copilot이 안 될 때
```bash
gh auth login
gh extension install github/gh-copilot
```

### 그래도 안 되면
```bash
# 설정 파일 확인
cat ~/Developer/agora/.env.agora
```

---

## 참고

- 리뷰 결과는 `~/.agora/reviews/`에 자동 저장됩니다
- 다크/라이트 모드는 리포트 오른쪽 상단 🌙/☀️ 버튼
- 최소 2개 AI가 설정되어야 사용 가능
