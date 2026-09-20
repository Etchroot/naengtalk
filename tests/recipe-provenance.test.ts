import { test } from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../mobile/src/domain/recipe-provenance.ts').catch(() => ({}));
const recipeDisplayReason = Reflect.get(module, 'recipeDisplayReason');

const recipe = {
  origin: 'AI_GENERATED' as const,
  reason: '만개의레시피를 간단히 조정했습니다.',
  ingredients: [{ name: '두부', inInventory: true }, { name: '양파', inInventory: true }],
};

test('previously saved AI recipe displays a stock-based reason instead of a claimed external source', () => {
  assert.equal(typeof recipeDisplayReason, 'function');
  const reason = recipeDisplayReason(recipe);
  assert.doesNotMatch(reason, /만개의\s*레시피/);
  assert.match(reason, /두부/);
});

test('public catalog recipe identifies its verified institution, not model free text', () => {
  assert.equal(typeof recipeDisplayReason, 'function');
  const reason = recipeDisplayReason({ ...recipe, origin: 'MFDS' });
  assert.match(reason, /식품의약품안전처/);
  assert.doesNotMatch(reason, /만개의\s*레시피/);
});
