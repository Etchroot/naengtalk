import type { LocalState } from "../features/naengtalk/model.ts";

export function accountStateKey(accountId: string): string {
  return `naengtalk-account-state-v1:${accountId}`;
}

export function restoreAccountState(
  raw: string | null,
  initial: LocalState,
  inventory: LocalState["inventory"],
): LocalState {
  if (!raw) return { ...initial, inventory };
  try {
    const stored = JSON.parse(raw) as Partial<LocalState>;
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return { ...initial, inventory };
    }
    return { ...initial, ...stored, inventory };
  } catch {
    return { ...initial, inventory };
  }
}

export function serializeAccountState(state: LocalState): string {
  return JSON.stringify({ ...state, inventory: [] });
}
