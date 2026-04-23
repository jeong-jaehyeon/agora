# 🏛️ Agora 설치 가이드

## 이게 뭐야?

코드 리뷰를 3개 AI한테 동시에 시키고, 결과를 비교해서 보여주는 도구야.
Claude Code에서 `/agora-review` 치면 바로 실행돼.

## 설치 (3분)

터미널을 열고 아래 명령어를 **순서대로** 복붙해.

### 1단계: 폴더 준비

```bash
# zip 풀기 (에어드랍으로 받은 파일)
unzip ~/Downloads/agora.zip -d ~/Developer/
```

> 이미 `~/Developer/agora` 폴더가 있으면 이 단계 건너뛰어.

### 2단계: 의존성 설치

```bash
cd ~/Developer/agora
yarn install
```

### 3단계: 명령어 등록

```bash
mkdir -p ~/.claude/commands
cp ~/Developer/agora/.claude/commands/*.md ~/.claude/commands/
```

이걸 하면 **아무 프로젝트에서나** `/agora-review`를 쓸 수 있어.

### 끝!

```bash
# 아무 프로젝트 폴더에서 Claude Code 열고
claude

# 이렇게 치면 돼
/agora-review
```

처음 실행하면 Gemini, Copilot, GitLab 설정을 안내해줘. 그냥 선택지 따라가면 돼.

---

## 처음 실행하면 뭐가 나와?

```
🏛️ 안녕하세요! Agora입니다.

코드 리뷰를 3개 AI(Claude, Gemini, Copilot)에게 동시에 맡기고,
누가 뭘 발견했는지 비교해서 보여주는 도구예요.
```

그 다음 하나씩 물어봐:
- **Gemini** → `gemini` CLI가 설치되어 있으면 자동 감지. 없으면 건너뛰기 가능.
- **Copilot** → `gh copilot`이 있으면 자동 감지. 유료 구독 필요. 없으면 건너뛰기 가능.
- **GitLab** → MR URL로 리뷰하려면 토큰 필요. 로컬 diff만 쓸 거면 건너뛰기.

**최소 Gemini 또는 Copilot 중 1개만 있으면 돼.** Claude는 자동으로 참여해.

---

## 사용법

```bash
# GitLab MR 리뷰
/agora-review
# → "GitLab MR URL 입력" 선택 → URL 붙여넣기

# 최근 커밋 리뷰
/agora-review
# → "최근 커밋 리뷰" 선택
```

리뷰가 끝나면 브라우저에서 웹 리포트가 자동으로 열려.

---

## 안 될 때

| 증상 | 해결 |
|------|------|
| `/agora-review`가 안 먹혀 | 3단계(명령어 등록) 다시 해봐 |
| Gemini 연결 실패 | 터미널에서 `gemini auth login` 실행 |
| Copilot 연결 실패 | `gh auth login` → `gh extension install github/gh-copilot` |
| 설정 다시 하고 싶어 | `/agora-setup` 실행 |
| yarn install 안 돼 | `brew install node` 먼저 |

---

## 궁금한 거 있으면

`/agora-review` 치면 알아서 안내해줘.
