# Prompt Golf 확장 설계안

> 이 문서는 구현 지시서가 아니라 **제품/게임 설계 및 기획 맥락 보존 문서**입니다.  
> 향후 LLM, 엔지니어, 기획자가 이 프로젝트를 이어 받을 때 동일한 전제에서 논의하도록 작성합니다.

## 1. 현재 합의된 전제

### 1.1 프로젝트 방향

Prompt Golf는 현재의 “이미지 생성 결과를 목표 이미지와 비교해 골프 샷 거리로 바꾸는 게임”에서 출발하되, 장기적으로는 다음과 같은 형태로 확장한다.

> **Prompt Golf는 주어진 업무 타겟을 가장 정확하고 실용적인 AI 산출물로 재현하는 직무별 프롬프트 스킬 게임이다.**

타겟은 이미지에 한정하지 않는다. 웹 UI, API 설계, DB 설계, 장애 대응, 인프라 운영 판단, 마케팅 콘텐츠, 영상 기획 등 다양한 업무 산출물이 될 수 있다.

### 1.2 구현 범위

현재 단계는 **설계 및 기획 단계**다.

- 당장 구현하지 않는다.
- 기존 게임 로직은 유지한다.
- 기존 “점수 0~1 → 골프 샷 거리” 구조를 확장 레이어에서 재사용한다.
- 배포 목표는 공개 SaaS가 아니라 **로컬 / 데모 구현용**이다.
- 현재 논의의 목적은 브레인스토밍 및 전문 어시스턴트 기반 기획이다.

### 1.3 기존 로직 유지 원칙

현재 게임은 `similarity`라는 0~1 점수를 받아 골프 샷 결과로 변환한다.  
확장 설계에서도 이 구조를 깨지 않는다.

확장 후 개념은 다음처럼 일반화한다.

```text
similarity → evaluationScore

0.0 = 전혀 요구사항을 충족하지 못함
1.0 = 거의 완벽하게 요구사항을 충족함
```

이미지 홀에서는 기존처럼 이미지 유사도를 사용한다.  
프론트엔드, 백엔드, SRE, 비개발자 콘텐츠 홀에서는 루브릭 평가 결과를 0~1로 정규화해 사용한다.

---

## 2. 핵심 개념 모델

### 2.1 Hole / Challenge

`Hole`은 플레이어가 풀어야 하는 하나의 업무 문제다.

각 Hole은 다음 요소를 가진다.

```yaml
hole:
  id: string
  title: string
  track: frontend | backend | sre-devops | non-dev | image
  target_brief: string
  expected_output_type: string
  constraints: string[]
  scoring_rubric:
    - dimension: string
      weight: number
      description: string
  evaluator:
    type: visual | rubric-judge | hybrid
  notes_for_judge: string
```

### 2.2 Target

`Target`은 플레이어가 재현하거나 만족시켜야 하는 기준이다.

예시:

- 목표 이미지
- 웹 페이지 요구사항
- API 설계 요구사항
- 장애 로그와 메트릭
- 콘텐츠 브리프
- 마케팅 캠페인 요구사항
- 영상 스토리보드 요구사항

### 2.3 Submission

`Submission`은 플레이어가 프롬프트를 통해 만든 결과물이다.

예시:

- 이미지 URL 또는 data URL
- HTML/CSS/JS
- API 명세
- DB schema
- SQL query
- incident report
- runbook
- marketing copy
- video storyboard

### 2.4 Judge

`Judge`는 Submission을 Target과 비교해 0~1 점수를 반환하는 평가자다.

Judge는 다음 두 유형을 조합할 수 있다.

1. **자동 검증기**
   - 스냅샷 비교
   - Lighthouse
   - 접근성 검사
   - OpenAPI schema validation
   - SQL lint / explain 분석
   - IaC validation

2. **LLM 루브릭 평가자**
   - 요구사항 충족 여부
   - 설계 품질
   - 보안/운영 리스크
   - 트레이드오프 설명력
   - 커뮤니케이션 품질

---

## 3. 공통 평가 출력 계약

모든 Judge는 최종적으로 아래 형태의 JSON을 반환해야 한다.

