# Recipe Routing and Community Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use public and shared recipe DBs before Terra generation and share only completed AI-generated recipes.

**Architecture:** Service-only Supabase RPCs search the private catalog and shared snapshots. The Edge Function selects one candidate or generates with Terra without web tools. A transactional completion RPC conditionally publishes a sanitized independent snapshot; the app only holds pre-completion share intent in state.

**Tech Stack:** Supabase PostgreSQL/PLpgSQL, Edge Functions TypeScript, OpenAI Responses API, Expo React Native, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-recipe-routing-community-sharing-design.md`

## Global Constraints

- No Git commit or push until the user explicitly asks.
- Do not modify source CSVs or expose `recipe_catalog` directly to browser/mobile clients.
- No recipe website search or external recipe content import.
- Shared AI recipes must already exist in a user's completed private recipe record.
- Preserve existing cooking deduction/idempotency behavior and guest isolation.

---

### Task 1: Search and sharing schema

**Files:** Create `supabase/migrations/202609130001_recipe_search_sharing.sql`; test `tests/recipe-search-sharing-migration.test.ts`.

**Interfaces:** `public.search_recipe_candidates(query_name text, ingredient_names text[], source_kind text)` returns bounded JSON; `public.complete_recipe_cooking_shared(recipe_title text, recipe_content jsonb, usage_lines jsonb, request_key text, share_after_completion boolean)` returns completion JSON; `public.share_completed_ai_recipe(target_recipe_id uuid)` returns shared ID.

- [x] Write failing tests for private catalog lookup, shared snapshot isolation, ownership/completion checks, and completion atomicity.
- [x] Run targeted tests and confirm failure due to absent migration.
- [x] Add tables, indexes, service-role search RPC, authenticated publish and completion RPCs with grants/RLS.
- [x] Run targeted tests and linked remote SQL lint; correct migration errors.

### Task 2: Candidate ranking and Edge orchestration

**Files:** Create `supabase/functions/_shared/recipe-routing.ts`; modify `supabase/functions/menu-chat/index.ts`, `supabase/functions/_shared/menu-chat-contract.ts`, `supabase/functions/_shared/recipe-guidelines.ts`; test `tests/recipe-routing.test.ts`, `tests/menu-chat.test.ts`.

**Interfaces:** `rankRecipeCandidates(request, candidates)` selects one trusted DB candidate; `buildRecipeInstructions(mode)` differentiates personalization and new generation; Edge response has server-assigned `origin`.

- [x] Write failing ranking tests for named dish, ingredient match, low confidence, and public-before-shared order.
- [x] Run targeted tests and confirm behavior failure.
- [x] Implement deterministic ranking, bounded RPC reads, Terra personalization/generation with no `web_search` tools, and schema-safe responses.
- [x] Run targeted and full tests; confirm previous allergen/quantity rules remain intact.

### Task 3: Client contract and consent

**Files:** Modify `mobile/src/domain/menu-chat.ts`, `mobile/src/services/remote-cooking.ts`, `mobile/src/features/NaengTalk.tsx`; create `mobile/src/domain/recipe-sharing.ts`; test `tests/recipe-sharing.test.ts`, `tests/menu-chat.test.ts`.

**Interfaces:** `MenuRecipe.origin` identifies share eligibility; `completeRemoteCooking({... shareAfterCompletion })` passes share intent; `shareCompletedAiRecipe(id)` publishes an already-completed recipe.

- [x] Write failing tests for pending intent reset, no pre-completion write, consent state, and completion payload.
- [x] Run targeted tests and confirm expected failures.
- [x] Add empty/filled thumb, exact confirmation modal, pending state bound to proposal, and server-confirmed completion behavior.
- [ ] Run targeted and full tests, TypeScript check, and manual UI flow (automated checks passed; user visual verification pending).

### Task 4: Documentation and remote verification

**Files:** Modify `docs/PRD.md`, `docs/TRD.md`, `docs/PRODUCT_DECISIONS.md`, `TODO.md`, `HUMAN-IN-THE-ROOF.md`.

- [x] Record approved search priority and share-on-completion policy without adding detail to `AGENTS.md`.
- [x] Confirm `git diff --check`, full test suite, SQL migration status, and no tracked CSV/secret files.
- [x] Apply migration and deploy `menu-chat` only after local checks; verify public/shared/AI paths and one share-on-completion path remotely.
- [x] Leave every change uncommitted for user testing and report the exact test URL/status.
