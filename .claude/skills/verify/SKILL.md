---
name: verify
description: Prompt Golf 변경사항을 실행 중인 앱에서 검증하는 방법
---

# Prompt Golf 검증 레시피

## 빌드/실행

```bash
npm install               # node_modules 없으면 먼저
npm run build             # 컴파일 검증 (next lint는 ESLint 미설정으로 인터랙티브 프롬프트가 떠서 사용 불가)
# AI 과금 없이 mock으로 실행 (셸 env가 .env.local보다 우선):
OPENAI_API_KEY="" SIMILARITY_PROVIDER=mock JUDGE_PROVIDER=mock npm run dev
```

메인 게임은 `http://localhost:3000/` (순수 next dev로 동작). `/play`는 Socket.io 경로라 `npm run dev:server` 필요.

## 표면 드라이브

- API: `POST /api/game/join {sessionId, name}` → `POST /api/game/shot {sessionId, prompt, targetN, similarity}` → `GET /api/game/state?sessionId=`. 루브릭 평가는 `POST /api/evaluate {challengeId, submission}`.
- GUI: playwright-core + 시스템 Chrome(channel: 'chrome', headless)으로 드라이브 가능. 3D 씬은 headless Chrome에서 정상 렌더된다.
  - 참가: `input[placeholder="이름을 입력하세요"]` 채우고 `button:has-text("▶ 게임 참가")` 클릭.
  - **주의(레이스)**: 샷 피드백 토스트("나이스 샷")가 떠 있는 ~3초 동안은 `shotPhase !== 'idle'`이라 스윙/제출 클릭이 조용히 무시된다. 다음 샷 전에 `text=나이스 샷`이 hidden 될 때까지 대기할 것.
  - 오버레이(CompareOverlay/EvaluationOverlay)는 등장 애니메이션이 있어 스크린샷 전 ~1.8초 대기.

## 데모 챌린지 시퀀스 (lib/content/challenges.ts)

타수 1 = 이미지 재현, 타수 2 = `backend-reservation-api`, 타수 3 = `sre-checkout-incident`. 이후 타수는 남은 타겟 이미지로 계속.
