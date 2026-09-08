---
name: maintaining-app-agents
description: Use when creating, auditing, refactoring, or maintaining AGENTS.md for an app-development repository, especially when it is bloated, duplicates PRD or TRD content, increases startup context, or needs task-specific document routing.
---

# Maintaining App AGENTS.md

## Overview

Treat `AGENTS.md` as a small bootstrap and context router, not the project's knowledge base. Preserve details in authoritative documents and load them only when the current task needs them.

## Required outcome

The root `AGENTS.md` contains only:

1. its scope;
2. invariants that apply to every task;
3. a task-to-document routing table;
4. rules for where future information is stored;
5. a short completion or verification contract.

Use [assets/AGENTS.template.md](assets/AGENTS.template.md) for a new app repository. Adapt names and gates to the project; do not copy unused rows.

## Workflow

1. Inspect the current instruction chain and repository documents. Codex reads global guidance first, then at most one instruction file in each directory from project root toward the working directory; directories without one are skipped and nearer files take precedence. An `AGENTS.override.md` wins over `AGENTS.md` in the same directory. Sibling component instructions are outside that chain.
2. Inventory each existing `AGENTS.md` block before removing anything. Classify it with the table below and record its destination.
3. Move topic detail without loss, then replace it with the narrowest useful routing row. A linked document is not automatically loaded, so name the task trigger plus a heading or search keyword.
4. Put component-only invariants in the nearest component `AGENTS.md`. Put component detail in that component's docs and route to it. Cross-component tasks must route explicitly to affected sibling contracts or instructions.
5. Validate every destination and representative working directory before reporting completion.

## Quick reference

| Information | Canonical location |
| --- | --- |
| Universal safety, authorization, quality gate | Root `AGENTS.md` |
| Component-wide invariant | Nearest scoped `AGENTS.md` |
| Product goal, user, MVP | Product plan |
| Feature behavior and acceptance criteria | PRD |
| Architecture, API, data, security, tests | TRD or focused technical doc |
| Cross-feature decision and rationale | Decision log |
| Progress, owner, blocker | TODO or tracker |
| User intervention or approval | Human-in-the-loop log, if the project uses one |
| New topic with no suitable home | Focused `docs/<TOPIC>.md` |

When adding new information, update an existing canonical document if it has the same owner and lifecycle. Otherwise create one focused document. Add only a path-and-trigger row to `AGENTS.md`, and only when future agents need help discovering it. For cross-cutting behavior, keep user-observable behavior in the PRD and implementation contracts in the TRD; link them instead of duplicating the same body.

## Validation contract

- Every removed block maps to an existing destination. If the user requires complete preservation, or the block affects security, authorization, data loss, billing, or release safety, compare every block; otherwise spot-check meaning, commands, constraints, and acceptance criteria.
- Every routed path and named heading exists.
- The root file does not duplicate feature specs, API schemas, screen copy, deployment runbooks, or decision history.
- A fresh agent can identify the right document from `AGENTS.md` alone without reading all docs.
- Test from the root and each affected component directory; do not invent unrelated test locations.
- Inspect the diff and compare instruction size before and after. Do not claim token savings as an exact percentage without measured usage.

## Common mistakes and red flags

| Rationalization | Correction |
| --- | --- |
| "Agents might miss it, so copy everything here." | Make the routing trigger explicit and keep one authoritative body. |
| "Deleting detail makes refactoring faster." | Move and verify it before deleting the original. |
| "Every linked document should be read at startup." | Route by task and relevant section or keyword. |
| "One root file is simpler for a monorepo." | Keep shared invariants at root and scope component rules near their code. |
| "Create a new doc for every request." | Prefer an existing canonical document when its ownership matches. |

Stop if a block has no safe destination, two documents both claim authority, or a requested move would weaken a security or authorization rule. Resolve that ownership conflict before shrinking the instruction file.
