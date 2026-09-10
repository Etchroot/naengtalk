# Shared Shelf Life and OCR Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cache-first shared shelf-life resolution, editable OCR review, final transactional registration, and multi-image selection for web and Android.

**Architecture:** The authenticated `purchase-ocr` Edge Function remains the single image-analysis boundary, then enriches normalized food items from a read-only shared `shelf_life_rules` cache and searches only cache misses. The client analyzes selected images sequentially, combines successful items into editable review rows, and sends only validated final rows to an idempotent database RPC.

**Tech Stack:** Expo 55, React Native, Expo ImagePicker, TypeScript, Supabase Edge Functions/Deno, PostgreSQL/RLS, OpenAI Responses API.

**Spec:** `docs/superpowers/specs/2026-09-10-shared-shelf-life-ocr-review-design.md`

## Global Constraints

- Android and web must use the same OCR and review flow.
- Select at most 10 JPEG, PNG, or WebP images; each image must be at most 5MB.
- OCR daily usage is charged once per analyzed image.
- Images and raw OCR text must not be persisted; OpenAI requests use `store: false`.
- Official or user-edited dates override estimated shared rules.
- Only server-side code may write shared shelf-life rules.
- No inventory row is inserted before the final `등록` action.

---

### Task 1: Shared shelf-life schema and deterministic contracts

**Files:**
- Create: `supabase/migrations/202609100001_shared_shelf_life.sql`
- Create: `mobile/src/domain/shelf-life.ts`
- Create: `supabase/functions/_shared/shelf-life-contract.ts`
- Modify: `tests/purchase-ocr.test.ts`
- Modify: `tests/supabase-migration.test.ts`

**Interfaces:**
- Produces: `canonicalShelfLifeKey(name, storageMethod, packageState)`, `buildShelfLifeSearchRequest(misses)`, `parseShelfLifeSearchResponse(input, allowedSources)`, `applyShelfLifeRules(items, rules, baseDate)`.
- Produces DB table `shelf_life_rules`, inventory metadata columns, and RPC `register_inventory_import(request_key uuid, items jsonb)`.

- [ ] **Step 1: Write failing tests** for canonical key equality, cache hit/miss partitioning, invalid/unreferenced source rejection, conservative fallback review status, final candidate validation, and idempotent RPC security declarations.
- [ ] **Step 2: Run focused tests and verify RED** because the migration and shelf-life modules do not exist.
- [ ] **Step 3: Implement minimal deterministic domain and request contracts** with literal allowed values, 365-day staleness, HTTPS source validation, and category fallback values.
- [ ] **Step 4: Add the migration** with authenticated read-only cache access, server-only writes, unique rule keys, inventory audit fields, and an owner-scoped idempotent registration RPC.
- [ ] **Step 5: Run focused tests and verify GREEN.**

### Task 2: Cache-first shelf-life enrichment in the OCR Edge Function

**Files:**
- Create: `supabase/functions/_shared/shelf-life-resolver.ts`
- Modify: `supabase/functions/purchase-ocr/index.ts`
- Modify: `supabase/functions/_shared/purchase-ocr-contract.ts`
- Modify: `tests/purchase-ocr.test.ts`

**Interfaces:**
- Consumes: shared rule types and OpenAI request/response contract from Task 1.
- Produces: OCR item fields `recommendedUseBy`, `shelfLifeStatus`, `storageMethod`, `packageState`, `internalNote`.

- [ ] **Step 1: Write failing tests** proving cached rules suppress searches, only misses enter the search request, source URLs must match retrieved OpenAI sources, and a failed search returns a review-required fallback.
- [ ] **Step 2: Run focused tests and verify RED** against the unchanged Edge Function contract.
- [ ] **Step 3: Implement service-role cache reads/upserts and one bounded web-search request** using `tools: [{ type: 'web_search' }]`, `include: ['web_search_call.action.sources']`, `max_tool_calls`, `store: false`, and strict structured output.
- [ ] **Step 4: Enrich each OCR response before returning it** while preserving the image-per-request rate limit and privacy behavior.
- [ ] **Step 5: Run focused tests and verify GREEN.**

### Task 3: Multi-image selection and editable review model

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Create: `mobile/src/domain/purchase-review.ts`
- Create: `mobile/src/services/purchase-images.ts`
- Modify: `mobile/src/services/purchase-ocr.ts`
- Modify: `mobile/src/services/register-inventory.ts`
- Create: `tests/purchase-review.test.ts`

**Interfaces:**
- Produces: `PurchaseImageSelection`, `mergePurchaseSelections`, `buildPurchaseReviewRows`, `updatePurchaseReviewRow`, `validatePurchaseReviewRows`, `toInventoryImportPayload`.
- Produces: `pickPurchaseImages()` using Expo ImagePicker and `analyzePurchaseImage(selection)`.
- Changes registration service to call `register_inventory_import` with a UUID idempotency key.

- [ ] **Step 1: Write failing tests** for 10-image cap, stable result merge after partial failure, review-first sorting, quantity parsing, date validation, duplicate detection, and user-edited audit status.
- [ ] **Step 2: Run focused tests and verify RED** because the review module is absent.
- [ ] **Step 3: Install the Expo-compatible ImagePicker package** and implement the platform-neutral selection adapter.
- [ ] **Step 4: Implement the review-domain functions and RPC payload builder.**
- [ ] **Step 5: Run focused tests and verify GREEN.**

### Task 4: Registration modal UI and end-to-end client flow

**Files:**
- Modify: `mobile/src/features/NaengTalk.tsx`
- Modify: `mobile/app.json`
- Modify: `tests/purchase-review.test.ts`

**Interfaces:**
- Consumes selection, analysis, review, validation, and registration interfaces from Task 3.
- Produces the user-visible sample/direct image selector and editable review modal.

- [ ] **Step 1: Add a failing reducer/domain test** for preserving successful rows and user edits when a later image fails.
- [ ] **Step 2: Run the focused test and verify RED.**
- [ ] **Step 3: Replace single-sample state with selected images and per-image progress**; sample cards toggle selection instead of immediately analyzing.
- [ ] **Step 4: Add `이미지 등록` above `닫기` and `선택한 이미지 분석` for the current selection.**
- [ ] **Step 5: Build the editable review list** showing only name, combined quantity/unit, and recommended date; sort review items first, add warning copy and red borders, and validate on final registration.
- [ ] **Step 6: Preserve successful rows on partial failure and route successful final registration to inventory.**
- [ ] **Step 7: Run focused tests, TypeScript, and Expo web export.**

### Task 5: Product documentation and final verification

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/TRD.md`
- Modify: `docs/PRODUCT_DECISIONS.md`
- Modify: `docs/OCR_SAMPLE_RESULTS.md`
- Modify: `TODO.md`
- Modify: `HUMAN-IN-THE-ROOF.md`
- Modify: `README.md`

**Interfaces:**
- Consumes the verified implementation behavior from Tasks 1–4.
- Produces the current source of truth and deployment handoff.

- [ ] **Step 1: Update product and technical documents** with shared-cache fields, lookup rules, multi-image limits, editable review flow, privacy, and remaining deployment steps.
- [ ] **Step 2: Record the user decision and progress** in `HUMAN-IN-THE-ROOF.md` and `TODO.md`.
- [ ] **Step 3: Run the complete test suite, TypeScript check, production web export, `git diff --check`, and secret-pattern scan.**
- [ ] **Step 4: Visually verify the web selector and review modal** at an Android phone aspect ratio.
- [ ] **Step 5: Commit and push the verified change to the approved `main` branch.**
