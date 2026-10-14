# Error Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메뉴 상담 실패가 어느 단계에서 어떤 검증 코드로 발생했는지 운영자가 요청 추적 번호로 확인할 수 있게 하고, 사용자에게는 안전한 오류 문구와 추적 번호를 함께 표시한다.

**Architecture:** 기존 `observability.ai_request_traces` 한 행에 단계별 진단 필드를 추가한다. Edge Function은 최초 생성 실패와 재작성 실패를 각각 기록하고 마지막 실제 실패를 그대로 응답·trace에 사용한다. 모바일·웹 클라이언트는 Edge 응답의 `x-request-id`를 읽어 오류 메시지 아래에 추적 번호를 붙인다.

**Tech Stack:** Supabase PostgreSQL migration, Supabase Edge Functions/Deno TypeScript, Expo/React Native TypeScript, Node test runner.

**Spec:** `docs/TRD.md`의 `menu-chat 영구 관측`, `docs/PRD.md`의 `FR-4. 대화형 메뉴 상담`, `docs/PRODUCT_DECISIONS.md`의 2026-10-11 관측 결정.

## Global Constraints

- 배포·원격 migration 적용·커밋·푸시는 이번 작업에 포함하지 않는다.
- 대화 원문, history, 재고 목록·재고명, 레시피, 프롬프트, 모델 입출력, 이메일, API 키를 trace에 저장하지 않는다.
- 관측 실패는 정상 사용자 응답을 실패시키지 않고 추가 OpenAI 호출을 만들지 않는다.
- 요청 ID는 UUID 전체를 서버에 저장하고 클라이언트에는 동일 값을 `오류 추적 번호`로 표시한다.
- 실패 단계 값은 허용 목록으로 제한한다: `auth`, `request_parse`, `rate_limit`, `inventory_query`, `intent_model`, `intent_parse`, `catalog_search`, `terra_initial`, `validation_initial`, `terra_repair`, `validation_repair`, `response`, `unknown`.
- 진단 코드는 각각 최대 64자이며 콘텐츠가 아닌 기계 판독용 상수만 허용한다.
- 기존 사용자 변경과 현재 dirty worktree를 보존하며 작업 대상 파일 외의 변경을 되돌리지 않는다.

## Review Focus

- 최초 검증은 `PURCHASE_LIMIT_EXCEEDED`, 재작성 검증은 `REQUESTED_INGREDIENT_MISSING`일 때 최종 코드가 후자로 남아야 한다.
- 최초 실패 후 재작성 성공이면 최초 실패 필드는 남되 최종 실패 단계·코드는 null이어야 한다.
- OpenAI/DB/인증처럼 검증 외 오류도 적절한 단계와 최종 코드로 기록되어야 한다.
- 추적 번호가 없거나 비정상 헤더인 경우 클라이언트는 임의 값을 표시하지 않아야 한다.
- trace payload와 migration RPC는 금지된 콘텐츠 키와 과도한 라벨을 계속 거절해야 한다.

---

### Task 1: 서버 단계별 진단과 실제 최종 오류 보존

**Files:**
- Modify: `supabase/functions/_shared/ai-request-observability.ts`
- Modify: `supabase/functions/menu-chat/index.ts`
- Create: `supabase/migrations/202610110002_ai_error_diagnostics.sql`
- Modify: `tests/ai-request-observability.test.ts`
- Modify: `tests/menu-chat-edge.test.ts`
- Create: `tests/ai-error-diagnostics-migration.test.ts`

**Interfaces:**
- Produces `AiFailureStage` union and trace fields `initialFailureCode`, `repairFailureCode`, `finalFailureCode`, `failureStage`.
- Produces bounded payload keys `initial_failure_code`, `repair_failure_code`, `final_failure_code`, `failure_stage`.
- Preserves current `error_code` as the HTTP-facing final error code for compatibility.
- Migration alters the private trace table and replaces `record_ai_request_trace(jsonb)` so the four new fields are validated and inserted.

- [ ] **Step 1: Write failing tests**
  - Trace summary exposes the four bounded fields and contains no user content.
  - First validation failure followed by a different repair validation failure returns HTTP 422 with the repair code as `error_code`/`final_failure_code`, while both attempt fields remain distinct.
  - Repair success retains `initial_failure_code` but leaves `final_failure_code` and `failure_stage` null.
  - Migration behavior test applies or structurally validates the new columns, whitelist checks, RPC bounds and insert mapping using the repository's established migration-test pattern.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/ai-request-observability.test.ts tests/menu-chat-edge.test.ts tests/ai-error-diagnostics-migration.test.ts`

Expected: failures because the new fields and true repair error preservation do not exist.

- [ ] **Step 3: Implement minimal server behavior**
  - Add a small helper that records an attempt failure without accepting free-form content.
  - Classify validation constants separately from provider/infrastructure constants.
  - On repair failure, rethrow the actual accepted failure instead of unconditionally throwing `PURCHASE_LIMIT_EXCEEDED`.
  - Set a stage before every controlled early error response or thrown boundary; unknown errors fall back to `unknown`.
  - Add a forward-only migration; do not edit the already deployed `202610110001` migration.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/ai-request-observability.test.ts tests/menu-chat-edge.test.ts tests/ai-error-diagnostics-migration.test.ts`

Expected: all focused tests pass.

### Task 2: 클라이언트 오류 추적 번호 표시

**Files:**
- Modify: `mobile/src/domain/function-error.ts`
- Modify: `mobile/src/services/menu-chat.ts`
- Modify: `tests/function-error.test.ts`

**Interfaces:**
- Consumes the Edge Function `x-request-id` response header.
- Produces a safe user-visible error string: `<서버 문구>\n오류 추적 번호: <UUID>` when a valid UUID is present.
- Keeps the existing fallback when the response body is malformed, and appends a valid request ID even when only the fallback is safe.

- [ ] **Step 1: Write failing tests**
  - Safe 422 JSON plus valid `x-request-id` yields the message and tracking line.
  - Malformed JSON plus valid ID yields the fallback and tracking line.
  - Missing or malformed ID never appears.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/function-error.test.ts`

Expected: tracking-number assertions fail.

- [ ] **Step 3: Implement minimal client behavior**
  - Validate UUID shape before display.
  - Read the header before parsing the cloned response body.
  - Keep internal failure codes and stages out of the user message.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/function-error.test.ts`

Expected: all focused tests pass.

### Task 3: 문서 계약과 전체 회귀 검증

**Files:**
- Modify: `docs/TRD.md`
- Modify: `docs/PRD.md`
- Modify: `docs/PRODUCT_DECISIONS.md`
- Modify: `TODO.md`
- Modify: `HUMAN-IN-THE-ROOF.md`

**Interfaces:**
- Documents the exact diagnostic field names, stage whitelist, privacy rules, support-code UX and deployment-pending state.

- [ ] **Step 1: Update only the relevant document sections**
  - Record that `x-request-id` is shown as an error tracking number.
  - Record first/repair/final failure preservation and stage taxonomy.
  - Mark local implementation/verification complete and production migration/function deployment pending.

- [ ] **Step 2: Run full verification**

Run: `npm test`

Expected: zero failures.

Run: `pnpm --dir mobile exec tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Review repository diff**
  - Confirm no secret or content field is stored.
  - Confirm no unrelated dirty changes were overwritten.
  - Confirm no deployment, commit or push occurred.
