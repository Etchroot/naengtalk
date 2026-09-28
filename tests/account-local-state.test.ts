import assert from "node:assert/strict";
import test from "node:test";
import { accountStateKey, restoreAccountState, serializeAccountState } from "../mobile/src/domain/account-local-state.ts";
import type { LocalState } from "../mobile/src/features/naengtalk/model.ts";

test("account storage keys isolate two accounts", () => {
  assert.notEqual(accountStateKey("guest-1"), accountStateKey("google-1"));
});

test("restored device preferences cannot override server inventory", () => {
  const initial = { tools: [], allergens: [], inventory: [] } as unknown as LocalState;
  const serverInventory = [{ id: "server" }] as LocalState["inventory"];
  const stored = JSON.stringify({ tools: ["냄비"], allergens: ["새우"], inventory: [{ id: "other-user" }] });
  const restored = restoreAccountState(stored, initial, serverInventory);
  assert.deepEqual(restored.tools, ["냄비"]);
  assert.deepEqual(restored.inventory, serverInventory);
  assert.deepEqual(JSON.parse(serializeAccountState(restored)).inventory, []);
});

test("corrupt account cache falls back to the account's initial state", () => {
  const initial = { tools: [], inventory: [] } as unknown as LocalState;
  assert.deepEqual(restoreAccountState("{", initial, []), initial);
});
