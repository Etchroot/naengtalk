# 냉톡 문서 안내

이 폴더는 냉톡의 기획 기준을 한곳에서 찾기 위한 문서 모음이다.

| 문서 | 확인할 내용 | 갱신 시점 |
| --- | --- | --- |
| [PRODUCT_PLAN.md](./PRODUCT_PLAN.md) | 문제, 타깃, 가치, 차별점, MVP, 위험 | 제품 방향이 바뀔 때 |
| [PRD.md](./PRD.md) | 사용자 흐름, 기능 요구사항, 제품 규칙, 수용 기준 | 기능 범위·동작이 바뀔 때 |
| [TRD.md](./TRD.md) | 기술 구조, 데이터, AI 경계, 보안, 테스트 | 기술 선택·구현 결과가 바뀔 때 |
| [PRODUCT_DECISIONS.md](./PRODUCT_DECISIONS.md) | 확정된 교차 기능 제품 결정의 보존 기록 | 여러 기능에 영향을 주는 결정이 확정될 때 |
| [WORKING_RULES.md](./WORKING_RULES.md) | 디자인·문서·제출·보안·품질의 상세 작업 방식 | 작업 절차가 바뀔 때 |
| [HACKATHON_RULES.md](./HACKATHON_RULES.md) | 일정, 제출 조건, 심사 기준, 라이선스 | 공식 안내 변경 또는 제출 직전 |
| [CODEX_SKILL_USAGE.md](./CODEX_SKILL_USAGE.md) | 앱 개발용 `AGENTS.md` 관리 스킬의 설치·호출·적용 방법 | 스킬 동작·설치 위치가 바뀔 때 |

저장소 루트의 관련 문서:

- [TODO.md](../TODO.md): 진행도와 다음 작업
- [SUBMISSION.md](../SUBMISSION.md): 최종 제출 항목 템플릿
- [HUMAN-IN-THE-ROOF.md](../HUMAN-IN-THE-ROOF.md): 사용자의 결정과 개입 기록
- [AGENTS.md](../AGENTS.md): 최소 공통 지침과 작업별 문서 라우팅

## 문서 우선순위

1. 사용자가 가장 최근에 명시적으로 승인한 결정
2. `PRD.md`의 제품 동작
3. `TRD.md`의 구현 방법
4. `PRODUCT_PLAN.md`의 방향과 설명

문서와 실제 구현이 다르면 동작을 검증한 뒤 관련 문서를 함께 갱신한다. 기획 의도가 달라지는 경우에는 사용자 승인을 먼저 받는다.
