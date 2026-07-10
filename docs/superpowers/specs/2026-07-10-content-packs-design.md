# 콘텐츠 팩 & 트랙 선택 설계 (2026-07-10)

> [확장 설계안](../../prompt-golf-expansion-plan.md)의 "Challenge Pack 파일 포맷 설계"(9장)를 구체화한 spec.
> 이전 단계(커밋 `118618f`)에서 챌린지가 `lib/content/challenges.ts`에 하드코딩되고 트랙 선택 없이
> 고정 시퀀스로 진행되던 것을, **파일 기반 콘텐츠 팩 + 방 단위 트랙 선택** 구조로 교체한다.

## 1. 목표와 결정 사항

| 결정 | 내용 |
|---|---|
| 콘텐츠 관리 | `content/` 폴더의 JSON 파일 직접 편집 (관리자 UI 없음, 게임은 읽기 전용) |
| 트랙 적용 단위 | 방 전체 공통 — 모든 플레이어가 같은 트랙의 홀을 플레이 |
| 트랙 결정 | 첫 참가자가 참가 화면에서 선택, 호스트 리셋 시에만 재선택 가능 |
| 이미지 트랙 | 별도 체계가 아니라 동일한 팩 JSON으로 통합 (`evaluator: "visual"` + `targetImage`) |
| FE 트랙 평가 | 이번 단계는 루브릭 텍스트 평가만 (HTML 렌더+스크린샷 hybrid는 다음 단계) |
| 로딩 구조 | 서버 contentStore(`targetsStore` 패턴) + API. 클라이언트에 심판 노트 미노출 |

### 범위 제외 (이번 단계에서 하지 않음)

- 챌린지 편집용 관리자 UI (파일 직접 편집으로 대체)
- FE 트랙 hybrid 평가 (generateHtml/captureHtml 부활)
- 플레이어별 트랙 / 혼합 코스 시퀀스
- 점수 보정, 트랙별 리더보드 분리

## 2. 콘텐츠 팩 파일 포맷

위치: 저장소 루트 `content/` (git 추적). **파일 1개 = 트랙(도메인) 1개 팩.**
`challenges` 배열 순서 = 홀(타수) 순서.

```jsonc
// content/backend.json
{
  "track": "backend",                          // 트랙 ID. 파일명과 일치 권장
  "meta": {                                    // 선택. 내장 5개 트랙은 생략 가능
    "label": "백엔드",
    "icon": "🗄️",
    "badgeClass": "bg-violet-500/25 text-violet-200"
  },
  "challenges": [
    {
      "id": "backend-reservation-api",         // 전체 팩에서 전역 유일
      "title": "예약 시스템 API 설계",
      "targetBrief": "소규모 병원 예약 시스템을 위한 API를 설계하세요.",
      "expectedOutputType": "API 엔드포인트 설계 · DB 테이블 설계 · …",
      "constraints": ["중복 예약 방지", "…"],
      "rubric": [
        { "key": "requirements", "label": "요구사항 충족", "weight": 20, "description": "…" }
      ],
      "evaluator": "rubric-judge",             // "visual" | "rubric-judge"
      "notesForJudge": "권한 모델이 구체적인가? …",  // 서버 전용 — 클라이언트 API에서 제거
      "targetImage": "sample-1.png"            // public/targets 파일명. visual이면 필수, rubric은 선택
    }
  ]
}
```

- 타입은 기존 `lib/content/types.ts`의 `ChallengeHole`을 재사용하되, `Track` 유니언을
  `string`으로 완화한다 (새 도메인 파일 추가 = 새 트랙). 내장 5개 트랙(`TRACK_META`)은
  meta 생략 시 기본 라벨/아이콘/배지를 제공하고, 미지의 트랙은 meta가 없으면 제네릭 배지.
- `targetIndex` 필드(기존 하드코딩용)는 제거하고 `targetImage`(파일명)로 대체.

### 이미지 트랙과 하위 호환

- `content/image.json`도 동일 구조: `evaluator: "visual"`, `targetImage`로
  `public/targets`의 이미지 참조. `public/targets`는 이미지 라이브러리 역할로 유지되며
  `/admin` 업로드·삭제도 그대로 동작한다.
- **`content/image.json`이 없으면** targetsStore manifest 순서로 이미지 팩을 자동 합성한다
  (홀 1개/이미지, id는 `image-auto-{n}`). 지금처럼 이미지만 넣어도 바로 플레이 가능.

## 3. 서버 로더: `lib/content/contentStore.ts` (server-only)

- `content/*.json` 스캔 → 파싱 → 스키마 검증 → 팩 목록 반환. 요청 시 매번 읽는다
  (로컬/데모 규모, 재시작 없이 파일 수정 반영).
- 검증 규칙:
  - 필수: `track`, `challenges[]`, 각 챌린지의 `id`/`title`/`targetBrief`/`rubric`(1개 이상)/`evaluator`
  - `rubric[].weight`는 숫자, `evaluator`는 `visual|rubric-judge`
  - `evaluator: "visual"`이면 `targetImage` 필수 + `public/targets`에 파일 존재
  - `id`는 모든 팩을 통틀어 전역 유일
