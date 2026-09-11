import type { Usage } from './cooking.ts';

export type UsageDraft = {
  ingredientId: string;
  quantityText: string;
  unit: string;
};

export function createUsageDraft(usage: Usage[]): UsageDraft[] {
  return usage.map((line) => ({
    ingredientId: line.ingredientId,
    quantityText: String(line.quantity),
    unit: line.unit,
  }));
}

export function updateUsageDraftQuantity(
  draft: UsageDraft[],
  ingredientId: string,
  quantityText: string,
): UsageDraft[] {
  return draft.map((line) => line.ingredientId === ingredientId
    ? { ...line, quantityText }
    : line);
}

export function usageFromDraft(draft: UsageDraft[]): Usage[] {
  if (!draft.length) throw new Error('확정할 사용량이 없습니다.');
  return draft.map((line) => {
    const quantity = Number(line.quantityText.trim());
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('사용량은 0보다 큰 숫자로 입력해주세요.');
    }
    return { ingredientId: line.ingredientId, quantity, unit: line.unit };
  });
}
