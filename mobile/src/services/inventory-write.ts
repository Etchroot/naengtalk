import type { InventoryItem } from '../domain/cooking.ts';
import { validateInventoryEditDraft, type InventoryEditDraft } from '../domain/inventory-edit.ts';
import { normalizedIngredientKey } from '../domain/purchase-ocr.ts';

export type InventoryWrite = {
  ownerId: string;
  lotId: string;
  expected: { ingredientKey: string; name: string; quantity: number; unit: string; useBy: string; storageMethod: InventoryItem['storageMethod'] };
  patch: Record<string, string | number> | null;
};
export type InventoryWriteIO = {
  ownerId: () => Promise<string | null>;
  write: (input: InventoryWrite) => Promise<boolean>;
};

export async function persistInventoryWrite(io: InventoryWriteIO, item: InventoryItem, draft: InventoryEditDraft | null): Promise<void> {
  if (!item.lotId) throw new Error('재고 목록을 다시 불러온 뒤 시도해주세요.');
  const value = draft ? validateInventoryEditDraft(draft) : null;
  const ownerId = await io.ownerId();
  if (!ownerId) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  const patch = value ? {
    display_name: value.name,
    ingredient_key: value.name === item.name ? item.id : normalizedIngredientKey(value.name),
    quantity: value.quantity,
    unit: value.unit,
    use_by_at: value.useByDate,
    storage_method: value.storageMethod,
    ...(value.useByDate !== item.useBy ? {date_source: 'user_override'} : {}),
    import_resolution: 'user_edited',
  } : null;
  if (patch && !patch.ingredient_key) throw new Error('재고명을 확인해주세요.');
  const written = await io.write({ownerId,lotId:item.lotId,expected:{ingredientKey:item.id,name:item.name,quantity:item.quantity,unit:item.unit,useBy:item.useBy,storageMethod:item.storageMethod ?? null},patch});
  if (!written) throw new Error('재고가 이미 변경되거나 삭제됐습니다. 목록을 다시 확인해주세요.');
}
