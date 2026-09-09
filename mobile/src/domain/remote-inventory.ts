import type { InventoryItem } from './cooking.ts';

export type InventoryLotRow = {
  id: string;
  ingredient_key: string;
  display_name: string;
  quantity: number | string;
  unit: string;
  use_by_at: string;
  date_source: string;
};

export function mapInventoryLotRows(rows: InventoryLotRow[]): InventoryItem[] {
  return rows.map((row) => {
    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`${row.display_name} 재고 수량이 올바르지 않습니다.`);
    }
    return {
      id: row.ingredient_key,
      name: row.display_name,
      quantity,
      unit: row.unit,
      useBy: row.use_by_at,
      estimated: row.date_source === 'estimated',
    };
  });
}
