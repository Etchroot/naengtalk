import { test } from 'node:test';
import assert from 'node:assert/strict';

const cookingModule = await import('../mobile/src/domain/remote-cooking.ts').catch(() => ({}));

test('remote cooking request consolidates usage and keeps a stable idempotency key', () => {
  const buildRemoteCookingRequest = Reflect.get(cookingModule, 'buildRemoteCookingRequest');
  assert.equal(typeof buildRemoteCookingRequest, 'function');

  assert.deepEqual(buildRemoteCookingRequest({
    title: '김치 두부찌개',
    content: { servings: 1 },
    requestKey: 'cook-20260909-0001',
    usage: [
      { ingredientId: 'kimchi', quantity: 100, unit: 'g' },
      { ingredientId: 'kimchi', quantity: 50, unit: 'g' },
      { ingredientId: 'tofu', quantity: 100, unit: 'g' },
    ],
  }), {
    recipe_title: '김치 두부찌개',
    recipe_content: { servings: 1 },
    usage_lines: [
      { ingredient_key: 'kimchi', quantity: 150, unit: 'g' },
      { ingredient_key: 'tofu', quantity: 100, unit: 'g' },
    ],
    request_key: 'cook-20260909-0001',
  });
});

test('remote cooking request rejects invalid usage before calling the database', () => {
  const buildRemoteCookingRequest = Reflect.get(cookingModule, 'buildRemoteCookingRequest');
  assert.equal(typeof buildRemoteCookingRequest, 'function');

  assert.throws(() => buildRemoteCookingRequest({
    title: '김치 두부찌개', content: {}, requestKey: 'short',
    usage: [{ ingredientId: 'kimchi', quantity: 0, unit: 'g' }],
  }), /요청 키|수량/);
});
