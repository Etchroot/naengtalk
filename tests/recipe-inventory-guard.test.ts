import { test } from 'node:test';
import assert from 'node:assert/strict';

const guard = await import('../supabase/functions/_shared/recipe-inventory-guard.ts').catch(() => ({}));

test('missing ingredients are counted even when AI marks them in inventory', () => {
  const check = Reflect.get(guard, 'checkRecipeInventory');
  assert.equal(typeof check, 'function');
  const result = check({ ingredients: [
    { ingredientKey: '된장', name: '된장', quantity: 50, unit: 'g', inInventory: true, requiredPurchase: false },
    { ingredientKey: '두부', name: '두부', quantity: 100, unit: 'g', inInventory: true, requiredPurchase: false },
    { ingredientKey: null, name: '물', quantity: 300, unit: 'ml', inInventory: false, requiredPurchase: true },
  ] }, [{ ingredient_key: '된장', display_name: '된장', quantity: 60, unit: 'g' }]);
  assert.deepEqual(result.missingNames, ['두부']);
  assert.equal(result.purchaseCount, 1);
  assert.equal(result.correctedIngredients[1].requiredPurchase, true);
  assert.equal(result.correctedIngredients[2].requiredPurchase, false);
});

test('matching lots sum quantity and convert T/t to ml', () => {
  const check = Reflect.get(guard, 'checkRecipeInventory');
  const result = check({ ingredients: [
    { ingredientKey: '간장', name: '간장', quantity: 2, unit: 'T', inInventory: false, requiredPurchase: true },
  ] }, [
    { ingredient_key: '간장', display_name: '간장', quantity: 15, unit: 'ml' },
    { ingredient_key: '간장', display_name: '간장', quantity: 20, unit: 'ml' },
  ]);
  assert.equal(result.purchaseCount, 0);
  assert.equal(result.correctedIngredients[0].inInventory, true);
});

test('missing food ingredients are counted for the zero-purchase guard', () => {
  const check = Reflect.get(guard, 'checkRecipeInventory');
  const result = check({ ingredients: [
    { ingredientKey: null, name: '멸치', quantity: 30, unit: 'g', inInventory: true, requiredPurchase: false },
    { ingredientKey: null, name: '다시마', quantity: 1, unit: '개', inInventory: true, requiredPurchase: false },
  ] }, []);
  assert.equal(result.purchaseCount, 2);
});

test('two lines cannot spend the same lot twice', () => {
  const check = Reflect.get(guard, 'checkRecipeInventory');
  const result = check({ ingredients: [
    { ingredientKey: '두부', name: '두부', quantity: 80, unit: 'g', inInventory: true, requiredPurchase: false },
    { ingredientKey: '두부', name: '두부', quantity: 80, unit: 'g', inInventory: true, requiredPurchase: false },
  ] }, [{ ingredient_key: '두부', display_name: '두부', quantity: 100, unit: 'g' }]);
  assert.equal(result.purchaseCount, 1);
});

test('only explicitly approved missing requested foods bypass the zero-purchase rejection', () => {
  const check = Reflect.get(guard, 'checkRecipeInventory');
  const result = check({ ingredients: [
    { ingredientKey: null, name: '연어', quantity: 150, unit: 'g', inInventory: false, requiredPurchase: true },
    { ingredientKey: null, name: '우유', quantity: 100, unit: 'ml', inInventory: false, requiredPurchase: true },
    { ingredientKey: '감자', name: '감자', quantity: 2, unit: '개', inInventory: true, requiredPurchase: false },
  ] }, [{ ingredient_key: '감자', display_name: '감자', quantity: 5, unit: '개' }], ['연어']);

  assert.deepEqual(result.missingNames, ['우유']);
  assert.equal(result.purchaseCount, 1);
  assert.equal(result.correctedIngredients[0].requiredPurchase, true);
  assert.equal(result.correctedIngredients[0].inInventory, false);
});
