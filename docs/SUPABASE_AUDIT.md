# Supabase 점검 기록

- 점검일: 2026-09-28
- 프로젝트: `naengtalk`
- 프로젝트 ref: `ygdbvbjvnnoxyjeidnnj`
- 방식: Supabase CLI·제한된 SQL의 읽기 전용 구조 점검과 격리된 익명 게스트 스모크
- 비밀정보: API key, service role, access token과 사용자별 원문 데이터는 조회·기록하지 않음

## 결론

원격 프로젝트는 `ACTIVE_HEALTHY` 상태이며 로컬 migration과 원격 migration 이력은 일치했다. 데이터베이스 lint에서 schema 오류가 없었고, 핵심 Edge Function 세 개가 JWT 검증을 켠 채 활성 상태였다. 공공 레시피 적재 수량도 기대값과 일치했다.

익명 게스트·재고 격리·채팅 재고 변경·소비기한·레시피 생성·요리 완료 원격 스모크는 통과했다. 다만 `menu-chat` v12에서 공공 후보가 알레르기 검사에 걸리면 다음 후보로 넘어가지 않고 간헐적으로 502를 반환하는 운영 결함을 발견했다. 로컬에서는 알레르기 거절도 재시도 가능한 후보 실패로 처리하도록 수정하고 회귀 테스트를 추가했지만, 이번 작업에는 배포 승인이 없으므로 production v12에는 아직 반영하지 않았다.

이번 점검에서는 migration·함수·기존 사용자 데이터를 수정하지 않았다. 원격 동작 검증에는 새 익명 게스트의 격리된 테스트 데이터를 사용했고, 테스트용 인증 사용자는 스크립트 종료 시 정리했다. 사용량이 아직 적어 scan 수가 0인 검색 인덱스는 향후 재료 조합 검색 경로에 필요하므로 삭제하지 않았다.

## 점검 결과

### 프로젝트·migration

| 항목 | 결과 |
| --- | --- |
| 프로젝트 상태 | `ACTIVE_HEALTHY` |
| 로컬/원격 migration | 23개 일치 |
| migration 범위 | `202609080001` ~ `202609210003` |
| DB lint | warning 수준 schema 오류 없음 |

### Edge Functions

| 함수 | 배포 버전 | 상태 | JWT 검증 |
| --- | ---: | --- | --- |
| `menu-chat` | 12 | ACTIVE | true |
| `purchase-ocr` | 7 | ACTIVE | true |
| `inventory-parse` | 8 | ACTIVE | true |

OpenAI secret은 Supabase 서버 환경에서만 사용하며 클라이언트·Git·문서에 값을 기록하지 않는다.

### 핵심 테이블 수량

| 스키마·테이블 | 행 수 | 판단 |
| --- | ---: | --- |
| `recipe_catalog.recipes` | 1,684 | 기대값 일치 |
| `recipe_catalog.ingredients` | 18,920 | 기대값 일치 |
| `recipe_catalog.steps` | 9,542 | 기대값 일치 |
| `recipe_catalog.shared_recipes` | 2 | 완료·동의 공유 데이터 존재 |
| `public.inventory_lots` | 1,397 | 사용자별 원격 재고 사용 중 |
| `public.shelf_life_rules` | 136 | 공용 적용 규칙 존재 |
| `public.shelf_life_source_entries` | 116 | 사용자 제공 원천 행 수 일치 |
| `public.recipes` | 15 | 개인 저장 레시피 존재 |
| `public.completed_recipes` | 15 | 완료 기록 존재 |
| `public.profiles` | 63 | 게스트/사용자 프로필 존재 |

행 수는 점검 시점의 스냅샷이므로 이후 게스트 사용과 정리 작업에 따라 달라질 수 있다.

## 권한·데이터 경계 확인

- 클라이언트는 `EXPO_PUBLIC_SUPABASE_URL`과 publishable/anon key만 사용한다.
- 서비스 역할과 OpenAI key는 Edge Function 서버 경계에만 둔다.
- 익명 게스트도 Supabase의 `authenticated` 역할이지만 데이터 접근은 `auth.uid()` 소유권 RLS로 제한한다.
- 구매내역 원본 이미지와 OCR 원문은 영구 테이블이나 Storage에 저장하지 않는 설계를 유지한다.
- 공공 레시피 원본은 클라이언트가 직접 읽는 `public` 자료가 아니라 제한된 `recipe_catalog` 조회 함수 뒤에 둔다.
- 완료·공유 RPC는 개인 완료 기록을 먼저 확인하고 익명화된 공유 사본만 만든다.

## 유지한 인덱스

`recipe_catalog.ingredients(recipe_id)`, `normalized_name`, `parent_ingredient`, `search_key`와 `recipes(name)` 검색 인덱스는 점검 시 scan 수가 0이었다. 반면 레시피 상세 조립용 `recipe_id`·`steps(recipe_id, step_no)` 계열은 실제 사용 기록이 있었다. 검색 인덱스는 데이터 규모가 크지 않은 심사 기간의 낮은 호출량만으로 불필요하다고 판단할 수 없고, 향후 구조화 재료 조합과 이름 검색 경로에 직접 대응하므로 삭제하지 않았다.

## 실행 검증

| 범위 | 결과 |
| --- | --- |
| 로컬 Node 회귀 테스트 | 178개 통과, 실패 0 |
| 엄격한 TypeScript | 통과 |
| Expo SDK 의존성 검사 | 호환 버전 일치 |
| Expo 공개 config | 파싱 성공, 출력에 secret 기록 안 함 |
| 웹 정적 export | `index.html`과 번들 생성 확인 후 임시 산출물 제거 |
| 게스트 bootstrap/reset | 독립된 30종 재고와 500g/ml 기본 조미료 확인 |
| 소비기한 | 냉장·냉동 고등어 규칙 분리와 날짜 캐시 확인 |
| 채팅 재고 | 승인 전 무변경, 추가·소비·초과·재시도·사용자 격리 통과 |
| 레시피·요리 완료 | 구매 0개 레시피 생성과 lot 차감·멱등 계약 통과 |
| 로컬 브라우저 | 로그인, 홈, 6개 탭, 구매/직접 입력 모달 확인; console error 0 |

원격 `remote-menu-chat-smoke`의 첫 실행에서 위 알레르기 후보 재시도 결함을 재현했다. 동일 요청이 모델 출력에 따라 통과하기도 하므로 단순 재실행 성공으로 덮지 않고 배포 전 필수 수정으로 남겼다.

## 남은 운영 점검

1. 로컬의 알레르기 후보 재시도 수정본을 `menu-chat`에 배포한 뒤 원격 메뉴 스모크를 다시 통과시킨다.
2. Google OAuth를 연결한 뒤 일반 사용자와 게스트 RLS 경계를 함께 재검증한다.
3. Android APK 전 최종 E2E에서 사진 보관함 선택부터 OCR·등록·요리 차감까지 실기기 요청을 확인한다.
4. 심사 직전 Edge Function 버전, project health, migration 일치, rate limit과 OpenAI 예산 한도를 다시 확인한다.
5. 후속 30일 채팅 정리와 7일 비활성 게스트 정리 작업을 실제 스케줄 기준으로 별도 검증한다.
