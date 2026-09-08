# Wanted AI Championship 2026 최소 작업 지침

이 파일은 저장소 전체에 적용된다. **모든 작업에서 처음에는 이 파일만 읽고**, 아래 표에서 현재 작업과 직접 관련된 문서·구간만 추가로 읽는다. 전체 문서를 관성적으로 모두 읽지 않는다.

## 1. 모든 작업의 공통 규칙

1. 사용자 또는 다른 작업자의 기존 변경을 덮어쓰거나 되돌리지 않는다.
2. 현재 작업에 적용되는 Codex 스킬·플러그인이 있으면 해당 지침을 먼저 읽는다.
3. 가격·정책·API·대회 일정처럼 바뀔 수 있는 정보는 필요할 때 공식 출처로 다시 확인한다.
4. 사용자가 명시적으로 기획 완료와 개발 시작을 선언하기 전에는 앱 코드, DB migration, 인프라와 배포 작업을 시작하지 않는다. 와이어프레임과 기획 문서 작업만 허용한다.
5. API 키·service role·개인정보를 저장소, 클라이언트 번들, 문서 또는 로그에 기록하지 않는다.
6. 완료를 보고하기 전에 변경 내용과 관련 검증 결과를 실제로 확인한다.

## 2. 작업별 컨텍스트 라우팅

파일 전체가 필요하지 않으면 `rg`로 관련 제목·키워드를 찾고 해당 구간만 읽는다.

| 작업 종류 | 먼저 읽을 문서 |
| --- | --- |
| 문제·타깃·가치·MVP·제품 방향 | `docs/PRODUCT_PLAN.md`의 관련 구간 |
| 기능·사용자 흐름·화면 동작·수용 기준 | `docs/PRD.md`의 관련 기능 구간 |
| 인증·DB·AI·OCR·검색·보안·배포·테스트 구현 | `docs/TRD.md`의 관련 기술 구간 |
| 이미 확정된 교차 기능 결정 확인 | `docs/PRODUCT_DECISIONS.md`에서 키워드 검색 후 관련 항목만 확인 |
| 실제 UI/UX 디자인·프로토타입·디자인 검수 | `docs/WORKING_RULES.md`의 `Product Design` 구간과 `docs/PRD.md`의 대상 화면 |
| 대회 일정·규정·라이선스·제출 조건 | `docs/HACKATHON_RULES.md` |
| 제출 문안 작성·최종 링크 입력 | `SUBMISSION.md`, `docs/HACKATHON_RULES.md` |
| 진행도·다음 작업·차단 요소 | `TODO.md`의 관련 행 |
| 사용자의 결정·개입 기록 추가 | `HUMAN-IN-THE-ROOF.md`의 마지막 행과 관련 키워드 |
| 문서 관리·보안·품질의 상세 작업 방식 | `docs/WORKING_RULES.md`의 관련 구간 |
| 앱 개발용 `AGENTS.md` 생성·축소·문서 라우팅 관리 | `$maintaining-app-agents`, `docs/CODEX_SKILL_USAGE.md` |

## 3. 문서 업데이트 규칙

- 새 기능·정책·기술 상세를 `AGENTS.md`에 직접 누적하지 않는다.
- 내용이 기존 문서 범위에 맞으면 해당 문서만 갱신한다.
  - 제품 방향: `docs/PRODUCT_PLAN.md`
  - 기능과 UX: `docs/PRD.md`
  - 기술과 데이터: `docs/TRD.md`
  - 확정된 교차 기능 결정: `docs/PRODUCT_DECISIONS.md`
  - 진행도: `TODO.md`
  - 사용자 개입: `HUMAN-IN-THE-ROOF.md`
- 기존 문서에 맞지 않는 새 주제는 `docs/` 아래 별도 Markdown 파일로 만들고, 이후 작업자가 찾을 필요가 있을 때만 위 라우팅 표에 **경로 한 줄**을 추가한다.
- 중요한 결정이 생기면 관련 본문과 `TODO.md`, `HUMAN-IN-THE-ROOF.md`를 같은 작업에서 갱신한다. 단, 읽을 때는 필요한 행·구간만 선택한다.
- 세부 작업 방식은 `docs/WORKING_RULES.md`, 현재 제품 기준은 `docs/PRODUCT_DECISIONS.md`를 따른다.
