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
        { ingredientKey: 'soy', name: '간장', quantity: 1, unit: 'T', inInventory: true, requiredPurchase: false },
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
    { ingredientId: 'soy', quantity: 15, unit: 'ml' },
  ]);
  const context = recipeContextMessage(response.recipe!);
  assert.equal(context.role, 'assistant');
  assert.match(context.content, /현재 제안 레시피: 김치 두부찌개/);
  assert.match(context.content, /김치 150g/);
  assert.equal(context.content.length <= 500, true);
});

test('teaspoon recipe quantities display as t and deduct as milliliters', () => {
  const parseMenuChatResponse = Reflect.get(menuChat, 'parseMenuChatResponse');
  const recipeUsage = Reflect.get(menuChat, 'recipeUsage');
  const response = parseMenuChatResponse({
    reply: '간을 맞춰요.',
    recipe: {
      title: '간장 달걀밥', reason: '간단해요.', servings: 1, minutes: 5, difficulty: '쉬움',
      ingredients: [
        { ingredientKey: 'soy', name: '간장', quantity: 2, unit: 't', inInventory: true, requiredPurchase: false },
      ],
      steps: [{ text: '간장을 섞어주세요.', minutes: 0 }],
      sources: [{ title: '참고', url: 'https://example.org/recipe' }],
    },
  });

  assert.equal(response.recipe?.ingredients[0].unit, 't');
  assert.deepEqual(recipeUsage(response.recipe!), [
    { ingredientId: 'soy', quantity: 10, unit: 'ml' },
  ]);
});

test('one-minute recipe steps never expose a timer', () => {
  const parseMenuChatResponse = Reflect.get(menuChat, 'parseMenuChatResponse');
  const response = parseMenuChatResponse({
    reply: '곧 완성돼요.',
    recipe: {
      title: '달걀밥', reason: '빠르게 만들어요.', servings: 1, minutes: 5, difficulty: '쉬움',
      ingredients: [
        { ingredientKey: 'egg', name: '계란', quantity: 1, unit: '개', inInventory: true, requiredPurchase: false },
      ],
      steps: [{ text: '밥과 계란을 1분간 섞어주세요.', minutes: 1 }],
      sources: [{ title: '참고', url: 'https://example.org/recipe' }],
    },
  });

  assert.equal(response.recipe?.steps[0].minutes, 0);
});

test('recipe AI instructions define measurement, timer, and hidden-system-copy rules', () => {
  const buildRecipeInstructions = Reflect.get(edgeContract, 'buildRecipeInstructions');
  assert.equal(typeof buildRecipeInstructions, 'function');
  const instructions = buildRecipeInstructions(false);

  assert.match(instructions, /15ml\s*=\s*1T/);
  assert.match(instructions, /5ml\s*=\s*1t/);
  assert.match(instructions, /조리도구를 세척/);
  assert.match(instructions, /표시된 재고 재료만 차감/);
  assert.match(instructions, /1분 이하/);
  assert.match(instructions, /조리가 아닌 작업/);
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
