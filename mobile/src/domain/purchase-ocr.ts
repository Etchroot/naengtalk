export const PURCHASE_OCR_UNITS = ['g', 'ml', '개', '대'] as const;
export const PURCHASE_OCR_CATEGORIES = [
  'tofu', 'leafy', 'mushroom', 'vegetable', 'fresh_meat',
  'storage_vegetable', 'frozen', 'pantry', 'prepared',
] as const;

export type PurchaseOcrUnit = typeof PURCHASE_OCR_UNITS[number];
export type PurchaseOcrCategory = typeof PURCHASE_OCR_CATEGORIES[number];

export type PurchaseOcrItem = {
  productName: string;
  foodName: string;
  quantity: number | null;
  unit: PurchaseOcrUnit | null;
  category: PurchaseOcrCategory;
  confidence: number;
  needsReview: boolean;
  note: string | null;
  isFood: boolean;
};

export type PurchaseOcrResponse = { rawText: string; items: PurchaseOcrItem[] };

export type InventoryCandidate = {
  ingredient_key: string;
  display_name: string;
  quantity: number;
  unit: PurchaseOcrUnit;
  use_by_at: string;
  date_source: 'estimated';
};

const useByOffsets: Record<PurchaseOcrCategory, number> = {
  tofu: 3,
  leafy: 5,
  mushroom: 5,
  vegetable: 7,
  fresh_meat: 2,
  storage_vegetable: 14,
  frozen: 30,
  pantry: 30,
  prepared: 30,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function text(value: unknown, maxLength = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isCategory(value: unknown): value is PurchaseOcrCategory {
  return typeof value === 'string' && PURCHASE_OCR_CATEGORIES.includes(value as PurchaseOcrCategory);
}

function isUnit(value: unknown): value is PurchaseOcrUnit {
  return typeof value === 'string' && PURCHASE_OCR_UNITS.includes(value as PurchaseOcrUnit);
}

export function parsePurchaseOcrResponse(input: unknown): PurchaseOcrResponse {
  if (!isRecord(input) || typeof input.rawText !== 'string' || !Array.isArray(input.items)) {
    throw new Error('구매내역 AI 응답 형식이 올바르지 않습니다.');
  }

  const items = input.items.slice(0, 40).flatMap((value): PurchaseOcrItem[] => {
    if (!isRecord(value)) return [];
    const productName = text(value.productName);
    const foodName = text(value.foodName, 100);
    if (!productName || !foodName || !isCategory(value.category)) return [];

    const quantity = typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity > 0
      ? value.quantity
      : null;
    const unit = isUnit(value.unit) ? value.unit : null;
    const confidence = typeof value.confidence === 'number' && Number.isFinite(value.confidence)
      ? Math.max(0, Math.min(1, value.confidence))
      : 0;
    const note = text(value.note, 200) || null;
    const needsReview = value.needsReview === true || !quantity || !unit || confidence < 0.8;

    return [{
      productName,
      foodName,
      quantity,
      unit,
      category: value.category,
      confidence,
      needsReview,
      note: needsReview && !note ? '수량·단위 또는 상품명을 확인해주세요.' : note,
      isFood: value.isFood === true,
    }];
  });

  return { rawText: input.rawText.trim().slice(0, 12_000), items };
}

export function normalizedIngredientKey(foodName: string): string {
  const normalized = foodName
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `ocr-${normalized || 'food'}`;
}

export function estimatedUseByDate(baseDate: string, category: PurchaseOcrCategory): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate) || !isCategory(category)) {
    throw new Error('소비기한 계산 입력이 올바르지 않습니다.');
  }
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('소비기한 계산 입력이 올바르지 않습니다.');
  date.setUTCDate(date.getUTCDate() + useByOffsets[category]);
  return date.toISOString().slice(0, 10);
}

export function buildInventoryCandidates(
  response: PurchaseOcrResponse,
  registrationDate: string,
  _sampleId: string,
): InventoryCandidate[] {
  return response.items
    .filter((item): item is PurchaseOcrItem & { quantity: number; unit: PurchaseOcrUnit } => (
      item.isFood && !item.needsReview && item.quantity !== null && item.unit !== null
    ))
    .map((item) => ({
      ingredient_key: normalizedIngredientKey(item.foodName),
      display_name: item.foodName,
      quantity: item.quantity,
      unit: item.unit,
      use_by_at: estimatedUseByDate(registrationDate, item.category),
      date_source: 'estimated' as const,
    }));
}
