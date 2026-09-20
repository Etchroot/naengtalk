import type { InventoryItem } from './cooking.ts';
export function createGuestInventory(date: string): InventoryItem[] {
  const rows: [string, string, number, string, number][] = [
    ['tofu', '두부', 300, 'g', 3], ['egg', '계란', 10, '개', 7], ['pork', '돼지고기 앞다리살', 300, 'g', 1],
    ['kimchi', '김치', 500, 'g', 14], ['onion', '양파', 10, '개', 14], ['green-onion', '대파', 10, '대', 7],
    ['potato', '감자', 10, '개', 21], ['soy', '간장', 500, 'ml', 180], ['doenjang', '된장', 500, 'g', 180], ['oil', '식용유', 500, 'ml', 180],
    ['sugar', '설탕', 500, 'g', 180], ['salt', '소금', 500, 'g', 180],
    ['gochujang', '고추장', 500, 'g', 180], ['gochugaru', '고춧가루', 500, 'g', 180],
    ['garlic', '다진마늘', 500, 'g', 30], ['sesame-oil', '참기름', 500, 'ml', 180],
    ['vinegar', '식초', 500, 'ml', 180], ['pepper', '후추', 500, 'g', 180],
    ['rice', '쌀', 1000, 'g', 180], ['carrot', '당근', 10, '개', 14],
    ['zucchini', '애호박', 10, '개', 7], ['radish', '무', 10, '개', 14],
    ['shiitake', '표고버섯', 200, 'g', 7], ['bean-sprout', '콩나물', 300, 'g', 5],
    ['cabbage', '양배추', 10, '개', 14], ['cucumber', '오이', 10, '개', 7],
    ['spinach', '시금치', 200, 'g', 5], ['chicken', '닭가슴살', 300, 'g', 3],
    ['beef', '소고기', 300, 'g', 3], ['anchovy', '멸치', 200, 'g', 60],
  ];
  return rows.map(([id, name, quantity, unit, days]) => {
    const useBy = new Date(`${date}T12:00:00Z`); useBy.setUTCDate(useBy.getUTCDate() + days);
    return { id, name, quantity, unit, useBy: useBy.toISOString().slice(0, 10), estimated: true };
  });
}

export function createGuestTools(): string[] {
  return [
    '가스레인지', '1L 냄비', '2.5L 냄비', '4L 냄비', '24cm 프라이팬',
    '전자레인지', '1인용 에어프라이어', '집게', '뒤집개', '식칼',
    '도마', '국자', '채반', '믹싱볼', '계량스푼', '주걱',
  ];
}
