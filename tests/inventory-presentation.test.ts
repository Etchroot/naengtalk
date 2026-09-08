import { test } from "node:test";
import assert from "node:assert/strict";
import { sortInventory } from "../mobile/src/domain/inventory-presentation.ts";

const inventory = [
  { id: "onion", name: "양파", quantity: 2, unit: "개", useBy: "2026-09-22", estimated: true },
  { id: "egg", name: "계란", quantity: 10, unit: "개", useBy: "2026-09-15", estimated: true },
  { id: "potato", name: "감자", quantity: 3, unit: "개", useBy: "2026-09-29", estimated: true },
  { id: "tofu", name: "두부", quantity: 300, unit: "g", useBy: "2026-09-11", estimated: true },
];

test("expiry sorting puts the closest recommended use-by date first", () => {
  assert.deepEqual(
    sortInventory(inventory, "expiry").map((item) => item.name),
    ["두부", "계란", "양파", "감자"],
  );
});

test("name sorting follows Korean alphabetical order", () => {
  assert.deepEqual(
    sortInventory(inventory, "name").map((item) => item.name),
    ["감자", "계란", "두부", "양파"],
  );
});

test("sorting does not mutate the stored inventory order", () => {
  sortInventory(inventory, "expiry");
  assert.deepEqual(inventory.map((item) => item.name), ["양파", "계란", "감자", "두부"]);
});
