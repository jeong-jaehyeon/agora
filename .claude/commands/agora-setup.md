# Agora Setup — 설정 재설정

기존 설정을 초기화하고 처음부터 다시 설정합니다.

## 실행

1. 기존 `.env.agora` 파일을 백업합니다:
```
cp $HOME/Developer/agora2/.env.agora $HOME/Developer/agora2/.env.agora.bak 2>/dev/null || true
rm -f $HOME/Developer/agora2/.env.agora
```

2. 사용자에게 안내합니다:
```
🔧 Agora 재설정

기존 설정을 백업하고 (.env.agora.bak) 처음부터 다시 설정합니다.
문제가 생기면 백업 파일을 복원할 수 있어요:
cp ~/.agora/.env.agora.bak $HOME/Developer/agora2/.env.agora
```

3. `/agora-review`의 셋업 플로우 (0단계 NEEDS_SETUP)와 동일한 방식으로 진행합니다.
   환영 메시지부터 각 AI 설정까지 전부 다시 물어봅니다.

$ARGUMENTS
