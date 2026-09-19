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

test('two missing food ingredients fail the one-purchase limit', () => {
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
