import { test } from 'node:test';
import assert from 'node:assert/strict';

const menuChat = await import('../mobile/src/domain/menu-chat.ts').catch(() => ({}));
const edgeContract = await import('../supabase/functions/_shared/menu-chat-contract.ts').catch(() => ({}));

test('menu chat request keeps only six bounded recent messages', () => {
  const sanitizeMenuChatRequest = Reflect.get(menuChat, 'sanitizeMenuChatRequest');
  assert.equal(typeof sanitizeMenuChatRequest, 'function');

  const result = sanitizeMenuChatRequest({
    message: '  김치찌개 먹고 싶어  ',
    history: Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `${index}-${'가'.repeat(600)}`,
    })),
    cookingTools: [' 2.5L 냄비 ', '', '전자레인지'],
    allergens: [' 새우 '],
  });

  assert.equal(result.message, '김치찌개 먹고 싶어');
  assert.equal(result.history.length, 6);
  assert.equal(result.history[0].content.startsWith('2-'), true);
  assert.equal(result.history[0].content.length, 500);
  assert.deepEqual(result.cookingTools, ['2.5L 냄비', '전자레인지']);
  assert.deepEqual(result.allergens, ['새우']);
});

test('menu chat response becomes a safe dynamic recipe and deduction list', () => {
  const parseMenuChatResponse = Reflect.get(menuChat, 'parseMenuChatResponse');
  const recipeUsage = Reflect.get(menuChat, 'recipeUsage');
  const recipeContextMessage = Reflect.get(menuChat, 'recipeContextMessage');
  assert.equal(typeof parseMenuChatResponse, 'function');
  assert.equal(typeof recipeUsage, 'function');
  assert.equal(typeof recipeContextMessage, 'function');

  const response = parseMenuChatResponse({
    reply: '김치 두부찌개를 추천해요.',
    recipe: {
      title: '김치 두부찌개', reason: '두부를 먼저 쓸 수 있어요.',
      servings: 1, minutes: 20, difficulty: '쉬움',
      ingredients: [
        { ingredientKey: 'kimchi', name: '김치', quantity: 150, unit: 'g', inInventory: true, requiredPurchase: false },
        { ingredientKey: 'tofu', name: '두부', quantity: 100, unit: 'g', inInventory: true, requiredPurchase: false },
        { ingredientKey: null, name: '고춧가루', quantity: 10, unit: 'g', inInventory: false, requiredPurchase: true },
      ],
      steps: [{ text: '냄비에서 10분간 끓여주세요.', minutes: 10 }],
      sources: [{ title: '참고 레시피', url: 'https://www.10000recipe.com/recipe/123' }],
    },
  });

  assert.equal(response.recipe?.title, '김치 두부찌개');
  assert.deepEqual(recipeUsage(response.recipe!), [
    { ingredientId: 'kimchi', quantity: 150, unit: 'g' },
    { ingredientId: 'tofu', quantity: 100, unit: 'g' },
  ]);
  const context = recipeContextMessage(response.recipe!);
  assert.equal(context.role, 'assistant');
  assert.match(context.content, /현재 제안 레시피: 김치 두부찌개/);
  assert.match(context.content, /김치 150g/);
  assert.equal(context.content.length <= 500, true);
});

test('invalid model quantities and units are rejected before UI or inventory use', () => {
  const parseMenuChatResponse = Reflect.get(menuChat, 'parseMenuChatResponse');
  assert.equal(typeof parseMenuChatResponse, 'function');

  assert.throws(() => parseMenuChatResponse({
    reply: '잘못된 응답',
    recipe: {
      title: '테스트', reason: '테스트', servings: 1, minutes: 10, difficulty: '쉬움',
      ingredients: [{ ingredientKey: 'tofu', name: '두부', quantity: -1, unit: '봉', inInventory: true, requiredPurchase: false }],
      steps: [{ text: '조리', minutes: 0 }], sources: [],
    },
  }), /AI 응답/);
});

test('allergen guard scans the whole recipe, including aliases in cooking steps', () => {
  const assertAllergenSafe = Reflect.get(edgeContract, 'assertAllergenSafe');
  assert.equal(typeof assertAllergenSafe, 'function');

  assert.throws(
    () => assertAllergenSafe({
      recipe: {
        ingredients: [{ name: '김치' }],
        steps: [{ text: '마지막에 shrimp powder를 넣습니다.' }],
      },
    }, ['새우']),
    /ALLERGEN_REJECTED/,
  );
});