```json
{
  "score": 0.82,
  "summary": "핵심 요구사항을 대부분 충족했지만 권한 모델 설명이 부족합니다.",
  "breakdown": {
    "requirements": 0.9,
    "correctness": 0.85,
    "security": 0.65,
    "performance": 0.8,
    "communication": 0.9
  },
  "strengths": [
    "API 리소스 구조가 명확함",
    "중복 예약 방지 제약을 고려함"
  ],
  "penalties": [
    "관리자 권한 정책이 구체적이지 않음"
  ]
}
```

게임 로직은 `score`만 사용해 골프 샷을 계산한다.  
나머지 필드는 플레이어 피드백, 리더보드 해설, 학습 리포트에 사용한다.

---

## 4. 트랙별 설계

## 4.1 이미지 / 비주얼 트랙

현재 프로젝트의 기존 기능에 가장 가까운 트랙이다.

### 산출물

- 생성 이미지
- 목표 이미지와의 비교 결과

### 평가 기준

| 항목 | 설명 |
|---|---|
| 시각적 유사도 | 레이아웃, 색상, 형태, 구도, 주요 요소 일치도 |
| 프롬프트 반영도 | 제출 프롬프트가 타겟을 잘 설명했는지 |
| 노이즈/왜곡 | 생성 결과의 깨짐, 무관한 요소, 텍스트 왜곡 |

### 비고

이 트랙은 기존 `similarity` 개념을 그대로 유지할 수 있다.

---

## 4.2 프론트엔드 개발자 트랙

프론트엔드 트랙은 현재 이미지 기반 게임에서 가장 자연스럽게 확장된다.  
목표는 “화면을 비슷하게 만드는 것”을 넘어, **작동 가능한 웹 결과물의 품질**을 평가하는 것이다.

### 가능한 Hole

- 정적 랜딩 페이지 구현
- 반응형 대시보드 UI
- 폼/모달/검색/필터 인터랙션
- 애니메이션 마이크로 인터랙션
- 접근성 좋은 컴포넌트
- SEO 최적화 페이지
- UX 개선 과제

### 산출물

- HTML/CSS/JS
- React/Vue/Svelte 등 프론트엔드 코드
- 정적 웹 페이지
- 인터랙션이 포함된 UI

### 추천 평가 기준

| 항목 | 비중 예시 | 설명 |
|---|---:|---|
| 시각적 충실도 | 30 | 목표 화면과의 레이아웃/색상/구도 유사성 |
| 기능 동작 | 20 | 버튼, 폼, 상태 변화, 인터랙션 동작 |
| 반응형/UX | 15 | 모바일/태블릿/데스크톱 대응, 명확한 CTA, 상태 처리 |
| 접근성 | 15 | 키보드 탐색, label, contrast, semantic HTML |
| 성능 | 10 | 로딩 속도, 불필요한 JS/CSS, 렌더링 안정성 |
| SEO/코드 품질 | 10 | title/meta/heading 구조, 유지보수성 |

### 자동 검증 후보

- screenshot comparison
- Lighthouse performance/accessibility/SEO audits
- axe 또는 접근성 검사
- viewport별 스냅샷
- console error 검사

### 참고 기준

- Lighthouse: 웹 페이지의 performance, accessibility, SEO 등을 자동 감사할 수 있는 도구
- WCAG 2.2: 접근성의 perceivable, operable, understandable, robust 원칙과 testable success criteria 제공

---

## 4.3 백엔드 개발자 트랙

백엔드 트랙은 이미지보다 **설계 산출물, API 계약, 데이터 모델, 실행/성능 근거**를 평가하는 방향이 적합하다.

아직 최종 산출물 포맷은 확정하지 않았다.  
다만 로컬/데모 단계에서는 OpenAPI, DB schema, SQL, 아키텍처 설명을 텍스트 기반으로 평가하는 방식이 가장 현실적이다.

### 가능한 Hole

- 예약 시스템 API 설계
- 결제 API 설계
- 관리자/사용자 권한 모델 설계
- DB schema 설계
- SQL query 최적화
- 시스템 아키텍처 설계
- 캐시/큐/트랜잭션 전략 설계
- 디자인 패턴 적용안

