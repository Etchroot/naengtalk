# Guest UI, Seed, and Recipe Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase guest tool readability and count-based seed quantities, then prevent recoverable pantry-validation failures from appearing as generic AI outages.

**Architecture:** Keep the existing guest bootstrap/reset functions and the pantry guard. Add one server-side repair attempt after normal candidate attempts fail, with explicit missing-item feedback, and surface the server's safe error text in the client. Never return a recipe requiring more than one purchase.

**Tech Stack:** Expo/React Native, Supabase Postgres and Edge Functions, Node test runner, EAS Hosting.

**Spec:** User approval in this task; `docs/PRD.md` FR-5, FR-10, and `docs/TRD.md` menu-chat and guest-seed sections.

## Global Constraints

- Do not overwrite existing guest inventory; new guests or explicit sample reset receive the new seed.
- Preserve purchase-zero priority and the absolute maximum of one purchase.
- Keep secrets out of source, client bundles, tests, and logs.
- Do not commit or push; deploy the approved database, Edge Function, and web changes.

---

### Task 1: Guest display and count-based seed

**Files:** `mobile/src/features/NaengTalk.tsx`, `mobile/src/domain/seed.ts`, new Supabase migration, `tests/guest-demo.test.ts`.

**Interface:** `createGuestInventory(date)` and `guest_demo_seed_rows()` retain their signatures.

- [x] Add assertions that all `개`/`대` seed items have quantity 10; run the targeted test and observe the intended failure. Visual layout is verified through export and left for user screen review.
- [x] Change local seed and add an idempotent migration replacing only the seed helper's data, leaving existing user lots untouched; set tool label font size to 18px with a suitable line height.
- [x] Run targeted tests and verify migration effect for a new guest or explicit reset.

### Task 2: Recipe recovery and clear errors

**Files:** `supabase/functions/menu-chat/index.ts`, `mobile/src/services/menu-chat.ts`, possibly a small pure error helper, `tests/menu-chat-edge.test.ts`, a targeted client error test.

**Interface:** `sendMenuChat(input)` and the Edge request/response shape stay stable.

- [x] Add a test where normal AI attempts exceed the purchase cap, a constrained repair returns an in-stock recipe, and the server returns 200; observe failure.
- [x] Add a test where all attempts remain invalid and the server returns 422 without leaking the invalid recipe; observe failure if needed.
- [x] Add a test that the client surfaces a safe JSON error returned in a non-2xx HTTP response; observe failure.
- [x] Implement a single pantry-feedback repair request and safe client error extraction; rerun targeted tests.

### Task 3: Verify, document, and deploy

**Files:** targeted PRD/TRD/decision/TODO/human-intervention sections.

- [x] Run the full tests, TypeScript check, web export, and review the diff.
- [x] Update the relevant documentation sections with the approved change and deployment status.
- [x] Push the database migration, deploy `menu-chat`, deploy the web export to `https://naengtalk.expo.app/`, then smoke-test a fresh guest and the published URL.
