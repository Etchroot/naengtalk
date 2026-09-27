import { test } from 'node:test';
import assert from 'node:assert/strict';

type Handler = (request: Request) => Promise<Response>;
let handler: Handler | undefined;
const previousDeno = Reflect.get(globalThis, 'Deno');
Reflect.set(globalThis, 'Deno', {
  env: { get: (name: string) => ({
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon-test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    OPENAI_API_KEY: 'openai-test',
  } as Record<string, string>)[name] },
  serve: (next: Handler) => { handler = next; },
});
await import('../supabase/functions/menu-chat/index.ts');

const ingredient = {
  ingredientKey: 'tofu', name: '두부', quantity: 100, unit: 'g',
  inInventory: true, requiredPurchase: false,
};
const modelRecipe = {
  title: '두부국', reason: '두부를 사용해요.', servings: 1, minutes: 10,
  difficulty: '쉬움', ingredients: [ingredient],
  steps: [{ text: '끓여주세요.', minutes: 5 }], sources: [],
};

async function invokeMenuChat(
  publicCandidates: unknown[], sharedCandidates: unknown[] = [],
  generatedRecipe: typeof modelRecipe | ((body: Record<string, unknown>) => typeof modelRecipe) = modelRecipe,
  pantry: Array<Record<string, unknown>> = [{
    ingredient_key: 'tofu', display_name: '두부', quantity: 200,
    unit: 'g', use_by_at: '2026-09-15', date_source: 'estimated',
  }],
  allergens: string[] = [],
) {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, body });
    const json = (value: unknown) => new Response(JSON.stringify(value), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
    if (url.endsWith('/auth/v1/user')) return json({ id: 'test-user' });
    if (url.endsWith('/rpc/consume_ai_request')) return json(true);
    if (url.includes('/inventory_lots?')) return json(pantry);
    if (url.endsWith('/rpc/search_recipe_candidates')) {
      return json(body?.source_kind === 'catalog' ? publicCandidates : sharedCandidates);
    }
    if (url.endsWith('/rpc/get_recipe_candidate_detail')) return json({
      id: body?.target_id, title: '두부국', origin: body?.target_origin,
      ingredients: [{ name: '두부', amount: '100g' }], steps: ['끓인다.'],
    });
    if (url.endsWith('/v1/responses')) {
      if (body?.model === 'gpt-5.6-luna') return json({ output_text: JSON.stringify({
        intent: 'recipe', reply: '', dishName: '두부국', ingredientNames: ['두부'],
      }) });
      return json({ output_text: JSON.stringify({ reply: '두부국을 추천해요.',
        recipe: typeof generatedRecipe === 'function' ? generatedRecipe(body ?? {}) : generatedRecipe }) });
    }
    return new Response('not found', { status: 404 });
  };
  try {
    const request = new Request('https://edge.test/menu-chat', {
      method: 'POST', headers: { authorization: 'Bearer user-test' },
      body: JSON.stringify({ message: '두부국 먹고 싶어', history: [], cookingTools: ['냄비'], allergens }),
    });
    const response = await handler!(request);
    return { response, result: await response.json() as Record<string, unknown>, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('zero-purchase public candidate is personalized and OpenAI gets no web tool', async () => {
  const { response, result, calls } = await invokeMenuChat([{
    id: 'MFDS_000028', title: '두부국', origin: 'MFDS',
    name_score: 100, matched_count: 1, ingredient_count: 1,
  }]);
  assert.equal(response.status, 200);
  assert.equal((result.recipe as Record<string, unknown>)?.origin, 'MFDS');
  assert.deepEqual((result.recipe as Record<string, unknown>)?.sources, []);
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/search_recipe_candidates')).length, 2);
  for (const call of calls.filter((entry) => entry.url.endsWith('/v1/responses'))) {
    assert.equal(call.body?.tools, undefined);
  }
});

test('shared zero-purchase candidate outranks a public one-purchase candidate', async () => {
  const { result } = await invokeMenuChat(
    [{ id: 'public-1', title: '두부국', origin: 'MFDS', name_score: 100, matched_count: 1, ingredient_count: 2 }],
    [{ id: 'shared-0', title: '두부찜', origin: 'SHARED_AI', name_score: 0, matched_count: 1, ingredient_count: 1 }],
  );
  assert.equal((result.recipe as Record<string, unknown>)?.origin, 'SHARED_AI');
});

test('server never returns a generated recipe requiring two purchases', async () => {
  const unsafe = { ...modelRecipe, ingredients: [
    ingredient,
    { ingredientKey: null, name: '멸치', quantity: 30, unit: 'g', inInventory: true, requiredPurchase: false },
    { ingredientKey: null, name: '다시마', quantity: 1, unit: '개', inInventory: true, requiredPurchase: false },
  ] };
  const { response, result } = await invokeMenuChat([], [], unsafe);
  assert.equal(response.status, 422);
  assert.equal(result.recipe, undefined);
});

test('after normal candidates fail pantry validation, one constrained repair can return an in-stock recipe', async () => {
  const unsafe = { ...modelRecipe, ingredients: [
    ingredient,
    { ...ingredient, ingredientKey: null, name: '멸치', quantity: 30, requiredPurchase: true },
    { ...ingredient, ingredientKey: null, name: '다시마', quantity: 10, requiredPurchase: true },
  ] };
  const { response, result, calls } = await invokeMenuChat([], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.validationFeedback ? modelRecipe : unsafe;
  });
  assert.equal(response.status, 200);
  assert.equal((result.recipe as typeof modelRecipe)?.title, '두부국');
  const terraCalls = calls.filter((call) => call.url.endsWith('/v1/responses') && call.body?.model === 'gpt-5.6-terra');
  assert.equal(terraCalls.length, 3);
  const repair = JSON.parse(String(terraCalls.at(-1)?.body?.input)) as Record<string, unknown>;
  assert.deepEqual((repair.validationFeedback as Record<string, unknown>).missingNames, ['멸치', '다시마']);
});

test('a non-actionable no-recipe placeholder is repaired rather than returned as a cooked dish', async () => {
  const placeholder = { ...modelRecipe, title: '추천 가능한 레시피 없음',
    steps: [{ text: '추천할 수 없습니다.', minutes: 0 }] };
  const { response, result } = await invokeMenuChat([], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.validationFeedback ? modelRecipe : placeholder;
  });
  assert.equal(response.status, 200);
  assert.equal((result.recipe as typeof modelRecipe)?.title, '두부국');
});

