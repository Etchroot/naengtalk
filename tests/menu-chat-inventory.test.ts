import { test } from 'node:test';
import assert from 'node:assert/strict';

const edge = await import('../supabase/functions/_shared/menu-chat-contract.ts');
const app = await import('../mobile/src/domain/menu-chat.ts');

const pantry = [
  { ingredient_key: 'pork', display_name: '삼겹살', quantity: 200, unit: 'g' },
  { ingredient_key: 'lettuce', display_name: '꽃상추', quantity: 3, unit: '개' },
];

test('explicit consumed stock becomes a review proposal, not a completed deduction', () => {
  const result = edge.sanitizeInventoryChangeIntent('삼겹살 300g과 꽃상추 전부 썼어', [
    { action: 'consume', name: '삼겹살', ingredientKey: 'pork', quantity: 300, unit: 'g', all: false },
    { action: 'consume', name: '꽃상추', ingredientKey: 'lettuce', quantity: null, unit: null, all: true },
  ], pantry);
  assert.equal(result.changes.length, 2);
  assert.equal(result.changes[0].quantity, 300);
  assert.equal(result.changes[1].all, true);
  assert.match(result.reply, /확인/);
  assert.doesNotMatch(result.reply, /차감했습니다|반영했습니다/);
});

test('unregistered consumed ingredients are omitted and the user is told nothing was deducted', () => {
  const result = edge.sanitizeInventoryChangeIntent('바질 10g 썼어', [
    { action: 'consume', name: '바질', ingredientKey: null, quantity: 10, unit: 'g', all: false },
  ], pantry);
  assert.deepEqual(result.changes, []);
  assert.match(result.reply, /등록된 재고가 없어/);
});

test('model cannot propose a food absent from the current message', () => {
  const result = edge.sanitizeInventoryChangeIntent('삼겹살 100g 썼어', [
    { action: 'consume', name: '두부', ingredientKey: 'pork', quantity: 100, unit: 'g', all: false },
  ], pantry);
  assert.deepEqual(result.changes, []);
});

test('a model-provided key cannot redirect a named food to a different lot', () => {
  const result = edge.sanitizeInventoryChangeIntent('삼겹살 100g 썼어', [
    { action: 'consume', name: '삼겹살', ingredientKey: 'lettuce', quantity: 100, unit: 'g', all: false },
  ], pantry);
  assert.equal(result.changes[0]?.ingredientKey, 'pork');
});

test('remaining quantity may explicitly become zero', () => {
  const result = edge.sanitizeInventoryChangeIntent('꽃상추 이제 0개 남았어', [
    { action: 'set', name: '꽃상추', ingredientKey: 'lettuce', quantity: 0, unit: '개', all: false },
  ], pantry);
  assert.equal(result.changes[0]?.quantity, 0);
  assert.equal(app.parseMenuChatResponse({ reply: result.reply, recipe: null,
    inventoryChanges: result.changes }).inventoryChanges[0].quantity, 0);
});

test('client parses a bounded inventory proposal alongside no recipe', () => {
  const response = app.parseMenuChatResponse({
    reply: '재고 변경안을 확인해주세요.', recipe: null,
    inventoryChanges: [{ action: 'add', name: '감자', ingredientKey: null, quantity: 2, unit: '개', all: false }],
  });
  assert.equal(response.inventoryChanges?.[0].name, '감자');
  assert.equal(response.recipe, null);
});
