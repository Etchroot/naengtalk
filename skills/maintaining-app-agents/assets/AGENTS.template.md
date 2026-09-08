# <Project name> agent guide

This file applies to <scope>. At the start of a task, read only this file. Use the routing table to load only the document and section relevant to the current work.

## 1. Always-on rules

1. Preserve user and collaborator changes; do not revert unrelated work.
2. Read and follow any skill or plugin that applies to the task.
3. Recheck mutable facts such as APIs, pricing, policies, and release requirements from authoritative sources when needed.
4. Keep secrets and personal data out of the repository, client bundle, documentation, and logs.
5. Verify the changed behavior or artifact before reporting completion.

## 2. Project gates

- <Add only authorization, planning-to-development, release, compliance, or destructive-action gates that apply broadly. Remove this section if none exist.>

## 3. Task context routing

Search for the named heading or keyword and read only the relevant section unless the whole document is necessary.

| Task | Read first |
| --- | --- |
| Product goal, target user, value, MVP | `docs/PRODUCT_PLAN.md` - relevant section |
| Feature flow, UI behavior, acceptance criteria | `docs/PRD.md` - target feature |
| Architecture, API, database, AI, security, tests | `docs/TRD.md` - target system |
| Confirmed cross-feature decisions | `docs/DECISIONS.md` - keyword search |
| Current work, owner, blocker | `TODO.md` - related item |

Delete unused rows and add project-specific routes only when they improve discovery.

## 4. Information ownership

- Do not accumulate feature or technical detail in this file.
- Update the existing canonical document when the topic fits its scope.
- Otherwise create a focused `docs/<TOPIC>.md` and add one routing row here only if later work must discover it.
- When a decision changes behavior, update the affected specification and the project's tracking or decision record in the same task.

## 5. Completion contract

- Confirm changed files and preserve unrelated edits.
- Run the smallest relevant tests, build, render, or link checks.
- Report verified results and any remaining blocker.
