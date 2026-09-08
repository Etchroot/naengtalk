import type { InventoryItem } from './cooking.ts';
export function createGuestInventory(date: string): InventoryItem[] {
  const rows: [string, string, number, string, number][] = [
    ['tofu', '두부', 300, 'g', 3], ['egg', '계란', 10, '개', 7], ['pork', '돼지고기 앞다리살', 300, 'g', 1],
    ['kimchi', '김치', 500, 'g', 14], ['onion', '양파', 2, '개', 14], ['green-onion', '대파', 2, '대', 7],
    ['potato', '감자', 3, '개', 21], ['soy', '간장', 500, 'ml', 180], ['doenjang', '된장', 500, 'g', 180], ['oil', '식용유', 500, 'ml', 180],
  ];
  return rows.map(([id, name, quantity, unit, days]) => {
    const useBy = new Date(`${date}T12:00:00Z`); useBy.setUTCDate(useBy.getUTCDate() + days);
    return { id, name, quantity, unit, useBy: useBy.toISOString().slice(0, 10), estimated: true };
  });
}