### 산출물

- OpenAPI 명세
- API endpoint 목록
- request/response 예시
- DB schema
- SQL query
- sequence diagram 또는 architecture 설명
- 보안/성능/운영 고려사항

### 추천 평가 기준

| 항목 | 비중 예시 | 설명 |
|---|---:|---|
| 요구사항 충족 | 20 | 기능 요구사항을 빠짐없이 다뤘는지 |
| API/계약 설계 | 20 | 리소스 모델, status code, error model, pagination, idempotency |
| 데이터 모델링 | 20 | 정규화, 제약조건, 인덱스, 무결성 |
| 보안/권한/검증 | 20 | 인증, 인가, input validation, 민감정보 보호 |
| 성능/확장성 | 10 | N+1 회피, 캐시, 비동기 처리, 병목 고려 |
| 설명/트레이드오프 | 10 | 선택 이유와 대안 비교 |

### 자동 검증 후보

- OpenAPI schema validation
- endpoint naming lint
- SQL lint
- explain plan 분석
- 보안 체크리스트 기반 평가

### LLM Judge 체크 포인트

- 권한 모델이 구체적인가?
- race condition을 고려했는가?
- 중복 생성/중복 예약 같은 edge case를 다뤘는가?
- 오류 응답이 일관적인가?
- “그냥 잘 처리한다” 같은 추상 표현으로 회피하지 않았는가?

### 참고 기준

- OpenAPI Specification: HTTP API를 사람이든 컴퓨터든 이해할 수 있게 하는 표준 인터페이스 설명
- OWASP API Security Top 10: API 보안 평가 루브릭 후보

---

## 4.4 SRE / DevOps / 인프라 트랙

SRE/DevOps 트랙은 “코드를 얼마나 잘 작성했는가”보다 **진단, 안전한 조치, 운영 판단, 재발 방지**를 평가해야 한다.

아직 최종 산출물 포맷은 확정하지 않았다.  
우선은 incident response, runbook, alert/SLO 설계, IaC 리뷰를 중심으로 논의한다.

### 가능한 Hole

- 장애 원인 분석
- incident report 작성
- runbook 작성
- alert rule 설계
- SLO/SLI 설계
- Terraform/Kubernetes YAML 리뷰
- 배포 전략 선택
- rollback/canary/blue-green 판단
- CI/CD 실패 로그 분석
- 비용 최적화 제안

### 산출물

- 원인 분석 보고서
- 즉시 대응 절차
- 재발 방지책
- runbook
- postmortem
- SLO/SLI 정의
- IaC 수정 제안
- 운영 커뮤니케이션 메시지

### 추천 평가 기준

| 항목 | 비중 예시 | 설명 |
|---|---:|---|
| 문제 진단 정확성 | 30 | 로그/메트릭에서 원인을 올바르게 추론했는지 |
| 즉시 대응 안전성 | 20 | 위험한 명령/무리한 조치를 피하고 안전한 완화책을 제시했는지 |
| 증거 기반 추론 | 15 | 추측이 아니라 관측 데이터에 기반했는지 |
| 재발 방지책 | 15 | 근본 원인 제거, 테스트, 가드레일을 제안했는지 |
| 관측성 개선 | 10 | metric/log/trace/alert 개선이 있는지 |
| 커뮤니케이션 품질 | 10 | 영향도, 타임라인, 액션 아이템이 명확한지 |

### 자동 검증 후보

- YAML/Terraform validation
- Kubernetes manifest lint
- policy-as-code 검사
- runbook checklist 검사
- incident report 구조 검사

### LLM Judge 체크 포인트

- 근거 없이 DB 재시작/전체 재배포 같은 위험한 조치를 하지 않았는가?
- rollback 또는 feature flag disable 같은 안전한 완화책을 고려했는가?
- 고객 영향도와 우선순위를 언급했는가?
- 재발 방지책이 구체적인가?

### 참고 기준

- DORA metrics: throughput과 instability를 함께 보는 소프트웨어 전달 성과 지표. 단, 단일 목표로 삼으면 왜곡될 수 있으므로 게임 점수에서는 보조 기준으로 사용한다.

---

