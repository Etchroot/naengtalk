# Supabase 점검 기록

- 점검일: 2026-09-27
- 프로젝트: `naengtalk`
- 프로젝트 ref: `ygdbvbjvnnoxyjeidnnj`
- 방식: Supabase CLI와 제한된 SQL을 사용한 읽기 전용 점검
- 비밀정보: API key, service role, access token과 사용자별 원문 데이터는 조회·기록하지 않음

## 결론

원격 프로젝트는 `ACTIVE_HEALTHY` 상태이며 로컬 migration과 원격 migration 이력은 일치했다. 데이터베이스 lint에서 schema 오류가 없었고, 핵심 Edge Function 세 개가 JWT 검증을 켠 채 활성 상태였다. 공공 레시피 적재 수량도 기대값과 일치했다.

이번 점검에서는 production 데이터를 수정하거나 migration·함수를 다시 배포하지 않았다. 사용량이 아직 적어 scan 수가 0인 검색 인덱스는 향후 재료 조합 검색 경로에 필요하므로 삭제하지 않았다.

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

`recipe_catalog.ingredients(recipe_id)`, `normalized_name`, `parent_ingredient`, `search_key`와 `steps(recipe_id, step_no)` 계열은 현재 scan 통계가 낮거나 0이어도 삭제하지 않았다. 데이터 규모가 크지 않은 심사 기간의 낮은 호출량만으로 불필요하다고 판단할 수 없고, 다중 재료 후보 검색과 상세 단계 조립에 직접 대응하기 때문이다.

## 남은 운영 점검

1. Google OAuth를 연결한 뒤 일반 사용자와 게스트 RLS 경계를 함께 재검증한다.
2. Android APK 전 최종 E2E에서 사진 보관함 선택부터 OCR·등록·요리 차감까지 실기기 요청을 확인한다.
3. 심사 직전 Edge Function 버전, project health, migration 일치, rate limit과 OpenAI 예산 한도를 다시 확인한다.
4. 후속 30일 채팅 정리와 7일 비활성 게스트 정리 작업을 실제 스케줄 기준으로 별도 검증한다.
