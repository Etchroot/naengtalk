import assert from 'node:assert/strict';
import test from 'node:test';

const usageReview = await import('../mobile/src/domain/usage-review.ts').catch(() => ({}));

test('cooking usage draft accepts edited positive quantities and preserves units', () => {
  const createUsageDraft = Reflect.get(usageReview, 'createUsageDraft');
  const updateUsageDraftQuantity = Reflect.get(usageReview, 'updateUsageDraftQuantity');
  const usageFromDraft = Reflect.get(usageReview, 'usageFromDraft');
  assert.equal(typeof createUsageDraft, 'function');
  assert.equal(typeof updateUsageDraftQuantity, 'function');
  assert.equal(typeof usageFromDraft, 'function');

  const draft = createUsageDraft([{ ingredientId: 'egg', quantity: 2, unit: '개' }]);
  const edited = updateUsageDraftQuantity(draft, 'egg', '1.5');
  assert.deepEqual(usageFromDraft(edited), [{ ingredientId: 'egg', quantity: 1.5, unit: '개' }]);
});

test('cooking usage draft blocks empty, zero and nonnumeric quantities', () => {
  const createUsageDraft = Reflect.get(usageReview, 'createUsageDraft');
  const updateUsageDraftQuantity = Reflect.get(usageReview, 'updateUsageDraftQuantity');
  const usageFromDraft = Reflect.get(usageReview, 'usageFromDraft');
  const draft = createUsageDraft([{ ingredientId: 'tofu', quantity: 100, unit: 'g' }]);

  for (const value of ['', '0', '두부']) {
    assert.throws(() => usageFromDraft(updateUsageDraftQuantity(draft, 'tofu', value)), /사용량/);
  }
});