test('an allergen-rejected candidate falls through to a safe recipe attempt', async () => {
  const unsafeRecipe = {
    ...modelRecipe,
    steps: [{ text: '새우젓을 넣고 끓여주세요.', minutes: 5 }],
  };
  const { response, result, calls } = await invokeMenuChat([{
    id: 'MFDS_000028', title: '두부국', origin: 'MFDS',
    name_score: 100, matched_count: 1, ingredient_count: 1,
  }], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.internalCandidate ? unsafeRecipe : modelRecipe;
  }, undefined, ['새우']);

  assert.equal(response.status, 200);
  assert.equal((result.recipe as typeof modelRecipe)?.title, '두부국');
  const terraCalls = calls.filter((call) => call.url.endsWith('/v1/responses')
    && call.body?.model === 'gpt-5.6-terra');
  assert.equal(terraCalls.length, 2);
});

test('the final repair narrows a large pantry to requested foods and real staples with exact units', async () => {
  const unavailable = { ...modelRecipe, ingredients: [ingredient,
    { ...ingredient, name: '없는 재료', ingredientKey: null, requiredPurchase: true },
    { ...ingredient, name: '다른 없는 재료', ingredientKey: null, requiredPurchase: true }] };
  const pantry = [
    { ingredient_key: 'tofu', display_name: '두부', quantity: 200, unit: 'g' },
    { ingredient_key: 'soy', display_name: '간장', quantity: 500, unit: 'ml' },
    { ingredient_key: 'pear', display_name: '배', quantity: 2, unit: '개' },
  ];
  const { response, calls } = await invokeMenuChat([], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.validationFeedback ? modelRecipe : unavailable;
  }, pantry);
  assert.equal(response.status, 200);
  const terraCalls = calls.filter((call) => call.url.endsWith('/v1/responses') && call.body?.model === 'gpt-5.6-terra');
  const repair = JSON.parse(String(terraCalls.at(-1)?.body?.input)) as Record<string, unknown>;
  const context = repair.userContext as { inventory: Array<{ display_name: string; unit: string }> };
  assert.deepEqual(context.inventory.map((food) => [food.display_name, food.unit]),
    [['두부', 'g'], ['간장', 'ml']]);
});

test('no DB match searches shared second, then generates with Terra without web', async () => {
  const { response, result, calls } = await invokeMenuChat([]);
  assert.equal(response.status, 200);
  assert.equal((result.recipe as Record<string, unknown>)?.origin, 'AI_GENERATED');
  assert.deepEqual(calls.filter((call) => call.url.endsWith('/rpc/search_recipe_candidates'))
    .map((call) => call.body?.source_kind), ['catalog', 'shared']);
  assert.equal(calls.some((call) => call.url.endsWith('/rpc/get_recipe_candidate_detail')), false);
  assert.equal(calls.filter((call) => call.url.endsWith('/v1/responses')).at(-1)?.body?.model, 'gpt-5.6-terra');
});

test('AI-generated recipe never attributes its description to an external recipe site', async () => {
  const { result } = await invokeMenuChat([], [], {
    ...modelRecipe,
    reason: '만개의레시피를 간단히 조정했습니다.',
  });
  const recipe = result.recipe as Record<string, unknown>;
  assert.equal(recipe.origin, 'AI_GENERATED');
  assert.doesNotMatch(String(recipe.reason), /만개의\s*레시피/);
  assert.match(String(recipe.reason), /두부/);
});

test.after(() => {
  Reflect.set(globalThis, 'Deno', previousDeno);
});
