import {
  normalizedIngredientKey,
  type PurchaseOcrItem,
  type PurchaseOcrResponse,
  type PurchaseOcrUnit,
} from './purchase-ocr.ts';

export type PurchaseSelection = {
  id: string;
  label: string;
  uri: string;
  source?: unknown;
  kind?: 'sample' | 'library';
};

export type PurchaseAnalysis = {
  sourceId: string;
  items: PurchaseOcrItem[];
};

export type PurchaseReviewRow = {
  id: string;
  sourceId: string;
  productName: string;
  name: string;
  quantityText: string;
  useByDate: string;
  needsReview: boolean;
  originalNeedsReview: boolean;
  edited: boolean;
  importResolution: 'auto' | 'user_confirmed' | 'user_edited';
  internalNote: string | null;
};

export type InventoryImportItem = {
  ingredient_key: string;
  display_name: string;
  quantity: number;
  unit: PurchaseOcrUnit;
  use_by_at: string;
  date_source: 'estimated' | 'user_override';
  import_resolution: 'auto' | 'user_confirmed' | 'user_edited';
  internal_note: string | null;
};

export function mergePurchaseSelections(
  current: PurchaseSelection[],
  incoming: PurchaseSelection[],
): PurchaseSelection[] {
  const byId = new Map<string, PurchaseSelection>();
  for (const selection of [...current, ...incoming]) {
    if (!byId.has(selection.id) && byId.size < 10) byId.set(selection.id, selection);
  }
  return [...byId.values()];
}

export function parseQuantityText(value: string): { quantity: number; unit: PurchaseOcrUnit } | null {
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(g|ml|개|대)$/);
  if (!match) return null;
  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { quantity, unit: match[2] as PurchaseOcrUnit };
}

export function isValidUseByDate(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
  return value >= today;
}

function hasValidFields(row: PurchaseReviewRow, today: string): boolean {
  return Boolean(row.name.trim()) && Boolean(parseQuantityText(row.quantityText))
    && isValidUseByDate(row.useByDate, today);
}

function appendNote(note: string | null, addition: string): string {
  return note ? `${note} · ${addition}` : addition;
}

function markDuplicateRows(rows: PurchaseReviewRow[]): PurchaseReviewRow[] {
  const counts = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${row.productName.trim().toLowerCase()}|${row.quantityText}`;
    const sources = counts.get(key) ?? new Set<string>();
    sources.add(row.sourceId);
    counts.set(key, sources);
  }
  return rows.map((row) => {
    const key = `${row.productName.trim().toLowerCase()}|${row.quantityText}`;
    if ((counts.get(key)?.size ?? 0) < 2) return row;
    if (row.internalNote?.includes('중복 가능')) return row;
    return {
      ...row,
      needsReview: true,
      originalNeedsReview: true,
      importResolution: 'user_confirmed',
      internalNote: appendNote(row.internalNote, '다른 이미지의 항목과 중복 가능'),
    };
  });
}

function rowsFromAnalyses(analyses: PurchaseAnalysis[]): PurchaseReviewRow[] {
  return analyses.flatMap(({ sourceId, items }) => items.flatMap((item, index): PurchaseReviewRow[] => {
    if (!item.isFood) return [];
    const quantityText = item.quantity !== null && item.unit ? `${item.quantity}${item.unit}` : '';
    const useByDate = item.recommendedUseBy ?? '';
    const needsReview = item.needsReview || !quantityText || !useByDate || item.shelfLifeStatus === 'fallback';
    return [{
      id: `${sourceId}-${index}`,
      sourceId,
      productName: item.productName,
      name: item.foodName,
      quantityText,
      useByDate,
      needsReview,
      originalNeedsReview: needsReview,
      edited: false,
      importResolution: needsReview ? 'user_confirmed' : 'auto',
      internalNote: item.internalNote ?? item.note,
    }];
  }));
}

function reviewFirst(rows: PurchaseReviewRow[]): PurchaseReviewRow[] {
  return rows
    .map((row, order) => ({ row, order }))
    .sort((a, b) => Number(b.row.needsReview) - Number(a.row.needsReview) || a.order - b.order)
    .map(({ row }) => row);
}

export function buildPurchaseReviewRows(analyses: PurchaseAnalysis[]): PurchaseReviewRow[] {
  return reviewFirst(markDuplicateRows(rowsFromAnalyses(analyses)));
}

export function appendPurchaseReviewRows(
  existing: PurchaseReviewRow[],
  analyses: PurchaseAnalysis[],
): PurchaseReviewRow[] {
  const existingIds = new Set(existing.map((row) => row.id));
  const additions = rowsFromAnalyses(analyses).filter((row) => !existingIds.has(row.id));
  return reviewFirst(markDuplicateRows([...existing, ...additions]));
}

export function updatePurchaseReviewRow(
  row: PurchaseReviewRow,
  patch: Partial<Pick<PurchaseReviewRow, 'name' | 'quantityText' | 'useByDate'>>,
  today: string,
): PurchaseReviewRow {
  const updated: PurchaseReviewRow = {
    ...row,
    ...patch,
    edited: true,
    importResolution: 'user_edited',
  };
  return { ...updated, needsReview: !hasValidFields(updated, today) };
}

export function validatePurchaseReviewRows(rows: PurchaseReviewRow[], today: string): string[] {
  return rows.filter((row) => !hasValidFields(row, today)).map((row) => row.id);
}

export function toInventoryImportPayload(rows: PurchaseReviewRow[], today: string): InventoryImportItem[] {
  if (!rows.length || validatePurchaseReviewRows(rows, today).length) {
    throw new Error('수정이 필요한 항목을 먼저 확인해주세요.');
  }
  return rows.map((row) => {
    const parsed = parseQuantityText(row.quantityText);
    if (!parsed) throw new Error('수정이 필요한 항목을 먼저 확인해주세요.');
    return {
      ingredient_key: normalizedIngredientKey(row.name),
      display_name: row.name.trim(),
      quantity: parsed.quantity,
      unit: parsed.unit,
      use_by_at: row.useByDate,
      date_source: row.edited ? 'user_override' : 'estimated',
      import_resolution: row.edited
        ? 'user_edited'
        : row.originalNeedsReview
          ? 'user_confirmed'
          : 'auto',
      internal_note: row.internalNote,
    };
  });
}

export function analysisFromResponse(sourceId: string, response: PurchaseOcrResponse): PurchaseAnalysis {
  return { sourceId, items: response.items };
}
