# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**Prompt Golf** — AI 프롬프트 골프 미니게임. 플레이어가 목표 이미지를 보고 프롬프트를 입력하면 AI가 이미지를 생성하고, 목표와의 유사도(0~1)만큼 3D 골프 코스에서 공이 홀에 가까워진다. 홀은 1개 고정이며 **타수(stroke)마다 목표 이미지가 바뀐다**.

> ⚠️ README.md는 초기 메커닉(프롬프트→HTML 생성→html2canvas 캡처→비교)을 설명하지만, 현재 활성 플로우는 **프롬프트→OpenAI 이미지 생성→OpenAI 비전 비교**로 바뀌었다 (커밋 `8f1bbe1`). HTML 생성 경로(`lib/ai/generateHtml.ts`, `lib/capture/captureHtml.ts`, `/api/generate-html`)는 코드에 남아 있지만 메인 게임에서는 사용하지 않는다.

## 명령어

```bash
npm install
npm run dev          # 메인 게임 — 순수 Next.js (http://localhost:3000). app/page.tsx 사용
npm run dev:server   # Socket.io 커스텀 서버 (app/play 경로 전용, 아래 "두 개의 멀티플레이어" 참고)
npm run build
npm run start        # 프로덕션 (next start)
npm run lint         # next lint
```

테스트 러너는 없다. API 키 없이도 mock 폴백으로 즉시 플레이 가능하다.

## 아키텍처

### ⚠️ 두 개의 병행 멀티플레이어 구현이 공존한다

이 저장소에는 서로 다른 두 멀티플레이어 스택이 있고, **각기 다른 페이지가 다른 것을 쓴다**. 하나를 수정할 때 다른 하나를 건드리지 않도록 주의.

1. **REST + 폴링 (현재 메인 경로)** — `app/page.tsx`가 사용
   - `lib/game/useGameApi.ts` (클라이언트 Zustand 스토어 + 2초 폴링 훅)
   - `app/api/game/*` 라우트 → `lib/game/gameServer.ts` (서버 권위적 인메모리 상태)
   - 순수 `next dev`로 동작. 별도 서버 불필요. `/lobby`는 `/`로 리다이렉트.

2. **Socket.io (레거시/대체 경로)** — `app/play/page.tsx`가 사용
   - `lib/socket/useSocket.ts` + `store/multiplayerStore.ts`
   - `server/index.ts` 커스텀 서버 + `server/socket/*` 핸들러 필요 → **`npm run dev:server`로 실행해야만 동작**
   - 순수 `npm run dev`에서는 소켓 연결이 안 된다.

새 게임 기능은 기본적으로 **REST 경로(`app/page.tsx` + `gameServer.ts`)** 를 대상으로 작업한다.

### 게임 상태는 서버 권위적 인메모리

`lib/game/gameServer.ts`가 단일 방(`main-room`)을 `globalThis.__promptGolfRoom`에 저장한다 (Next.js dev의 Fast Refresh 모듈 재평가로 접속자가 날아가는 것을 막기 위함). 프로덕션에서는 Redis 등으로 교체하는 것을 전제로 설계됨. 플레이어는 `sessionStorage` 기반 세션 ID로 식별하며(탭별 독립 유저), `lastSeen` 폴링으로 온라인/비활성을 판정한다.

### 샷 처리 플로우 (`app/page.tsx`의 `handleSwing`)

1. 프롬프트 → `POST /api/generate-image` (`lib/ai/generateImage.ts`, OpenAI Images) → base64 dataURL
2. 생성 이미지 + 목표 이미지 → `POST /api/compare` (`lib/ai/compareScreenshots.ts`, OpenAI 비전) → 유사도 0~1
3. `CompareOverlay` 애니메이션 후 `POST /api/game/shot` (`sessionId`, `similarity`, `targetN`) 제출
4. `gameServer.submitShot()`이 유사도로 이동 거리/측면 편차/홀아웃을 **서버에서 계산**하고 샷 이벤트를 `shotLog`에 기록. 클라이언트는 폴링으로 신규 샷만 받아 비행 애니메이션을 1회 재생.

> `lib/game/calculateShot.ts`는 벙커·각도 오차까지 반영하는 정교한 순수 함수지만, 현재 REST `submitShot`은 이보다 단순한 자체 계산을 쓴다(`shotDistance = similarity * 100`). 샷 물리를 바꿀 때 어느 경로가 실제 사용되는지 확인할 것.

### AI 레이어는 프로바이더 교체형 + mock 폴백

`lib/ai/*.ts`의 각 함수는 환경변수로 프로바이더를 고르고, **API 키가 없거나 호출이 실패하면 결정론적 mock으로 폴백**해 게임이 오프라인에서도 끊기지 않는다. 모두 **server-only**.

- `generateImage.ts` — OpenAI Images (`OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` 기본 `gpt-image-1`)
- `compareScreenshots.ts` — OpenAI 비전 (`SIMILARITY_PROVIDER` 기본 `openai`, `OPENAI_VISION_MODEL` 기본 `gpt-4o`)
- `generateHtml.ts` — Gemini (`HTML_PROVIDER`, `GEMINI_API_KEY`) — 현재 메인 플로우 미사용

### 목표 이미지 관리

`public/targets/`에 저장하고 **순서는 `manifest.json`으로 관리**한다 (`lib/game/targetsStore.ts`). 파일명 순번에 의존하지 않으므로 추가/삭제/재정렬이 자유롭다. 레거시 `image_{n}.*` 파일은 첫 조회 시 자동으로 manifest에 마이그레이션된다. `n`(1부터)이 곧 타수이며 해당 타수에서 쓸 목표가 된다. `/admin` 페이지 + `app/api/admin/targets`로 업로드·삭제·순서변경.

### 3D 씬

React Three Fiber / drei / Three.js. `components/game/*`에 씬·HUD 컴포넌트가 있으며, `GolfCourseScene`·`DashboardScene`은 `next/dynamic`으로 `ssr: false` 로드한다. `next.config.mjs`가 `three`/`@react-three/*`를 `transpilePackages`로 처리. 코스 지오메트리·해저드·벙커 좌표는 `lib/game/courseLayout.ts`와 `calculateShot.ts`의 `BUNKER_BLOBS`가 공유하므로 함께 맞춰야 한다.

## 규칙·관례

- 경로 별칭 `@/*` → 저장소 루트 (`tsconfig.json`).
- 서버 코드(`server/`)는 CommonJS로 별도 컴파일(`tsconfig.server.json`) — App Router 코드와 모듈 설정이 다르다.
- Zustand 스토어가 여러 개다: `store/gameStore.ts`(localStorage 영속, 팀 프로필/로컬 타겟), `store/multiplayerStore.ts`(Socket.io 경로), `lib/game/useGameApi.ts`(REST 경로). 어느 스토어를 쓰는지 페이지별로 확인.
- 코드 주석·설명은 한국어. UI 문자열도 한국어.
