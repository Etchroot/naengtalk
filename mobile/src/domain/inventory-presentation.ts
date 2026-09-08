import type { InventoryItem } from "./cooking.ts";

export type InventorySortMode = "expiry" | "name";

const koreanNameOrder = new Intl.Collator("ko-KR", { sensitivity: "base" });

export function sortInventory(
  items: readonly InventoryItem[],
  mode: InventorySortMode,
): InventoryItem[] {
  return [...items].sort((left, right) => {
    if (mode === "name") {
      return (
        koreanNameOrder.compare(left.name, right.name) ||
        left.useBy.localeCompare(right.useBy)
      );
    }

    return (
      left.useBy.localeCompare(right.useBy) ||
      koreanNameOrder.compare(left.name, right.name)
    );
  });
}