## 4.5 비개발자 콘텐츠 트랙

비개발자 트랙은 실무 브리프에 맞는 콘텐츠 산출물의 품질을 평가한다.

### 가능한 Hole

- 마케팅 카피
- 광고 이미지 프롬프트
- 숏폼 영상 기획안
- 영상 스토리보드
- 발표자료 구조
- 고객 응대 메시지
- 리서치 요약
- 채용 공고
- 교육 콘텐츠
- 상품 상세페이지

### 산출물

- 카피 문안
- 콘텐츠 기획안
- 스토리보드
- 썸네일 프롬프트
- 발표자료 아웃라인
- 고객 메시지
- 요약 보고서

### 추천 평가 기준

| 항목 | 설명 |
|---|---|
| 브리프 충실도 | 요구사항을 빠짐없이 반영했는지 |
| 대상 독자 적합성 | 톤, 난이도, 맥락이 맞는지 |
| 명확성 | 핵심 메시지, CTA, 구조가 분명한지 |
| 사실성 | 근거 없는 과장이나 hallucination이 없는지 |
| 창의성 | 후킹, 차별화, 기억 가능성 |
| 브랜드 적합성 | 말투, 금지어, 포지셔닝 적합성 |
| 실용성 | 실제로 바로 쓸 수 있는지 |
| 안전성 | 저작권, 의료/법률/금융 리스크 회피 |

### 비고

영상 트랙은 초기 로컬/데모 단계에서 실제 영상 생성까지 가지 않는다.  
우선은 **스토리보드 + 컷 구성 + 내레이션 + 썸네일 프롬프트** 수준으로 정의한다.

---

## 5. 초기 데모 추천 구성

초기 데모는 모든 트랙을 다 넣기보다, 다음 3개 Hole로 시작하는 것이 좋다.

```text
Hole 1: 이미지/프론트엔드 화면 재현
Hole 2: 백엔드 API 설계
Hole 3: SRE 장애 대응
```

이 구성은 참가자가 한 게임 안에서 다음 능력을 모두 시험받게 한다.

1. 시각적 프롬프트 능력
2. 기술 설계 능력
3. 운영 판단 능력

---

## 6. 예시 Hole

## 6.1 Frontend Hole: SaaS 랜딩 페이지 클론

### 플레이어에게 주는 타겟

```text
목표 이미지 1장을 보고 SaaS 랜딩 페이지를 재현하세요.

요구사항:
- 반응형 레이아웃
- CTA 버튼 2개
- pricing 섹션
- 접근성 고려
- SEO 기본 태그 포함
```

### 평가 기준

| 항목 | 비중 |
|---|---:|
| 시각적 유사도 | 30 |
| 레이아웃/반응형 | 20 |
| 접근성 | 15 |
| UX 완성도 | 15 |
| SEO/semantic HTML | 10 |
| 코드 단순성/유지보수성 | 10 |

---

## 6.2 Backend Hole: 예약 시스템 API 설계

### 플레이어에게 주는 타겟

```text
소규모 병원 예약 시스템을 위한 API를 설계하세요.

요구사항:
- 환자는 예약 생성/조회/취소 가능
- 의사는 자신의 일정 조회 가능
- 중복 예약 방지
- 관리자만 예약 현황 전체 조회 가능
- 추후 모바일 앱에서 사용할 예정
```

### 플레이어 산출물

```text
- API 엔드포인트 설계
- Request/Response 예시
- DB 테이블 설계
- 인증/권한 전략
- 에러 코드 설계
- 성능/확장성 고려사항
```

### 평가 기준

| 항목 | 비중 |
|---|---:|
| 요구사항 충족 | 20 |
| API 설계 일관성 | 20 |
| DB 모델링 | 20 |
| 보안/권한/검증 | 20 |
| 확장성/성능 | 10 |
| 설명/트레이드오프 | 10 |

---

## 6.3 SRE Hole: Checkout 장애 대응

### 플레이어에게 주는 타겟

```text
상황:
배포 10분 후 checkout API p95 latency가 300ms → 5s로 증가.
Error rate는 1% → 18%.
DB CPU는 95%.
최근 변경사항은 추천 상품 조회 로직 추가.

제공 로그:
- SELECT * FROM recommendations WHERE user_id = ?
- checkout timeout
- connection pool exhausted
```

