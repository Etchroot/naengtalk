# Chat Inventory Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn explicit chat inventory statements into editable, user-approved, atomic stock changes.

**Architecture:** The menu-chat Edge Function returns a bounded structured change proposal rather than claiming a write. The app reviews additions via the existing inventory parser and all operations in one modal. A new authenticated PostgreSQL RPC locks owner lots, checks overdraw, and commits all approved operations plus an idempotent event together.

**Tech Stack:** Expo React Native, Supabase Edge Functions and PostgreSQL, OpenAI Luna structured output, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-chat-inventory-changes-design.md`

## Global Constraints

- Do not commit or push until the user explicitly requests it.
- Do not change prior user work or expose service-role keys to clients.
- No chat inventory mutation before explicit approval.
- Unknown consumed ingredients are ignored, not invented or inserted.
- Reuse current `inventory-parse` shelf-life estimation and guest owner isolation.

---

### Task 1: Conversation change contract

**Files:** `supabase/functions/_shared/menu-chat-contract.ts`, `supabase/functions/menu-chat/index.ts`, `mobile/src/domain/menu-chat.ts`, `tests/menu-chat-inventory.test.ts`.

**Interfaces:** `MenuChatResponse.inventoryChanges` is an array of `{action,name,ingredientKey,quantity,unit,all}`. `reply_only` has none. The server never writes stock during classification.

- [ ] Write failing tests for explicit addition/consumption/all/set versus non-changing chat and response sanitization.
- [ ] Confirm targeted test fails because the change contract is absent.
- [ ] Add Luna schema, evidence/size validation, neutral review reply, and client parser.
- [ ] Run targeted and existing menu-chat tests.

### Task 2: Atomic inventory command

**Files:** `supabase/migrations/202609130002_chat_inventory_change.sql`, `mobile/src/domain/chat-inventory.ts`, `mobile/src/services/chat-inventory.ts`, `tests/chat-inventory.test.ts`.

**Interfaces:** `apply_chat_inventory_change(request_key text, changes jsonb)` returns `applied`, `already_applied`, `needs_confirmation`, or `no_change`, with overdraw details and actual effects.

- [ ] Write failing tests for edit validation, stock aggregation, missing-stock skip, overdraw handling, idempotency, and SQL contract.
- [ ] Confirm tests fail for missing behavior.
- [ ] Add the owner-scoped, lot-locking PostgreSQL RPC and client request builder/service.
- [ ] Run targeted tests, SQL lint, and remote smoke test using a fresh guest.

### Task 3: Review UI

**Files:** `mobile/src/features/NaengTalk.tsx`, `mobile/src/domain/chat-inventory.ts`, `tests/chat-inventory.test.ts`.

**Interfaces:** Editable chat inventory proposal, confirm/cancel, sequential overdraw popup, and post-commit inventory refresh.

- [ ] Write failing state/validation tests for approval gating and cap-to-current conversion.
- [ ] Confirm tests fail for missing behavior.
- [ ] Connect chat response, existing `inventory-parse` for additions, review modal, remote RPC, and actual-result chat message.
- [ ] Run targeted tests and TypeScript check; inspect live web behavior.

### Task 4: Documentation and deployment

**Files:** `docs/PRD.md`, `docs/TRD.md`, `docs/PRODUCT_DECISIONS.md`, `TODO.md`, `HUMAN-IN-THE-ROOF.md`.

- [ ] Record approved behavior and limitations without growing `AGENTS.md`.
- [ ] Run full tests, TypeScript, `git diff --check`, SQL lint; verify no secrets or source CSVs tracked.
- [ ] Apply migration, deploy Edge Function, export and deploy web; verify guest add/consume/overdraw and unchanged state before approval.
- [ ] Leave every file uncommitted and report production URL and remaining manual checks.
