import type { InventoryItem } from './cooking.ts';

export type InventoryEditDraft = {
  name: string;
  quantityText: string;
  unit: string;
  storageMethod: 'room_temperature' | 'refrigerated' | 'frozen';
  useByDate: string;
};

export type ValidatedInventoryEdit = Omit<InventoryEditDraft, 'quantityText'> & { quantity: number };

export function createInventoryEditDraft(item: InventoryItem): InventoryEditDraft {
  return { name: item.name, quantityText: String(item.quantity), unit: item.unit, storageMethod: item.storageMethod ?? 'refrigerated', useByDate: item.useBy };
}

export function validateInventoryEditDraft(draft: InventoryEditDraft): ValidatedInventoryEdit {
  const name = draft.name.trim();
  if (!name) throw new Error('식품 이름을 입력해주세요.');
  const quantityText = draft.quantityText.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(quantityText)) throw new Error('남은 수량을 숫자로 입력해주세요.');
  const quantity = Number(quantityText);
  if (!Number.isFinite(quantity)) throw new Error('남은 수량을 확인해주세요.');
  if (quantity <= 0) throw new Error('남은 수량은 0보다 커야 합니다. 재고를 없애려면 삭제를 눌러주세요.');
  if (!['g', 'ml', '개', '대'].includes(draft.unit)) throw new Error('수량 단위를 선택해주세요.');
  if (!['room_temperature', 'refrigerated', 'frozen'].includes(draft.storageMethod)) throw new Error('보관 위치를 선택해주세요.');
  const useByDate = draft.useByDate.trim().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(useByDate);
  if (!parts) throw new Error('권장 소진일을 올바른 날짜로 입력해주세요.');
  const [, year, month, day] = parts.map(Number);
  const date = new Date(`${useByDate}T00:00:00Z`);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new Error('권장 소진일을 실제 달력에 있는 날짜로 입력해주세요.');
  }
  return { name, quantity, unit: draft.unit, storageMethod: draft.storageMethod, useByDate };
}