### 플레이어 산출물

```text
- 의심 원인
- 즉시 완화 조치
- 확인할 메트릭/로그
- 롤백 여부 판단
- 재발 방지책
- postmortem 요약
```

### 평가 기준

| 항목 | 비중 |
|---|---:|
| 원인 진단 정확도 | 30 |
| 즉시 대응 안전성 | 20 |
| 증거 기반 추론 | 15 |
| 재발 방지책 | 15 |
| 관측성 개선 | 10 |
| 커뮤니케이션 품질 | 10 |

---

## 7. 아직 결정하지 않은 것

아래 항목은 의도적으로 확정하지 않는다.  
다음 기획 논의에서 결정해야 한다.

1. 백엔드 트랙의 최종 산출물 포맷
   - OpenAPI만 받을지
   - DB schema까지 받을지
   - 시스템 아키텍처 설명까지 받을지

2. SRE/DevOps 트랙의 최종 산출물 포맷
   - incident report 중심인지
   - runbook 중심인지
   - IaC 리뷰 중심인지

3. 비개발자 트랙의 우선순위
   - 마케팅 카피
   - 영상 스토리보드
   - 발표자료
   - 고객 응대

4. Judge 구현 방식
   - 전부 LLM 평가로 시작할지
   - 일부 자동 검증기를 붙일지
   - 로컬 데모에서 어느 정도까지 자동화할지

5. 점수 보정 방식
   - 트랙별 난이도 보정
   - Judge 편차 보정
   - 팀/개인 모드별 점수 차등

---

## 8. 설계 원칙

향후 논의와 구현은 다음 원칙을 따른다.

1. **기존 골프 게임 루프를 깨지 않는다.**
   - 최종 점수는 항상 0~1로 정규화한다.
   - 기존 샷 계산 로직에 연결 가능해야 한다.

2. **각 Hole은 self-contained 해야 한다.**
   - 문제 브리프, 기대 산출물, 제약, 평가 기준이 한 문서 안에 있어야 한다.
   - LLM Judge가 외부 맥락 없이도 평가할 수 있어야 한다.

3. **평가 기준은 명시적이어야 한다.**
   - 숨은 기준으로 감점하지 않는다.
   - 플레이어가 무엇을 잘해야 하는지 알 수 있어야 한다.

4. **자동 검증과 LLM 판단을 분리한다.**
   - 자동 검증 가능한 항목은 자동화한다.
   - 주관적 품질 판단은 LLM 루브릭으로 처리한다.

5. **데모 안정성과 경쟁 공정성을 구분한다.**
   - 로컬 데모에서는 fallback이 허용될 수 있다.
   - 경쟁/평가 모드에서는 실패한 평가를 임의 점수로 처리하면 안 된다.

6. **직무별 현실성을 우선한다.**
   - 백엔드는 이미지보다 API/DB/아키텍처 산출물이 적합하다.
   - SRE는 정답 코드보다 안전한 운영 판단이 중요하다.
   - 비개발자 트랙은 브리프 충실도와 실용성이 중요하다.

---

## 9. 다음 논의 후보

다음 단계에서는 아래 중 하나를 선택해 구체화한다.

1. 전체 게임 룰/점수 체계
2. Frontend Hole 3개 상세 설계
3. Backend Hole 3개 상세 설계
4. SRE/DevOps Hole 3개 상세 설계
5. Judge 프롬프트 설계
6. Challenge Pack 파일 포맷 설계

현재 추천 순서는 다음과 같다.

```text
1. 전체 게임 룰/점수 체계
2. Judge 프롬프트 설계
3. 초기 3개 Hole 상세 설계
```

---

## 10. 참고 표준 및 자료

이 문서는 기획 기준을 세우기 위해 다음 공개 표준/자료를 참고할 수 있다.

- Lighthouse: https://developer.chrome.com/docs/lighthouse/overview
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- OpenAPI Specification: https://spec.openapis.org/oas/latest.html
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- DORA metrics: https://dora.dev/guides/dora-metrics/
