import { test } from 'node:test';
import assert from 'node:assert/strict';

const priorityPolicy = await import('../supabase/functions/_shared/recipe-priority-policy.ts').catch(() => ({}));
const expiryPolicy = await import('../supabase/functions/_shared/recipe-expiry-policy.ts').catch(() => ({}));

test('every ingredient explicitly requested by the user is required in the recipe', () => {
  const assertRecipeQuality = Reflect.get(priorityPolicy, 'assertRecipeQuality');
  assert.equal(typeof assertRecipeQuality, 'function');

  assert.throws(() => assertRecipeQuality({
    ingredients: [{ name: '두부' }, { name: '된장' }],
    steps: [{ text: '두부와 된장을 넣고 끓인다.' }],
  }, ['두부', '대파']), /REQUESTED_INGREDIENT_MISSING/);

  assert.doesNotThrow(() => assertRecipeQuality({
    ingredients: [{ name: '소고기' }, { name: '두부' }, { name: '대파' }, { name: '된장' }, { name: '물' }],
    steps: [{ text: '물에 된장을 풀고 소고기와 두부를 끓인 뒤 대파를 넣어 끓인다.' }],
  }, ['두부', '대파']));
});

test('serving ingredients with a dipping sauce is not a meaningful cooked dish', () => {
  const assertRecipeQuality = Reflect.get(priorityPolicy, 'assertRecipeQuality');
  assert.equal(typeof assertRecipeQuality, 'function');

  assert.throws(() => assertRecipeQuality({
    ingredients: [{ name: '두부' }, { name: '대파' }, { name: '쌈장' }],
    steps: [
      { text: '두부는 먹기 좋은 크기로 나눈다.' },
      { text: '대파를 잘게 뜨거나 가늘게 찢다.' },
      { text: '두부에 쌈장을 곁들이고 대파를 올려 함께 먹는다.' },
    ],
  }, ['두부', '대파']), /RECIPE_NOT_MEANINGFUL/);

  assert.doesNotThrow(() => assertRecipeQuality({
    ingredients: [{ name: '두부' }, { name: '대파' }, { name: '된장' }, { name: '물' }],
    steps: [{ text: '물에 된장을 풀고 두부를 끓인 뒤 대파를 넣어 한소끔 끓인다.' }],
  }, ['두부', '대파']));
});

test('expiry urgency only influences recipes inside the seven-day window', () => {
  const classifyRecipeExpiry = Reflect.get(expiryPolicy, 'classifyRecipeExpiry');
  assert.equal(typeof classifyRecipeExpiry, 'function');

  assert.deepEqual(classifyRecipeExpiry('2026-10-11', '2026-10-10'), { tier: 'expired', weight: -1, daysRemaining: -1 });
  assert.deepEqual(classifyRecipeExpiry('2026-10-11', '2026-10-13'), { tier: 'critical', weight: 100, daysRemaining: 2 });
  assert.deepEqual(classifyRecipeExpiry('2026-10-11', '2026-10-16'), { tier: 'soon', weight: 30, daysRemaining: 5 });
  assert.deepEqual(classifyRecipeExpiry('2026-10-11', '2026-10-19'), { tier: 'normal', weight: 0, daysRemaining: 8 });
  assert.deepEqual(classifyRecipeExpiry('2026-10-11', '2027-04-11'), { tier: 'normal', weight: 0, daysRemaining: 182 });
});

test('expired lots are excluded and long-life date differences do not change recipe priority', () => {
  const prioritizeRecipeInventory = Reflect.get(expiryPolicy, 'prioritizeRecipeInventory');
  assert.equal(typeof prioritizeRecipeInventory, 'function');

  const result = prioritizeRecipeInventory([
    { ingredient_key: 'expired', display_name: '상한 두부', quantity: 100, unit: 'g', use_by_at: '2026-10-10' },
    { ingredient_key: 'ssamjang', display_name: '쌈장', quantity: 500, unit: 'g', use_by_at: '2027-04-10' },
    { ingredient_key: 'doenjang', display_name: '된장', quantity: 500, unit: 'g', use_by_at: '2027-04-15' },
  ], '2026-10-11');

  assert.deepEqual(result.map((item: { display_name: string }) => item.display_name), ['쌈장', '된장']);
  assert.deepEqual(result.map((item: { expiryWeight: number }) => item.expiryWeight), [0, 0]);
});
