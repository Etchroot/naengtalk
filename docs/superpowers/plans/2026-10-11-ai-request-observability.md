# AI Request Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist privacy-minimized timing and usage summaries for every authenticated `menu-chat` request so slow responses can be diagnosed by user and time without storing conversation or inventory content.

**Architecture:** A private `observability` schema stores one bounded trace row per request and one daily aggregate row. A service-role-only RPC validates and inserts traces, rolls up the previous day once, and prunes normal traces after 30 days and slow/error/repaired traces after 90 days. The existing `menu-chat` Edge Function measures its current boundaries and writes the summary without making another OpenAI call or Edge invocation.

**Tech Stack:** Supabase PostgreSQL migration/RPC, Supabase Edge Function TypeScript, Node test runner.

**Spec:** `docs/TRD.md` AI gateway and model strategy sections; `docs/PRODUCT_DECISIONS.md` 2026-10-11 recipe and observability decisions.

## Global Constraints

- Store no chat message, conversation history, recipe body, inventory content, API key, or raw prompt.
- Store one trace row per authenticated request; the trace write must never change the user-facing response on failure.
- Keep ordinary traces 30 days and error, repaired, or at-least-15-second traces 90 days.
- Keep daily aggregate counts, average, P50, P95, error rate, repair rate, call count, and token totals.
- Restrict raw and aggregate data to service role; expose no client read policy.
- Cap one recipe request at one initial Terra call and one repair call.
- Do not deploy, commit, or push in this task.

## Review Focus

- Telemetry database failure must not replace a successful chat response.
- Authentication and rate-limit failures must have bounded, non-content error codes.
- Token and timing values from an untrusted upstream response must be normalized to nonnegative bounded integers.
- Concurrent first requests of a day must not corrupt daily rollups or retention cleanup.
- Repaired and slow requests must receive 90-day retention while ordinary successes receive 30 days.

---

### Task 1: Private observability schema and bounded RPC

**Files:**
- Create: `supabase/migrations/202610110001_ai_request_observability.sql`
- Test: `tests/ai-request-observability-migration.test.ts`

**Interfaces:**
- Consumes: service-role PostgREST JWT claims and one bounded JSON trace payload.
- Produces: `public.record_ai_request_trace(jsonb)` and private `observability.ai_request_traces`, `observability.ai_request_daily_metrics`, `observability.maintenance_state`.

- [x] Write migration contract tests for private grants, checks, retention classes, percentile rollup, one-row upsert, and service-role-only RPC.
- [x] Run `node --test tests/ai-request-observability-migration.test.ts` and verify the missing migration fails.
- [x] Implement the migration and rerun the test to green.

### Task 2: Trace state and bounded usage extraction

**Files:**
- Create: `supabase/functions/_shared/ai-request-observability.ts`
- Test: `tests/ai-request-observability.test.ts`

**Interfaces:**
- Consumes: wall-clock timer, OpenAI Responses API metadata, request outcome.
- Produces: `createAiRequestTrace`, `measureAiStage`, `recordOpenAiUsage`, `finishAiRequestTrace` and a bounded RPC payload.

- [x] Write tests for accumulated timings, usage totals, request IDs, repair reason, status, and content exclusion.
- [x] Run the focused test and verify missing exports fail.
- [x] Implement the minimal helper and rerun to green.

### Task 3: Instrument menu-chat without changing responses

**Files:**
- Modify: `supabase/functions/menu-chat/index.ts`
- Modify: `tests/menu-chat-edge.test.ts`

**Interfaces:**
- Consumes: Task 2 trace helper and Task 1 RPC.
- Produces: `x-request-id` response header and one best-effort trace RPC per authenticated request.

- [x] Extend the Edge integration fake to accept the trace RPC and add tests for success, one-repair, and trace-write failure paths.
- [x] Run the focused Edge tests and verify the absent trace call/header fails.
- [x] Instrument auth, rate limit, inventory, Luna, catalog, Terra initial, validation, Terra repair, token usage, and outcome.
- [x] Ensure trace persistence errors are swallowed and rerun the focused tests to green.

### Task 4: Documentation and full verification

**Files:**
- Modify: `docs/TRD.md`
- Modify: `docs/PRODUCT_DECISIONS.md`
- Modify: `TODO.md`
- Modify: `HUMAN-IN-THE-ROOF.md`

**Interfaces:**
- Consumes: implemented schema, RPC, and Edge behavior.
- Produces: current retention, privacy, cost, and support-diagnosis documentation.

- [x] Document stored/non-stored fields, retention, access, cost boundary, request-ID support flow, and deployment status.
- [x] Run `node --test tests/*.test.ts`.
- [x] Run `node_modules/.bin/tsc.cmd --noEmit` from `mobile`.
- [x] Run `git diff --check` on files in this plan and self-review the complete diff.

### Deployment follow-up

- 2026-10-11 사용자가 별도로 production 배포와 커밋·푸시를 승인했다.
- [x] `202610110001_ai_request_observability.sql` production 적용
- [x] `menu-chat` v14 배포 및 JWT 검증 확인
- [x] 원격 스모크 성공, DB lint 오류 0, 콘텐츠 없는 trace 1건 적재 확인
- [ ] 다음 날 첫 요청 이후 일별 집계 생성 확인