- 검증 실패한 팩은 게임에서 제외하되 **조용히 버리지 않는다**: `{ file, message }` 목록으로
  수집해 tracks API의 `errors`로 노출하고 서버 콘솔에도 경고.
- sanitize 함수: 클라이언트 전달용으로 `notesForJudge` 제거, `targetImage` → `targetUrl`
  (`/targets/{file}`) 변환.

## 4. API

| 라우트 | 동작 |
|---|---|
| `GET /api/content/tracks` | `{ success, tracks: [{ track, label, icon, badgeClass, holeCount }], errors: [{ file, message }] }` |
| `GET /api/content/challenges?track=` | 해당 트랙의 **sanitize된** 챌린지 배열. 미지의 track이면 404 |
| `POST /api/evaluate` (수정) | `challengeId`를 contentStore에서 조회(원본, 노트 포함). 하드코딩 `getChallengeById` 제거 |

기존 `lib/content/challenges.ts`(DEMO_CHALLENGES, challengeForStroke)는 삭제하고
샘플 콘텐츠를 `content/*.json`으로 이관한다.

## 5. 방 상태 & 트랙 선택

- `gameServer.ts`: `room.track: string | null` 추가. `GameStateDTO`에 노출.
  - join API에 선택적 `track` 파라미터 — **방의 track이 null일 때만 반영** (첫 참가자).
  - `resetGame()` 시 `track = null`.
  - 진행 중 트랙 전환은 불가 (타수 꼬임 방지). 변경하려면 호스트가 리셋.
- 레거시/무설정 상태(track null인데 플레이 시도)는 이미지 트랙으로 취급한다.

### 참가 화면 UX

- 닉네임 입력 아래에 트랙 카드 목록(`/api/content/tracks`, 아이콘+라벨+홀 수).
- 방에 track이 이미 있으면: 선택 UI 대신 "🗄️ 백엔드 트랙 진행 중" 안내 배지만 표시하고 참가.
- 방에 track이 없으면(첫 참가자): 트랙을 골라야 참가 버튼 활성화. join 호출에 track 포함.

## 6. 게임 플레이 변경 (`app/page.tsx`)

- 방 track이 확정되면 `GET /api/content/challenges?track=`으로 챌린지 목록을 1회 fetch
  (track 변경/리셋 시 재fetch). `currentStroke`를 인덱스로 현재 챌린지 결정.
- `evaluator: "visual"` → 기존 생성→비교 플로우 (`targetFile` = 챌린지의 `targetImage`).
- `evaluator: "rubric-judge"` → 기존 evaluate 플로우.
- 샷 처리·CompareOverlay·EvaluationOverlay·3D 씬·gameServer의 샷 계산은 무변경.
- 챌린지 소진(`currentStroke >= challenges.length`) 시 스윙 패널에
  "이 트랙의 모든 홀을 플레이했습니다" 안내.
- 관전 화면: 관전 대상의 `currentStroke` + 방 track 기준으로 브리프/이미지 표시.
- `gameStore.targets` 의존은 챌린지 fetch로 대체되는 범위에서 제거
  (challenges API가 `targetUrl`까지 내려주므로 클라이언트가 targets 목록을 따로 알 필요 없음).

## 7. 샘플 콘텐츠

| 파일 | 내용 | 출처 |
|---|---|---|
| `content/backend.json` | 예약 시스템 API 설계 1홀 | 확장안 6.2 이관 |
| `content/sre-devops.json` | Checkout 장애 대응 1홀 | 확장안 6.3 이관 |
| `content/frontend.json` | SaaS 랜딩 페이지 클론 1홀 (루브릭 평가 + targetImage 참조 예시) | 확장안 6.1 |
| `content/non-dev.json` | 마케팅 카피 브리프 1홀 | 확장안 4.5 기준 신규 |
| `content/image.json` | 만들지 않음 — manifest 자동 합성 팩으로 하위 호환 확인 | — |

## 8. 에러 처리 원칙

- 콘텐츠 파일 오류는 **작성자에게 보이게** (tracks API `errors` + 콘솔 경고), 게임은 유효한
  팩만으로 계속 동작.
- `/api/evaluate`에서 미지의 challengeId → 400 (기존과 동일).
- challenges fetch 실패 시 스윙 패널에 오류 안내 + 재시도. 임의 콘텐츠로 폴백하지 않는다
  (설계 원칙 8.5: 평가 실패를 임의 점수로 처리하지 않는 것과 동일 맥락).

## 9. 검증 계획

테스트 러너가 없으므로 실행 검증(`.claude/skills/verify` 레시피)으로 확인:

1. curl: tracks/challenges API 응답 스키마, `notesForJudge` 미노출, 깨진 JSON 팩의 errors 리포트
2. curl: join에 track 전달 → state DTO의 track, 둘째 참가자의 track 무시, reset 후 초기화
3. Playwright: 첫 참가자 트랙 선택 → 백엔드 홀 브리프 → 제출 → 평가 오버레이 → 다음 홀,
   둘째 브라우저 참가 시 "트랙 진행 중" 배지 확인
4. `content/image.json` 없이 이미지 트랙 선택 → manifest 자동 팩으로 기존 플로우 동작
