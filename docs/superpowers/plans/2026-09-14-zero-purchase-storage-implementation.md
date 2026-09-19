# 구매 0개 레시피·보관 상태 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구매 0개 조리 가능한 레시피를 최우선으로 추천하고, 모든 명시적 냉동 식품을 냉동 상태의 공용 소진일 규칙으로 처리한다.

**Architecture:** 후보 검색은 재고 이름만 사용하고 구매 예상 수를 우선 정렬한다. Terra가 변형한 최종 결과는 서버에서 실제 재고와 대조하여 구매 2개 이상을 차단한다. OCR·직접 입력·채팅 추가는 기존 공용 소진일 resolver를 공유하고, 새 재고 lot의 보관 상태만 별도 저장한다.

**Tech Stack:** Expo React Native, Supabase Edge Functions/Deno, PostgreSQL migration, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-14-zero-purchase-recipes-storage-aware-shelf-life-design.md`

## Global Constraints

- 기존 미커밋 작업 보존. 사용자의 테스트 및 명시적 요청 전 Git 커밋·푸시 금지.
- 공공 CSV 변경 금지. `shelf_life_rules` 중복 생성 금지.
- OpenAI와 service role 키는 서버에서만 사용.

---

### Task 1: 레시피 후보와 최종 재고 검증

**Files:** `tests/recipe-routing.test.ts`, `tests/recipe-inventory-guard.test.ts`, `supabase/functions/_shared/recipe-routing.ts`, `supabase/functions/_shared/recipe-inventory-guard.ts`, `supabase/functions/_shared/recipe-guidelines.ts`, `supabase/functions/menu-chat/index.ts`.

**Interfaces:** `rankRecipeCandidates(dishName, pantryCount, candidates)`는 0개 구매 추정 후보를 먼저 반환한다. `checkRecipeInventory(recipe, inventory)`는 실제 lot으로 `missingNames`, `purchaseCount`, `correctedIngredients`를 반환한다.

- [ ] 이름 완전 일치라도 재고와 겹치지 않는 후보는 탈락하고 0개 구매가 1개 구매보다 먼저 오는 실패 테스트를 작성·실행한다.
- [ ] 없는 재료, 부족한 수량, 여러 lot 합산, T/t 환산, 물 제외, AI의 거짓 재고 표시를 검증하는 실패 테스트를 작성·실행한다.
- [ ] 최소 코드로 후보 순위와 서버 검증을 구현하고 단위 테스트를 재실행한다.
- [ ] Edge Function은 공공·공유·Terra를 구매 0개로 시도하고 유효한 결과가 없을 때만 최대 1개를 시도하도록 연결한다. 실패 시 불가능한 레시피를 반환하지 않는다.

### Task 2: 모든 식품의 명시적 냉동 보관·근거 없는 날짜 차단

**Files:** `tests/shelf-life.test.ts`, `tests/purchase-review.test.ts`, `supabase/functions/_shared/shelf-life-contract.ts`, `supabase/functions/_shared/shelf-life-resolver.ts`, `mobile/src/domain/purchase-review.ts`.

**Interfaces:** `shelfLifeLookupForItem(item)`은 정규화 식품명과 원문 보관 상태를 분리한다. 근거 미확보 시 `recommendedUseBy=null`로 검수 입력을 요구한다.

- [ ] `냉동 X`·`냉장 X`·상태 미표시 X가 올바른 별도 조회 키를 갖고 근거 없는 날짜는 비어 있는 실패 테스트를 작성·실행한다.
- [ ] 공용 resolver의 조회와 결과 보강에 동일한 상태 판별을 적용하고 테스트를 재실행한다.
- [ ] 등록 검수에서 빈 날짜는 최종 등록 불가 상태임을 검증한다.

### Task 3: 새 lot의 보관 상태 보존

**Files:** `supabase/migrations/202609140001_inventory_storage_method.sql`, `mobile/src/domain/purchase-review.ts`, `mobile/src/domain/remote-inventory.ts`, `mobile/src/services/remote-inventory.ts`, `tests/purchase-review.test.ts`, `tests/supabase-migration.test.ts`.

**Interfaces:** import payload의 `storage_method`는 nullable이며 `room_temperature|refrigerated|frozen`만 허용한다. 기존 lot은 null 그대로 둔다.

- [ ] 새 등록 payload와 SQL 저장 계약의 실패 테스트를 작성·실행한다.
- [ ] nullable 컬럼 및 기존 RPC의 상태 저장 기능을 새 migration으로 구현하고 테스트를 재실행한다.
- [ ] 필요한 화면에서 보관 상태를 확인·수정할 수 있게 연결한다.

### Task 4: 검증·배포·문서 정리

**Files:** `docs/PRD.md`, `docs/TRD.md`, `docs/PRODUCT_DECISIONS.md`, `TODO.md`, `HUMAN-IN-THE-ROOF.md`.

- [ ] 전체 Node 테스트, 모바일 TypeScript 검사, Expo 웹 export를 실행한다.
- [ ] Supabase migration 및 변경 Edge Functions를 배포하고 원격 흐름을 확인한다.
- [ ] Expo 웹을 배포하고 테스트 가능한 URL을 안내한다. Android APK는 아직 빌드하지 않는다.
- [ ] 실제 결과만 문서에 반영한다. Git 커밋·푸시는 하지 않는다.
