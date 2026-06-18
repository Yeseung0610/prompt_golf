# Prompt Golf ⛳ — AI 프롬프트 골프 미니게임

프롬프트로 목표 이미지를 재현하면, AI가 생성 이미지와 목표 이미지의 **유사도**를 계산해
그만큼 골프공이 홀에 가까워지는 3D 웹 미니게임입니다.

## 기술 스택

- **Next.js 14 (App Router)** + **TypeScript**
- **Tailwind CSS** — 다크 반투명 HUD
- **React Three Fiber / Three.js / @react-three/drei** — 3D 골프 코스
- **Framer Motion** — UI 애니메이션
- **Zustand** (+ `persist` → localStorage) — 게임 상태
- **Next Route Handler** — `/api/generate-shot`

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드
```

API 키 없이 바로 플레이할 수 있습니다(기본 mock). 실제 생성 API를 쓰려면
`.env.example`를 `.env.local`로 복사하고 `IMAGE_PROVIDER=openai` + `OPENAI_API_KEY`를 설정하세요.

## 화면

- **`/` 대시보드** — 약간 높은 시점의 3D 골프 필드, 팀 공 위치 + 이름 라벨, 순위 패널,
  홀 정보, 미니맵, 팀 프로필(원형 이미지 업로드 + 팀명) 및 **게임 시작하기** 버튼.
- **`/play` 플레이** — 플레이어 시점의 3D 코스(하늘·산·물·벙커·나무·페어웨이·티/공),
  좌상단 플레이어/홀 정보, 우상단 순위, 우측 미니맵, 하단 통합 패널
  (목표 이미지 · 프롬프트 입력 · 스윙하기).

## 게임 흐름

1. **스윙하기** → 프롬프트를 `/api/generate-shot`로 전송
2. 서버: `generateImage(prompt)` → `compareSimilarity(...)` 로 0~1 유사도 반환
3. 클라이언트: `calculateShot()` 가 유사도 → 이동 거리 + −3°~+3° 각도 오차 계산
4. 유사도 < 0.3 → **헛스윙**, 높을수록 홀에 근접, 홀 반경 이내 → **성공**
5. 공 위치/순위가 3D 필드와 HUD에 반영

## 교체 가능한 AI 레이어

- `lib/ai/generateImage.ts` — 이미지 생성 (mock / OpenAI). `GenerateImageFn` 시그니처 유지.
- `lib/ai/compareSimilarity.ts` — 유사도 계산 (mock). `CompareSimilarityFn` 시그니처 유지.
- `lib/game/calculateShot.ts` — 순수 함수로 분리된 샷 물리(거리/각도/헛스윙/성공 판정).

## 주요 파일

```
app/page.tsx                     대시보드
app/play/page.tsx                플레이 화면
app/api/generate-shot/route.ts   샷 생성 API
store/gameStore.ts               Zustand 스토어 (localStorage 영속)
lib/game/{types,data,calculateShot,targetImages}.ts
lib/ai/{generateImage,compareSimilarity}.ts
components/game/*                 3D 씬 + HUD 컴포넌트
```

## Vercel 배포

저장소를 Vercel에 연결하면 추가 설정 없이 빌드됩니다. 실제 이미지 생성 API를 쓸 경우
프로젝트 환경 변수에 `IMAGE_PROVIDER`, `OPENAI_API_KEY`를 추가하세요.

> Storage 확장: 현재 MVP는 localStorage. 추후 Supabase Storage / S3로 팀·샷 영속화 가능.
