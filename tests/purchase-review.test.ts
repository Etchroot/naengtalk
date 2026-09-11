import { test } from 'node:test';
import assert from 'node:assert/strict';

const review = await import('../mobile/src/domain/purchase-review.ts').catch(() => ({}));

const tofuItem = {
  productName: '두부 300g', foodName: '두부', quantity: 300, unit: 'g', category: 'tofu',
  confidence: 0.98, needsReview: false, note: null, isFood: true,
  recommendedUseBy: '2026-09-13', shelfLifeStatus: 'cached',
  storageMethod: 'refrigerated', packageState: 'unopened', internalNote: null,
};

test('purchase image selections are deduplicated and capped at ten', () => {
  const mergePurchaseSelections = Reflect.get(review, 'mergePurchaseSelections');
  assert.equal(typeof mergePurchaseSelections, 'function');

  const incoming = Array.from({ length: 12 }, (_, index) => ({
    id: `image-${index}`, label: `image-${index}.jpg`, uri: `file:///image-${index}.jpg`,
  }));
  const result = mergePurchaseSelections([incoming[0]], incoming);
  assert.equal(result.length, 10);
  assert.equal(new Set(result.map((item: { id: string }) => item.id)).size, 10);
});

test('review-required rows are sorted first and non-food rows are hidden', () => {
  const buildPurchaseReviewRows = Reflect.get(review, 'buildPurchaseReviewRows');
  assert.equal(typeof buildPurchaseReviewRows, 'function');

  const rows = buildPurchaseReviewRows([
    { sourceId: 'R1', items: [tofuItem] },
    { sourceId: 'R2', items: [
      { ...tofuItem, productName: '치킨너겟', foodName: '치킨너겟', quantity: null, unit: null, needsReview: true },
      { ...tofuItem, productName: '키친타올', foodName: '키친타올', isFood: false },
    ] },
  ]);

  assert.deepEqual(rows.map((row: { name: string }) => row.name), ['치킨너겟', '두부']);
  assert.equal(rows[0].quantityText, '');
  assert.equal(rows[0].needsReview, true);
  assert.equal(rows.length, 2);
});

test('quantity input accepts supported units and rejects ambiguous text', () => {
  const parseQuantityText = Reflect.get(review, 'parseQuantityText');
  assert.equal(typeof parseQuantityText, 'function');

  assert.deepEqual(parseQuantityText(' 300 g '), { quantity: 300, unit: 'g' });
  assert.deepEqual(parseQuantityText('2개'), { quantity: 2, unit: '개' });
  assert.equal(parseQuantityText('1팩'), null);
  assert.equal(parseQuantityText('0g'), null);
});

test('editing a complete review row clears its warning and records user_edited', () => {
  const buildPurchaseReviewRows = Reflect.get(review, 'buildPurchaseReviewRows');
  const updatePurchaseReviewRow = Reflect.get(review, 'updatePurchaseReviewRow');
  assert.equal(typeof updatePurchaseReviewRow, 'function');

  const [row] = buildPurchaseReviewRows([{ sourceId: 'R2', items: [{
    ...tofuItem, quantity: null, unit: null, needsReview: true, internalNote: '용량 확인 필요',
  }] }]);
  const updated = updatePurchaseReviewRow(row, { quantityText: '600g' }, '2026-09-10');
  assert.equal(updated.needsReview, false);
  assert.equal(updated.importResolution, 'user_edited');
  assert.equal(updated.quantityText, '600g');
});

test('complete duplicate rows across screenshots stay visible without blocking registration', () => {
  const buildPurchaseReviewRows = Reflect.get(review, 'buildPurchaseReviewRows');
  const rows = buildPurchaseReviewRows([
    { sourceId: 'page-1', items: [tofuItem] },
    { sourceId: 'page-2', items: [tofuItem] },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows.every((row: { needsReview: boolean }) => row.needsReview), false);
});

test('final payload rejects invalid dates and maps valid edited rows', () => {
  const buildPurchaseReviewRows = Reflect.get(review, 'buildPurchaseReviewRows');
  const updatePurchaseReviewRow = Reflect.get(review, 'updatePurchaseReviewRow');
  const toInventoryImportPayload = Reflect.get(review, 'toInventoryImportPayload');
  assert.equal(typeof toInventoryImportPayload, 'function');

  const [row] = buildPurchaseReviewRows([{ sourceId: 'R1', items: [tofuItem] }]);
  assert.throws(
    () => toInventoryImportPayload([{ ...row, useByDate: '2026-02-31' }], '2026-09-10'),
    /수정이 필요한 항목/,
  );
  const edited = updatePurchaseReviewRow(row, { name: '찌개용 두부' }, '2026-09-10');
  assert.deepEqual(toInventoryImportPayload([edited], '2026-09-10'), [{
    ingredient_key: 'ocr-찌개용-두부',
    display_name: '찌개용 두부',
    quantity: 300,
    unit: 'g',
    use_by_at: '2026-09-13',
    date_source: 'user_override',
    import_resolution: 'user_edited',
    internal_note: null,
  }]);
});

test('adding a later analysis preserves edits already made to earlier rows', () => {
  const buildPurchaseReviewRows = Reflect.get(review, 'buildPurchaseReviewRows');
  const updatePurchaseReviewRow = Reflect.get(review, 'updatePurchaseReviewRow');
  const appendPurchaseReviewRows = Reflect.get(review, 'appendPurchaseReviewRows');
  assert.equal(typeof appendPurchaseReviewRows, 'function');

  const first = buildPurchaseReviewRows([{ sourceId: 'R1', items: [tofuItem] }]);
  const edited = [updatePurchaseReviewRow(first[0], { quantityText: '250g' }, '2026-09-10')];
  const combined = appendPurchaseReviewRows(edited, [{ sourceId: 'R2', items: [{
    ...tofuItem, productName: '감자 500g', foodName: '감자', quantity: 500,
    category: 'storage_vegetable', recommendedUseBy: '2026-09-24',
  }] }]);

  assert.equal(combined.find((row: { sourceId: string }) => row.sourceId === 'R1').quantityText, '250g');
  assert.equal(combined.length, 2);
});

test('a complete fallback estimate is editable but does not require manual correction', () => {
  const buildPurchaseReviewRows = Reflect.get(review, 'buildPurchaseReviewRows');
  const validatePurchaseReviewRows = Reflect.get(review, 'validatePurchaseReviewRows');
  const [row] = buildPurchaseReviewRows([{ sourceId: 'R1', items: [{
    ...tofuItem,
    needsReview: true,
    shelfLifeStatus: 'fallback',
    internalNote: '보수적 추정일',
  }] }]);

  assert.equal(row.needsReview, false);
  assert.deepEqual(validatePurchaseReviewRows([row], '2026-09-10'), []);
});
