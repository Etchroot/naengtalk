# OpenAI MVP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect authenticated 냉톡 chat to OpenAI through a Supabase Edge Function and use the returned structured recipe in the existing detail, timer, and remote inventory deduction flow.

**Architecture:** The Expo client invokes one authenticated `menu-chat` Edge Function. The function reads the caller's inventory through RLS, routes simple conversation to Luna and recipe work to Terra, optionally enables constrained web search, validates a strict JSON contract, and returns user-safe JSON without exposing the OpenAI key.

**Tech Stack:** Expo SDK 55, React Native, TypeScript, Supabase Edge Functions (Deno), OpenAI Responses API, Node test runner

**Spec:** `docs/superpowers/specs/2026-09-09-openai-mvp-integration-design.md`

## Global Constraints

- OpenAI is the only generative AI provider.
- `OPENAI_API_KEY` is read only from Supabase Secrets and never committed or logged.
- General chat uses `gpt-5.6-luna`; recipe generation and revision use `gpt-5.6-terra`.
- The server reads inventory by authenticated user and never accepts client inventory as authoritative.
- OpenAI responses use `store: false` and bounded history/output.
- The initial automated suite stays minimal; full E2E is deferred until immediately before web and APK deployment.

---

### Task 1: Shared chat and recipe contract

**Files:**
- Create: `mobile/src/domain/menu-chat.ts`
- Test: `tests/menu-chat.test.ts`

**Interfaces:**
- Produces `sanitizeMenuChatRequest(input)` for bounded request payloads.
- Produces `parseMenuChatResponse(input)` for runtime validation.
- Produces `recipeUsage(recipe)` for safe inventory deduction lines.

- [x] Write tests covering history truncation, recipe parsing, deduction filtering, and invalid output rejection.
- [x] Run the focused tests and confirm they fail because the contract module is missing.
- [x] Implement the smallest validating contract and mapper.
- [x] Run the focused tests and confirm they pass.

### Task 2: Authenticated Supabase Edge Function

**Files:**
- Create: `supabase/functions/_shared/menu-chat-contract.ts`
- Create: `supabase/functions/menu-chat/index.ts`
- Create: `supabase/functions/menu-chat/config.toml`
- Create: `supabase/migrations/202609090002_ai_rate_limits.sql`

**Interfaces:**
- Consumes authenticated `MenuChatRequest` JSON.
- Produces a `MenuChatResponse` JSON body or a user-safe 4xx/5xx error.

- [x] Add an atomic per-user/day rate-limit RPC and least-privilege execute grant.
- [x] Implement CORS, JWT validation, RLS inventory lookup, and request validation.
- [x] Implement Luna intent routing and Terra structured recipe generation through `POST /v1/responses`.
- [x] Enable one `10000recipe.com` web search for recipe requests and return source links present in validated output.
- [x] Ensure `store: false`, timeouts, output limits, and secret-safe errors.

### Task 3: Dynamic client chat and recipe flow

**Files:**
- Create: `mobile/src/services/menu-chat.ts`
- Modify: `mobile/src/features/NaengTalk.tsx`

**Interfaces:**
- Consumes `sendMenuChat(request)`.
- Stores the latest validated recipe in component state.
- Passes generated recipe usage into the existing remote completion transaction.

- [x] Replace the single local message echo with bounded user/assistant history and a loading state.
- [x] Display the AI reply and show `레시피 전체 보기` only when a recipe exists.
- [x] Render dynamic title, ingredients, steps, timers, metadata, and sources in the existing modal.
- [x] Use generated, inventory-backed usage for completion and keep the sample fallback only in local validation mode.
- [x] Run focused tests and TypeScript checking.

### Task 4: Deployable handoff and documentation

**Files:**
- Modify: `README.md`
- Modify: `TODO.md`
- Modify: `HUMAN-IN-THE-ROOF.md`
- Create: `docs/OPENAI_SETUP.md`

**Interfaces:**
- Gives the user exact secret registration and smoke-test steps without exposing the key.

- [x] Document OpenAI project key creation, `OPENAI_API_KEY` Supabase Secret registration, deploy command, and $20 budget guard.
- [ ] Run the minimal automated suite, TypeScript check, and web export.
- [ ] Push the Edge Function and migration to the connected repository.
- [ ] After the user registers the secret, run one authenticated chat/recipe smoke test before full pre-deployment E2E.
