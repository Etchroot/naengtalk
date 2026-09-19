import type { InventoryItem } from './cooking.ts';
import type { ChatInventoryChange } from './menu-chat.ts';
import type { PurchaseReviewRow } from './purchase-review.ts';
import { isValidUseByDate } from './purchase-review.ts';
import { normalizedIngredientKey } from './purchase-ocr.ts';

export type ChatInventoryRow = {
  id: string;
  action: 'add' | 'consume' | 'set';
  name: string;
  ingredientKey: string;
  quantityText: string;
  unit: string;
  useByDate: string;
  storageMethod: PurchaseReviewRow['storageMethod'];
  available: number;
};

const units = new Set(['g', 'ml', '개', '대']);
const clean = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, '').toLowerCase();
const availableFor = (inventory: InventoryItem[], key: string, unit: string) => inventory
  .filter((item) => item.id === key && item.unit === unit)
  .reduce((sum, item) => sum + item.quantity, 0);

export function createChatInventoryDraft(
  changes: ChatInventoryChange[],
  inventory: InventoryItem[],
  additionReviewRows: (Pick<PurchaseReviewRow, 'name' | 'quantityText' | 'useByDate'> & { storageMethod?: PurchaseReviewRow['storageMethod'] })[],
): ChatInventoryRow[] {
  const additions = new Map(changes.filter((change) => change.action === 'add')
    .map((change) => [clean(change.name), normalizedIngredientKey(change.name)]));
  return changes.flatMap((change, index) => {
    const name = change.name.trim();
    const existing = inventory.find((item) => item.id === change.ingredientKey || clean(item.name) === clean(name));
    const key = existing?.id ?? additions.get(clean(name)) ?? normalizedIngredientKey(name);
    if (change.action === 'add') additions.set(clean(name), key);
    if (change.action !== 'add' && !existing && !additions.has(clean(name))) return [];
    const review = additionReviewRows.find((item) => clean(item.name) === clean(name));
    const unit = (change.unit && units.has(change.unit) ? change.unit : existing?.unit) ?? '';
    const available = availableFor(inventory, key, unit);
    const quantityText = change.all ? `${available}${unit}` : change.quantity !== null && unit
      ? `${change.quantity}${unit}` : review?.quantityText ?? '';
    return [{ id: `chat-${index}`, action: change.action, name, ingredientKey: key,
      quantityText, unit, useByDate: change.action === 'add' ? review?.useByDate ?? '' : '',
      storageMethod: change.action === 'add' ? review?.storageMethod ?? null : null, available }];
  });
}

function parseQuantity(row: ChatInventoryRow): { quantity: number; unit: string } | null {
  const match = row.quantityText.trim().match(/^(\d+(?:\.\d+)?)\s*(g|ml|개|대)$/i);
  if (!match) return null;
  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || (row.action === 'set' ? quantity < 0 : quantity <= 0)) return null;
  return { quantity, unit: match[2].toLowerCase() };
}

export function findChatInventoryOverdraw(rows: ChatInventoryRow[], inventory: InventoryItem[]) {
  const balances = new Map<string, number>();
  const keyFor = (key: string, unit: string) => `${key}|${unit}`;
  for (const row of [...rows.filter((item) => item.action === 'add'),
    ...rows.filter((item) => item.action !== 'add')]) {
    const parsed = parseQuantity(row);
    if (!parsed) continue;
    const key = keyFor(row.ingredientKey, parsed.unit);
    const balance = balances.get(key) ?? availableFor(inventory, row.ingredientKey, parsed.unit);
    if (row.action === 'add') balances.set(key, balance + parsed.quantity);
    else if (row.action === 'set') balances.set(key, parsed.quantity);
    else if (parsed.quantity > balance) return { rowId: row.id, name: row.name, available: balance, unit: parsed.unit };
    else balances.set(key, balance - parsed.quantity);
  }
  return null;
}

export function capChatInventoryRow(rows: ChatInventoryRow[], rowId: string, available: number): ChatInventoryRow[] {
  return rows.flatMap((row) => row.id !== rowId ? [row] : available <= 0 ? [] : [{ ...row, quantityText: `${available}${row.unit}` }]);
}

export function toChatInventoryPayload(rows: ChatInventoryRow[], today: string) {
  if (!rows.length || rows.length > 20) throw new Error('확인할 재고 변경 항목이 없습니다.');
  return rows.map((row) => {
    const name = row.name.trim();
    const parsed = parseQuantity(row);
    if (!name || name.length > 100 || !row.ingredientKey || !parsed) throw new Error('재료명과 수량을 확인해주세요.');
    if (row.action === 'add' && !isValidUseByDate(row.useByDate, today)) {
      throw new Error(`${name}의 권장 소진일을 확인해주세요.`);
    }
    return { action: row.action, ingredient_key: row.ingredientKey, display_name: name,
      quantity: parsed.quantity, unit: parsed.unit,
      use_by_at: row.action === 'add' ? row.useByDate : null,
      storage_method: row.action === 'add' ? row.storageMethod : null };
  });
}
