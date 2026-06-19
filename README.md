# Prompt Golf ⛳ — AI 프롬프트 골프 미니게임

목표 화면(이미지)을 보고 **프롬프트**를 입력하면 → **Gemini가 HTML 웹페이지를 생성** →
브라우저에서 **렌더링 후 캡처(스크린샷)** → 캡처 화면과 목표 이미지의 **유사도(Gemini 비전)**
만큼 골프공이 홀에 가까워지는 3D 미니게임입니다. (UI 클론 골프)

## 게임 흐름

1. **스윙하기** → 프롬프트를 `/api/generate-html`로 전송 → Gemini가 자체 완결형 HTML 생성
2. 클라이언트가 그 HTML을 sandbox `<iframe>`에 렌더링하고 **html2canvas**로 스크린샷 캡처
3. 캡처(dataURL) + 목표 이미지를 `/api/compare`로 전송 → Gemini 비전이 **0~1 유사도** 반환
4. `calculateShot()` 이 유사도 → 이동 거리 + −3°~+3° 각도 오차 계산 (유사도<0.3 → 헛스윙)
5. 공 위치/순위가 3D 필드와 HUD에 반영

> 홀은 **1개로 고정**, **타수(n)마다** 목표 이미지가 바뀝니다.

## 목표 이미지 넣기

`public/targets/` 에 `image_{n}.(png|jpg|webp|…)` 형식으로 넣으세요.
`n` 이 곧 **타수**이며, 게임은 `/api/targets`로 폴더를 읽어 번호순으로 사용합니다.
(동작 확인용 샘플 `image_1~3.svg` 가 들어 있으니 자유롭게 교체하세요. — 자세한 규칙은 `public/targets/README.md`)

## 기술 스택

- **Next.js 14 (App Router)** + **TypeScript** + **Tailwind CSS**
- **React Three Fiber / Three.js / @react-three/drei** — 3D 골프 코스
- **Framer Motion** — UI 애니메이션 / **Zustand**(+persist) — 게임 상태
- **html2canvas** — 생성된 HTML 화면 캡처
- **Google Gemini** (`gemini-2.5-flash`, 무료 티어) — HTML 생성 + 이미지 비교

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

API 키 없이도 mock으로 바로 플레이됩니다. 실제 Gemini를 쓰려면:

```bash
cp .env.example .env.local
# GEMINI_API_KEY=... (https://aistudio.google.com/apikey)
```

## 교체 가능한 AI 레이어

- `lib/ai/generateHtml.ts` — 프롬프트→HTML (Gemini / mock). `HTML_PROVIDER`로 전환.
- `lib/ai/compareScreenshots.ts` — 캡처↔목표 이미지 유사도 (Gemini 비전 / mock). `SIMILARITY_PROVIDER`로 전환.
- `lib/capture/captureHtml.ts` — iframe + html2canvas 캡처(클라이언트, 무료).
- `lib/game/calculateShot.ts` — 순수 함수 샷 물리(거리/각도/헛스윙/성공 판정).

## 주요 파일

```
app/page.tsx                      대시보드 (3D 필드 + 팀 프로필/시작)
app/play/page.tsx                 플레이 (생성→캡처→비교 플로우)
app/api/generate-html/route.ts    프롬프트 → HTML
app/api/compare/route.ts          캡처 ↔ 목표 이미지 유사도
app/api/targets/route.ts          public/targets 의 image_{n} 목록
store/gameStore.ts                Zustand 스토어 (localStorage 영속)
lib/ai/{generateHtml,compareScreenshots}.ts
lib/capture/captureHtml.ts
lib/game/{types,data,calculateShot}.ts
components/game/*                  3D 씬 + HUD 컴포넌트
public/targets/                   목표 이미지(image_{n}) 폴더
```

## Vercel 배포

저장소를 Vercel에 연결하면 빌드됩니다. 실제 Gemini를 쓰려면 프로젝트 환경 변수에
`GEMINI_API_KEY`(필요 시 `GEMINI_MODEL`)를 추가하세요. 캡처는 클라이언트에서 수행되어
별도 인프라가 필요 없습니다.

> Storage 확장: 현재 MVP는 localStorage. 추후 Supabase Storage / S3로 팀·샷·목표 이미지 영속화 가능.
