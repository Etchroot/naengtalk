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

const techniqueCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'MFDS_000028', title: '두부국', origin: 'MFDS',
  name_score: 100, method_score: 0,
  required_matched_count: 1, required_count: 1,
  inventory_matched_count: 1, ingredient_count: 3, step_count: 2,
  ...overrides,
});

async function invokeMenuChat(
  publicCandidates: unknown[], sharedCandidates: unknown[] = [],
  generatedRecipe: typeof modelRecipe | ((body: Record<string, unknown>) => typeof modelRecipe) = modelRecipe,
  pantry: Array<Record<string, unknown>> = [{
    ingredient_key: 'tofu', display_name: '두부', quantity: 200,
    unit: 'g', use_by_at: '2999-09-15', date_source: 'estimated',
  }],
  allergens: string[] = [],
  requestOptions: {
    message?: string;
    dishName?: string;
    ingredientNames?: string[];
    traceStatus?: number;
    rateAllowed?: boolean;
    terraStatus?: number;
    repairTerraStatus?: number;
    inventoryStatus?: number;
    lunaStatus?: number;
    lunaOutputText?: string;
    catalogStatus?: number;
    terraOutputText?: string;
    rawBody?: string;
    authorization?: string | null;
    method?: string;
    candidateDetail?: Record<string, unknown>;
    confirmationTicket?: string;
    consumedConfirmation?: Record<string, unknown> | null;
    confirmationStatus?: number;
    missingIngredientConfirmationTicket?: string;
  } = {},
) {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ url, body });
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
      status, headers: { 'Content-Type': 'application/json' },
    });
    if (url.endsWith('/auth/v1/user')) return json({ id: 'test-user' });
    if (url.endsWith('/rpc/consume_ai_request')) return json(requestOptions.rateAllowed ?? true);
    if (url.endsWith('/rpc/create_missing_ingredient_confirmation')) {
      return json({ ticket: requestOptions.confirmationTicket ?? '11111111-1111-4111-8111-111111111111' },
        requestOptions.confirmationStatus ?? 200);
    }
    if (url.endsWith('/rpc/consume_missing_ingredient_confirmation')) {
      return json(requestOptions.consumedConfirmation ?? null, requestOptions.confirmationStatus ?? 200);
    }
    if (url.includes('/inventory_lots?')) return json(pantry, requestOptions.inventoryStatus ?? 200);
    if (url.endsWith('/rpc/search_recipe_technique_candidates')) {
      return json(body?.source_kind === 'catalog' ? publicCandidates : sharedCandidates,
        requestOptions.catalogStatus ?? 200);
    }
    if (url.endsWith('/rpc/get_recipe_candidate_detail')) return json(requestOptions.candidateDetail ?? {
      id: body?.target_id, title: '두부국', origin: body?.target_origin,
      cookingMethod: '끓이기', tip: '약불에서 마무리한다.',
      ingredients: [{ name: '두부', amount: '100g' }, { name: '애호박', amount: '50g' }],
      steps: ['두부를 썬다.', '냄비에서 끓인다.'],
    }, requestOptions.catalogStatus ?? 200);
    if (url.endsWith('/rpc/record_ai_request_trace')) {
      return json(null, requestOptions.traceStatus ?? 200);
    }
    if (url.endsWith('/v1/responses')) {
      if (body?.model === 'gpt-5.6-luna') {
        if (requestOptions.lunaStatus) return json({ error: 'provider failure' }, requestOptions.lunaStatus);
        return json({ id: 'resp_luna_test', usage: {
        input_tokens: 100, output_tokens: 20,
      }, output_text: requestOptions.lunaOutputText ?? JSON.stringify({
        intent: 'recipe', reply: '', dishName: requestOptions.dishName ?? '두부국',
        ingredientNames: requestOptions.ingredientNames ?? ['두부'],
      }) });
      }
      if (requestOptions.terraStatus) return json({ error: 'provider failure' }, requestOptions.terraStatus);
      const terraCallCount = calls.filter((call) => call.url.endsWith('/v1/responses')
        && call.body?.model === 'gpt-5.6-terra').length;
      if (requestOptions.repairTerraStatus && terraCallCount === 2) {
        return json({ error: 'provider failure' }, requestOptions.repairTerraStatus);
      }
      return json({ id: `resp_terra_${calls.filter((call) => call.url.endsWith('/v1/responses')).length}`,
        usage: { input_tokens: 500, output_tokens: 200 },
        output_text: requestOptions.terraOutputText ?? JSON.stringify({ reply: '두부국을 추천해요.',
        recipe: typeof generatedRecipe === 'function' ? generatedRecipe(body ?? {}) : generatedRecipe }) });
    }
    return new Response('not found', { status: 404 });
  };
  try {
    const request = new Request('https://edge.test/menu-chat', {
      method: requestOptions.method ?? 'POST',
      headers: requestOptions.authorization === null
        ? {} : { authorization: requestOptions.authorization ?? 'Bearer user-test' },
      body: requestOptions.method && requestOptions.method !== 'POST'
        ? undefined
        : requestOptions.rawBody
          ?? JSON.stringify({ message: requestOptions.message ?? '두부국 먹고 싶어', history: [], cookingTools: ['냄비'], allergens,
            ...(requestOptions.missingIngredientConfirmationTicket
              ? { missingIngredientConfirmationTicket: requestOptions.missingIngredientConfirmationTicket } : {}) }),
    });
    const response = await handler!(request);
    return { response, result: await response.json() as Record<string, unknown>, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('eligible public candidate is sent as bounded technique evidence without raw amounts', async () => {
  const { response, result, calls } = await invokeMenuChat([techniqueCandidate()], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    const reference = input.techniqueReference as Record<string, unknown>;
    assert.deepEqual(reference.ingredientNames, ['두부', '애호박']);
    assert.equal(reference.ingredients, undefined);
    assert.equal(reference.cookingMethod, '끓이기');
    return modelRecipe;
  });
  assert.equal(response.status, 200);
  assert.equal((result.recipe as Record<string, unknown>)?.origin, 'MFDS');
  assert.deepEqual((result.recipe as Record<string, unknown>)?.sources, []);
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/search_recipe_technique_candidates')).length, 2);
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/get_recipe_candidate_detail')).length, 1);
  const trace = calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'))
    ?.body?.trace as Record<string, unknown>;
  assert.equal(trace.initial_candidate_origin, 'MFDS');
  assert.equal(trace.generation_path, 'public_technique');
  assert.equal(trace.candidate_score_band, 'high');
  for (const call of calls.filter((entry) => entry.url.endsWith('/v1/responses'))) {
    assert.equal(call.body?.tools, undefined);
  }
});

test('eligible public technique keeps priority over a shared technique', async () => {
  const { result } = await invokeMenuChat(
    [techniqueCandidate({ id: 'public-1', ingredient_count: 8 })],
    [techniqueCandidate({ id: 'shared-0', title: '두부찜', origin: 'SHARED_AI', ingredient_count: 1 })],
  );
  assert.equal((result.recipe as Record<string, unknown>)?.origin, 'MFDS');
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

test('a failed first recipe goes directly to one constrained repair without another ordinary generation', async () => {
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
  assert.equal(terraCalls.length, 2);
  const repair = JSON.parse(String(terraCalls.at(-1)?.body?.input)) as Record<string, unknown>;
  assert.deepEqual((repair.validationFeedback as Record<string, unknown>).missingNames, ['멸치', '다시마']);
});

test('repair drops technique evidence and uses only available pantry food', async () => {
  const missingFood = { ...modelRecipe, ingredients: [
    ingredient,
    { ...ingredient, ingredientKey: null, name: '애호박', quantity: 50, requiredPurchase: true },
  ] };
  const pork = {
    ingredientKey: 'pork-belly', name: '삼겹살', quantity: 150, unit: 'g',
    inInventory: true, requiredPurchase: false,
  };
  const doenjang = {
    ingredientKey: 'doenjang', name: '된장', quantity: 30, unit: 'g',
    inInventory: true, requiredPurchase: false,
  };
  const scallion = {
    ingredientKey: 'scallion', name: '대파', quantity: 20, unit: 'g',
    inInventory: true, requiredPurchase: false,
  };
  const valid = {
    ...modelRecipe,
    title: '삼겹살 된장찌개',
    ingredients: [pork, doenjang, scallion, {
      ingredientKey: null, name: '물', quantity: 350, unit: 'ml',
      inInventory: false, requiredPurchase: false,
    }],
    steps: [{ text: '물에 된장을 풀고 삼겹살을 끓인 뒤 대파를 넣는다.', minutes: 15 }],
    optionalIngredientTip: {
      ingredientName: '애호박', stepNumber: 1,
      message: '애호박이 있으면 이 단계에 넣으면 국물 맛이 더 좋아져요.',
    },
  };
  const pantry = [
    { ingredient_key: 'pork-belly', display_name: '삼겹살', quantity: 300, unit: 'g' },
    { ingredient_key: 'doenjang', display_name: '된장', quantity: 500, unit: 'g' },
    { ingredient_key: 'scallion', display_name: '대파', quantity: 100, unit: 'g' },
    { ingredient_key: 'garlic', display_name: '다진마늘', quantity: 100, unit: 'g' },
  ];
  const candidate = techniqueCandidate({
    id: 'catalog-technique', title: '삼겹살 된장찌개',
    required_matched_count: 2, required_count: 2,
    inventory_matched_count: 3, ingredient_count: 8,
  });
  const { response, result, calls } = await invokeMenuChat([candidate], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.validationFeedback ? valid : missingFood;
  }, pantry, [], {
    message: '삼겹살과 된장을 사용한 요리 해줘', dishName: '', ingredientNames: ['삼겹살', '된장'],
  });

  assert.equal(response.status, 200);
  const returned = result.recipe as typeof valid;
  assert.equal(returned.ingredients.some((item) => item.requiredPurchase), false);
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/get_recipe_candidate_detail')).length, 1);
  const terraCalls = calls.filter((call) => call.url.endsWith('/v1/responses') && call.body?.model === 'gpt-5.6-terra');
  const initialInput = JSON.parse(String(terraCalls[0]?.body?.input)) as Record<string, unknown>;
  assert.notEqual(initialInput.techniqueReference, null);
  const repairInput = JSON.parse(String(terraCalls[1]?.body?.input)) as Record<string, unknown>;
  assert.equal(repairInput.techniqueReference, null);
  const trace = calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'))
    ?.body?.trace as Record<string, unknown>;
  assert.equal(trace.initial_candidate_origin, 'MFDS');
  assert.equal(trace.generation_path, 'ai_repair');
  assert.equal(trace.candidate_score_band, 'high');
  const responseSchema = ((terraCalls[1]?.body?.text as Record<string, unknown>)?.format as Record<string, unknown>)
    ?.schema as { properties?: { recipe?: { properties?: Record<string, unknown>; required?: string[] } } };
  assert.ok(responseSchema.properties?.recipe?.properties?.optionalIngredientTip);
  assert.equal(responseSchema.properties?.recipe?.required?.includes('optionalIngredientTip'), true);
  const repairInventory = (repairInput.userContext as { inventory: Array<{ display_name: string }> }).inventory;
  assert.deepEqual(repairInventory.map((item) => item.display_name), ['삼겹살', '된장', '대파', '다진마늘']);
});

test('five pantry-only recipe scenarios return usable answers with optional tips kept separate', async () => {
  const cases = [
    {
      request: '삼겹살과 된장을 사용한 요리 해줘',
      requested: ['삼겹살', '된장'],
      pantry: [
        { ingredient_key: 'pork-belly', display_name: '삼겹살', quantity: 300, unit: 'g' },
        { ingredient_key: 'doenjang', display_name: '된장', quantity: 500, unit: 'g' },
        { ingredient_key: 'scallion', display_name: '대파', quantity: 100, unit: 'g' },
        { ingredient_key: 'garlic', display_name: '다진마늘', quantity: 100, unit: 'g' },
      ],
      recipe: {
        ...modelRecipe, title: '삼겹살 된장찌개', minutes: 20,
        ingredients: [
          { ingredientKey: 'pork-belly', name: '삼겹살', quantity: 150, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'doenjang', name: '된장', quantity: 30, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'scallion', name: '대파', quantity: 20, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'garlic', name: '다진마늘', quantity: 5, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: null, name: '물', quantity: 350, unit: 'ml', inInventory: false, requiredPurchase: false },
        ],
        steps: [
          { text: '물에 된장을 풀고 삼겹살과 다진마늘을 넣어 15분간 끓인다.', minutes: 15 },
          { text: '대파를 넣고 한소끔 더 끓여 완성한다.', minutes: 3 },
        ],
        optionalIngredientTip: { ingredientName: '애호박', stepNumber: 1,
          message: '애호박이 있으면 1단계에 넣으면 국물 맛이 더 좋아져요.' },
      },
    },
    {
      request: '두부와 대파로 따뜻한 요리 해줘',
      requested: ['두부', '대파'],
      pantry: [
        { ingredient_key: 'tofu', display_name: '두부', quantity: 300, unit: 'g' },
        { ingredient_key: 'scallion', display_name: '대파', quantity: 100, unit: 'g' },
        { ingredient_key: 'kimchi', display_name: '김치', quantity: 500, unit: 'g' },
      ],
      recipe: {
        ...modelRecipe, title: '대파 두부 김치찌개', minutes: 18,
        ingredients: [
          { ingredientKey: 'tofu', name: '두부', quantity: 200, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'scallion', name: '대파', quantity: 20, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'kimchi', name: '김치', quantity: 150, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: null, name: '물', quantity: 300, unit: 'ml', inInventory: false, requiredPurchase: false },
        ],
        steps: [
          { text: '김치와 물을 냄비에 넣고 10분간 끓인다.', minutes: 10 },
          { text: '두부와 대파를 넣고 5분간 더 끓인다.', minutes: 5 },
        ],
        optionalIngredientTip: { ingredientName: '양파', stepNumber: 1,
          message: '양파가 있으면 1단계에 넣으면 국물에 단맛이 더해져요.' },
      },
    },
    {
      request: '계란과 양파로 10분 요리 해줘',
      requested: ['계란', '양파'],
      pantry: [
        { ingredient_key: 'egg', display_name: '계란', quantity: 10, unit: '개' },
        { ingredient_key: 'onion', display_name: '양파', quantity: 10, unit: '개' },
        { ingredient_key: 'oil', display_name: '식용유', quantity: 500, unit: 'ml' },
        { ingredient_key: 'salt', display_name: '소금', quantity: 500, unit: 'g' },
      ],
      recipe: {
        ...modelRecipe, title: '양파 계란볶음', minutes: 10,
        ingredients: [
          { ingredientKey: 'egg', name: '계란', quantity: 2, unit: '개', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'onion', name: '양파', quantity: 1, unit: '개', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'oil', name: '식용유', quantity: 10, unit: 'ml', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'salt', name: '소금', quantity: 2, unit: 'g', inInventory: true, requiredPurchase: false },
        ],
        steps: [
          { text: '양파를 식용유에 부드러워질 때까지 볶는다.', minutes: 4 },
          { text: '계란과 소금을 넣고 촉촉하게 익을 때까지 볶는다.', minutes: 3 },
        ],
        optionalIngredientTip: { ingredientName: '치즈', stepNumber: 2,
          message: '치즈가 있으면 2단계 마지막에 넣으면 더 고소해져요.' },
      },
    },
    {
      request: '닭가슴살과 감자로 요리 해줘',
      requested: ['닭가슴살', '감자'],
      pantry: [
        { ingredient_key: 'chicken', display_name: '닭가슴살', quantity: 500, unit: 'g' },
        { ingredient_key: 'potato', display_name: '감자', quantity: 10, unit: '개' },
        { ingredient_key: 'soy', display_name: '간장', quantity: 500, unit: 'ml' },
        { ingredient_key: 'garlic', display_name: '다진마늘', quantity: 100, unit: 'g' },
      ],
      recipe: {
        ...modelRecipe, title: '닭가슴살 감자조림', minutes: 25,
        ingredients: [
          { ingredientKey: 'chicken', name: '닭가슴살', quantity: 200, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'potato', name: '감자', quantity: 2, unit: '개', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'soy', name: '간장', quantity: 1, unit: 'T', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'garlic', name: '다진마늘', quantity: 5, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: null, name: '물', quantity: 250, unit: 'ml', inInventory: false, requiredPurchase: false },
        ],
        steps: [
          { text: '닭가슴살과 감자를 물, 간장, 다진마늘과 함께 끓인다.', minutes: 15 },
          { text: '국물이 자작해질 때까지 졸인다.', minutes: 7 },
        ],
        optionalIngredientTip: { ingredientName: '당근', stepNumber: 1,
          message: '당근이 있으면 1단계에 넣으면 단맛과 색감이 좋아져요.' },
      },
    },
    {
      request: '고등어와 무로 요리 해줘',
      requested: ['고등어', '무'],
      pantry: [
        { ingredient_key: 'mackerel', display_name: '고등어', quantity: 400, unit: 'g' },
        { ingredient_key: 'radish', display_name: '무', quantity: 10, unit: '개' },
        { ingredient_key: 'soy', display_name: '간장', quantity: 500, unit: 'ml' },
        { ingredient_key: 'pepper', display_name: '고춧가루', quantity: 500, unit: 'g' },
      ],
      recipe: {
        ...modelRecipe, title: '고등어 무조림', minutes: 30,
        ingredients: [
          { ingredientKey: 'mackerel', name: '고등어', quantity: 200, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'radish', name: '무', quantity: 1, unit: '개', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'soy', name: '간장', quantity: 30, unit: 'ml', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'pepper', name: '고춧가루', quantity: 10, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: null, name: '물', quantity: 300, unit: 'ml', inInventory: false, requiredPurchase: false },
        ],
        steps: [
          { text: '무를 물과 간장, 고춧가루에 넣고 먼저 끓인다.', minutes: 10 },
          { text: '고등어를 올리고 양념이 배도록 충분히 졸인다.', minutes: 15 },
        ],
        optionalIngredientTip: { ingredientName: '맛술', stepNumber: 2,
          message: '맛술이 있으면 2단계에 넣으면 생선 향을 줄이는 데 도움이 돼요.' },
      },
      invalidFirst: {
        ...modelRecipe, title: '맛술 고등어 조림',
        ingredients: [
          { ingredientKey: 'mackerel', name: '고등어', quantity: 200, unit: 'g', inInventory: true, requiredPurchase: false },
          { ingredientKey: 'radish', name: '무', quantity: 1, unit: '개', inInventory: true, requiredPurchase: false },
          { ingredientKey: null, name: '맛술', quantity: 30, unit: 'ml', inInventory: false, requiredPurchase: true },
        ],
        steps: [{ text: '모든 재료를 넣고 졸인다.', minutes: 20 }],
      },
    },
  ];

  const summaries: Array<Record<string, unknown>> = [];
  for (const scenario of cases) {
    const { response, result, calls } = await invokeMenuChat([], [], (body) => {
      const input = JSON.parse(String(body.input)) as Record<string, unknown>;
      return scenario.invalidFirst && !input.validationFeedback ? scenario.invalidFirst : scenario.recipe;
    }, scenario.pantry, [], {
      message: scenario.request, dishName: '', ingredientNames: scenario.requested,
    });
    assert.equal(response.status, 200);
    const recipe = result.recipe as typeof scenario.recipe;
    assert.equal(recipe.ingredients.some((item) => item.requiredPurchase), false);
    for (const requested of scenario.requested) {
      assert.equal(recipe.ingredients.some((item) => item.name === requested), true);
    }
    assert.equal(recipe.ingredients.some((item) => item.name === recipe.optionalIngredientTip?.ingredientName), false);
    const terraCalls = calls.filter((call) => call.url.endsWith('/v1/responses') && call.body?.model === 'gpt-5.6-terra');
    summaries.push({
      request: scenario.request,
      title: recipe.title,
      ingredients: recipe.ingredients.map((item) => `${item.name} ${item.quantity ?? ''}${item.unit ?? ''}`.trim()),
      steps: recipe.steps.map((step) => step.text),
      optionalTip: recipe.optionalIngredientTip?.message ?? null,
      terraAttempts: terraCalls.length,
    });
  }
  console.log(`RECIPE_SCENARIO_RESULTS=${JSON.stringify(summaries)}`);
});

test('ten-item pantry covers technique-reference routes and reports the missing-request boundary', async () => {
  const pantry = [
    { ingredient_key: 'tofu', display_name: '두부', quantity: 300, unit: 'g', use_by_at: '2999-01-01' },
    { ingredient_key: 'scallion', display_name: '대파', quantity: 100, unit: 'g', use_by_at: '2999-01-01' },
    { ingredient_key: 'doenjang', display_name: '된장', quantity: 500, unit: 'g', use_by_at: '2999-01-01' },
    { ingredient_key: 'pork-belly', display_name: '삼겹살', quantity: 400, unit: 'g', use_by_at: '2999-01-01' },
    { ingredient_key: 'potato', display_name: '감자', quantity: 5, unit: '개', use_by_at: '2999-01-01' },
    { ingredient_key: 'onion', display_name: '양파', quantity: 4, unit: '개', use_by_at: '2999-01-01' },
    { ingredient_key: 'egg', display_name: '계란', quantity: 10, unit: '개', use_by_at: '2999-01-01' },
    { ingredient_key: 'kimchi', display_name: '김치', quantity: 500, unit: 'g', use_by_at: '2999-01-01' },
    { ingredient_key: 'soy-sauce', display_name: '간장', quantity: 500, unit: 'ml', use_by_at: '2999-01-01' },
    { ingredient_key: 'oil', display_name: '식용유', quantity: 500, unit: 'ml', use_by_at: '2999-01-01' },
  ];
  const summaries: Array<Record<string, unknown>> = [];
  const pantryRecipe = (title: string, ingredients: Array<Record<string, unknown>>, steps: string[]) => ({
    ...modelRecipe,
    title,
    ingredients,
    steps: steps.map((text, index) => ({ text, minutes: index === 0 ? 8 : 3 })),
    optionalIngredientTip: null,
  });
  const publicTofuCandidate = techniqueCandidate({
    id: 'MFDS_TOFU_STEW', title: '두부 된장국', name_score: 0, method_score: 0,
    required_matched_count: 2, required_count: 2,
    inventory_matched_count: 3, ingredient_count: 6, step_count: 3,
  });
  const publicTofuDetail = {
    id: 'MFDS_TOFU_STEW', title: '두부 된장국', origin: 'MFDS', cookingMethod: '끓이기',
    ingredients: [
      { name: '두부', amount: '200g' }, { name: '대파', amount: '20g' },
      { name: '된장', amount: '20g' }, { name: '멸치', amount: '10g' }, { name: '다시마', amount: '1장' },
    ],
    steps: ['멸치와 다시마로 국물을 낸다.', '된장을 풀고 두부를 끓인다.', '대파를 넣어 마무리한다.'],
    tip: '약불로 마무리한다.',
  };

  const publicMismatch = await invokeMenuChat([publicTofuCandidate], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    const reference = input.techniqueReference as { ingredientNames?: string[]; steps?: string[] } | null;
    assert.equal(reference?.ingredientNames?.includes('멸치'), true);
    assert.equal(reference?.ingredientNames?.includes('다시마'), true);
    assert.equal((reference?.steps?.length ?? 0) > 0, true);
    return pantryRecipe('두부 대파 된장국', [
      { ingredientKey: 'tofu', name: '두부', quantity: 200, unit: 'g', inInventory: true, requiredPurchase: false },
      { ingredientKey: 'scallion', name: '대파', quantity: 20, unit: 'g', inInventory: true, requiredPurchase: false },
      { ingredientKey: 'doenjang', name: '된장', quantity: 20, unit: 'g', inInventory: true, requiredPurchase: false },
      { ingredientKey: null, name: '물', quantity: 350, unit: 'ml', inInventory: false, requiredPurchase: false },
    ], ['물에 된장을 풀고 두부를 끓인다.', '대파를 넣어 마무리한다.']);
  }, pantry, [], {
    message: '두부와 대파로 따뜻한 요리 해줘', dishName: '', ingredientNames: ['두부', '대파'],
    candidateDetail: publicTofuDetail,
  });
  assert.equal(publicMismatch.response.status, 200);
  assert.equal((publicMismatch.result.recipe as Record<string, unknown>).origin, 'MFDS');
  const publicRecipe = publicMismatch.result.recipe as { ingredients: Array<{ name: string; requiredPurchase: boolean }> };
  assert.deepEqual(publicRecipe.ingredients.map((item) => item.name), ['두부', '대파', '된장', '물']);
  assert.equal(publicRecipe.ingredients.some((item) => item.requiredPurchase), false);
  summaries.push({ case: '공공DB 재료 불일치', status: publicMismatch.response.status,
    origin: (publicMismatch.result.recipe as Record<string, unknown>).origin,
    referenceIncludedAbsentFoods: ['멸치', '다시마'], outputIngredients: publicRecipe.ingredients.map((item) => item.name) });

  const publicPorkCandidate = techniqueCandidate({
    id: 'MAFRA_PORK_BOIL', title: '된장 돼지고기 수육', origin: 'MAFRA', name_score: 0, method_score: 0,
    required_matched_count: 2, required_count: 2, inventory_matched_count: 4, ingredient_count: 8, step_count: 4,
  });
  let porkReferenceTitle: string | undefined;
  const publicPork = await invokeMenuChat([publicPorkCandidate], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    porkReferenceTitle = (input.techniqueReference as { title?: string } | null)?.title;
    return pantryRecipe('된장 삼겹살 수육', [
      { ingredientKey: 'pork-belly', name: '삼겹살', quantity: 250, unit: 'g', inInventory: true, requiredPurchase: false },
      { ingredientKey: 'doenjang', name: '된장', quantity: 25, unit: 'g', inInventory: true, requiredPurchase: false },
      { ingredientKey: 'onion', name: '양파', quantity: 1, unit: '개', inInventory: true, requiredPurchase: false },
      { ingredientKey: null, name: '물', quantity: 700, unit: 'ml', inInventory: false, requiredPurchase: false },
    ], ['물에 된장을 풀고 양파와 삼겹살을 삶는다.', '삼겹살을 건져 썰어 완성한다.']);
  }, pantry, [], {
    message: '삼겹살과 된장을 사용한 요리 해줘', dishName: '', ingredientNames: ['삼겹살', '된장'],
    candidateDetail: {
      id: 'MAFRA_PORK_BOIL', title: '된장 돼지고기 수육', origin: 'MAFRA', cookingMethod: '삶기',
      ingredients: [{ name: '돼지고기' }, { name: '된장' }, { name: '마늘' }, { name: '월계수잎' }],
      steps: ['물에 된장을 풀어 끓인다.', '돼지고기를 삶아 완성한다.'],
    },
  });
  const publicPorkTrace = publicPork.calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'))
    ?.body?.trace;
  assert.equal(publicPork.response.status, 200,
    `response=${JSON.stringify(publicPork.result)} trace=${JSON.stringify(publicPorkTrace)}`);
  assert.equal(porkReferenceTitle, '된장 돼지고기 수육');
  assert.equal((publicPork.result.recipe as Record<string, unknown>).origin, 'MAFRA');
  summaries.push({ case: '정확한 제목 없음', status: publicPork.response.status,
    origin: (publicPork.result.recipe as Record<string, unknown>).origin,
    title: (publicPork.result.recipe as Record<string, unknown>).title });

  const sharedCandidate = techniqueCandidate({
    id: 'shared-egg-1', title: '양파 달걀볶음', origin: 'SHARED_AI', name_score: 0, method_score: 0,
    required_matched_count: 2, required_count: 2, inventory_matched_count: 3, ingredient_count: 3, step_count: 2,
  });
  const shared = await invokeMenuChat([], [sharedCandidate], pantryRecipe('양파 계란볶음', [
    { ingredientKey: 'egg', name: '계란', quantity: 2, unit: '개', inInventory: true, requiredPurchase: false },
    { ingredientKey: 'onion', name: '양파', quantity: 1, unit: '개', inInventory: true, requiredPurchase: false },
    { ingredientKey: 'oil', name: '식용유', quantity: 10, unit: 'ml', inInventory: true, requiredPurchase: false },
  ], ['양파를 식용유에 볶는다.', '계란을 넣고 익힌다.']), pantry, [], {
    message: '계란과 양파로 물 없이 요리해줘', dishName: '', ingredientNames: ['계란', '양파'],
    candidateDetail: {
      id: 'shared-egg-1', title: '양파 달걀볶음', origin: 'SHARED_AI', cookingMethod: '볶기',
      ingredients: [{ name: '계란' }, { name: '양파' }, { name: '식용유' }],
      steps: ['양파를 볶는다.', '달걀을 넣고 익힌다.'],
    },
  });
  assert.equal(shared.response.status, 200);
  assert.equal((shared.result.recipe as Record<string, unknown>).origin, 'SHARED_AI');
  assert.equal(((shared.result.recipe as { ingredients: Array<{ name: string }> }).ingredients)
    .some((item) => item.name === '물'), false);
  summaries.push({ case: '공유DB 2순위', status: shared.response.status,
    origin: (shared.result.recipe as Record<string, unknown>).origin, waterUsed: false });

  const aiOnly = await invokeMenuChat([], [], pantryRecipe('감자 김치볶음', [
    { ingredientKey: 'potato', name: '감자', quantity: 2, unit: '개', inInventory: true, requiredPurchase: false },
    { ingredientKey: 'kimchi', name: '김치', quantity: 150, unit: 'g', inInventory: true, requiredPurchase: false },
    { ingredientKey: 'oil', name: '식용유', quantity: 10, unit: 'ml', inInventory: true, requiredPurchase: false },
  ], ['감자를 식용유에 익힌다.', '김치를 넣고 볶아 완성한다.']), pantry, [], {
    message: '감자와 김치로 볶음 요리 해줘', dishName: '', ingredientNames: ['감자', '김치'],
  });
  assert.equal(aiOnly.response.status, 200);
  assert.equal((aiOnly.result.recipe as Record<string, unknown>).origin, 'AI_GENERATED');
  summaries.push({ case: '참고 후보 없음', status: aiOnly.response.status,
    origin: (aiOnly.result.recipe as Record<string, unknown>).origin });

  const missingRequested = await invokeMenuChat([], [], pantryRecipe('연어 감자구이', [
    { ingredientKey: null, name: '연어', quantity: 150, unit: 'g', inInventory: false, requiredPurchase: true },
    { ingredientKey: 'potato', name: '감자', quantity: 2, unit: '개', inInventory: true, requiredPurchase: false },
    { ingredientKey: 'oil', name: '식용유', quantity: 10, unit: 'ml', inInventory: true, requiredPurchase: false },
  ], ['연어와 감자를 식용유에 굽는다.', '속까지 익혀 완성한다.']), pantry, [], {
    message: '연어와 감자로 요리해줘', dishName: '', ingredientNames: ['연어', '감자'],
  });
  assert.equal(missingRequested.response.status, 200);
  assert.deepEqual(missingRequested.result.missingIngredientConfirmation, {
    ticket: '11111111-1111-4111-8111-111111111111', ingredients: ['연어'],
  });
  const missingTerraCalls = missingRequested.calls.filter((call) => call.url.endsWith('/v1/responses')
    && call.body?.model === 'gpt-5.6-terra');
  assert.equal(missingTerraCalls.length, 0);
  summaries.push({ case: '재고에 없는 요청 재료', status: missingRequested.response.status,
    requested: ['연어', '감자'], terraAttempts: missingTerraCalls.length,
    result: '재고에 없는 연어를 구매 필요 재료로 허용할지 사용자에게 확인' });

  console.log(`TEN_ITEM_TECHNIQUE_RESULTS=${JSON.stringify(summaries)}`);
});

test('missing requested food returns a confirmation before catalog or Terra work', async () => {
  const pantry = [{
    ingredient_key: 'potato', display_name: '감자', quantity: 5, unit: '개', use_by_at: '2999-01-01',
  }];
  const { response, result, calls } = await invokeMenuChat([], [], modelRecipe, pantry, [], {
    message: '연어와 감자로 요리해줘', dishName: '', ingredientNames: ['연어', '감자'],
    confirmationTicket: '11111111-1111-4111-8111-111111111111',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(result.missingIngredientConfirmation, {
    ticket: '11111111-1111-4111-8111-111111111111', ingredients: ['연어'],
  });
  assert.equal(result.recipe, null);
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/consume_ai_request')).length, 1);
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/create_missing_ingredient_confirmation')).length, 1);
  const createBody = calls.find((call) => call.url.endsWith('/rpc/create_missing_ingredient_confirmation'))?.body;
  assert.deepEqual(createBody?.p_missing_ingredient_names, ['연어']);
  assert.equal(calls.some((call) => call.url.endsWith('/rpc/search_recipe_technique_candidates')), false);
  assert.equal(calls.some((call) => call.body?.model === 'gpt-5.6-terra'), false);
});

test('confirmed missing food consumes one ticket, skips Luna and returns it as purchase-required', async () => {
  const ticket = '11111111-1111-4111-8111-111111111111';
  const pantry = [{
    ingredient_key: 'potato', display_name: '감자', quantity: 5, unit: '개', use_by_at: '2999-01-01',
  }];
  const recipe = {
    ...modelRecipe,
    title: '연어 감자구이',
    ingredients: [
      { ingredientKey: null, name: '연어', quantity: 150, unit: 'g', inInventory: false, requiredPurchase: true },
      { ingredientKey: 'potato', name: '감자', quantity: 2, unit: '개', inInventory: true, requiredPurchase: false },
    ],
    steps: [{ text: '연어와 감자를 후라이팬에 구워 속까지 익힌다.', minutes: 12 }],
  };
  const { response, result, calls } = await invokeMenuChat([], [], recipe, pantry, [], {
    message: '연어와 감자로 요리해줘',
    missingIngredientConfirmationTicket: ticket,
    consumedConfirmation: {
      dishName: '', ingredientNames: ['연어', '감자'], missingIngredientNames: ['연어'],
    },
  });

  assert.equal(response.status, 200);
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/consume_missing_ingredient_confirmation')).length, 1);
  const consumeBody = calls.find((call) => call.url.endsWith('/rpc/consume_missing_ingredient_confirmation'))?.body;
  assert.equal(consumeBody?.p_token, ticket);
  assert.equal(calls.some((call) => call.url.endsWith('/rpc/consume_ai_request')), false);
  assert.equal(calls.some((call) => call.body?.model === 'gpt-5.6-luna'), false);
  assert.equal(calls.filter((call) => call.body?.model === 'gpt-5.6-terra').length, 1);
  const terraCall = calls.find((call) => call.body?.model === 'gpt-5.6-terra');
  const terraInput = JSON.parse(String(terraCall?.body?.input)) as Record<string, unknown>;
  assert.deepEqual(terraInput.approvedMissingIngredients, ['연어']);
  assert.match(String(terraCall?.body?.instructions), /승인한 재료: 연어/);
  const returned = result.recipe as { ingredients: Array<{ name: string; requiredPurchase: boolean }> };
  assert.equal(returned.ingredients.find((item) => item.name === '연어')?.requiredPurchase, true);
});

test('confirmation never authorizes a second missing ingredient invented by the model', async () => {
  const pantry = [{
    ingredient_key: 'potato', display_name: '감자', quantity: 5, unit: '개', use_by_at: '2999-01-01',
  }];
  const unsafe = {
    ...modelRecipe,
    title: '연어 감자 버터구이',
    ingredients: [
      { ingredientKey: null, name: '연어', quantity: 150, unit: 'g', inInventory: false, requiredPurchase: true },
      { ingredientKey: 'potato', name: '감자', quantity: 2, unit: '개', inInventory: true, requiredPurchase: false },
      { ingredientKey: null, name: '버터', quantity: 10, unit: 'g', inInventory: false, requiredPurchase: true },
    ],
    steps: [{ text: '연어와 감자를 버터에 구워 속까지 익힌다.', minutes: 12 }],
  };
  const { response, calls } = await invokeMenuChat([], [], unsafe, pantry, [], {
    message: '연어와 감자로 요리해줘',
    missingIngredientConfirmationTicket: '11111111-1111-4111-8111-111111111111',
    consumedConfirmation: {
      dishName: '', ingredientNames: ['연어', '감자'], missingIngredientNames: ['연어'],
    },
  });

  assert.equal(response.status, 422);
  assert.equal(calls.filter((call) => call.body?.model === 'gpt-5.6-terra').length, 2);
});

test('expired or reused missing-ingredient ticket stops before every model call', async () => {
  const { response, calls } = await invokeMenuChat([], [], modelRecipe, undefined, [], {
    message: '연어로 요리해줘', missingIngredientConfirmationTicket: 'expired-ticket',
    consumedConfirmation: null,
  });
  assert.equal(response.status, 409);
  assert.equal(calls.some((call) => call.url.endsWith('/rpc/consume_ai_request')), false);
  assert.equal(calls.some((call) => call.url.endsWith('/v1/responses')), false);
});

test('candidate fallbacks never exceed the initial Terra call plus one repair', async () => {
  const unsafe = { ...modelRecipe, ingredients: [
    ingredient,
    { ...ingredient, ingredientKey: null, name: '멸치', quantity: 30, requiredPurchase: true },
    { ...ingredient, ingredientKey: null, name: '다시마', quantity: 10, requiredPurchase: true },
  ] };
  const candidate = techniqueCandidate({ id: 'candidate-1' });
  const { response, calls } = await invokeMenuChat([candidate], [{ ...candidate, id: 'candidate-2', origin: 'SHARED_AI' }],
    (body) => {
      const input = JSON.parse(String(body.input)) as Record<string, unknown>;
      return input.validationFeedback ? modelRecipe : unsafe;
    });

  assert.equal(response.status, 200);
  const terraCalls = calls.filter((call) => call.url.endsWith('/v1/responses') && call.body?.model === 'gpt-5.6-terra');
  assert.equal(terraCalls.length, 2);
  const repair = JSON.parse(String(terraCalls[1]?.body?.input)) as Record<string, unknown>;
  assert.equal(repair.techniqueReference, null);
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/get_recipe_candidate_detail')).length, 1);
  assert.equal((repair.validationFeedback as Record<string, unknown>).problem, undefined);
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
    ...techniqueCandidate(),
  }], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.techniqueReference ? unsafeRecipe : modelRecipe;
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

test('no technique match searches shared second, then generates with Terra without web', async () => {
  const { response, result, calls } = await invokeMenuChat([]);
  assert.equal(response.status, 200);
  assert.equal((result.recipe as Record<string, unknown>)?.origin, 'AI_GENERATED');
  assert.deepEqual(calls.filter((call) => call.url.endsWith('/rpc/search_recipe_technique_candidates'))
    .map((call) => call.body?.source_kind), ['catalog', 'shared']);
  assert.equal(calls.some((call) => call.url.endsWith('/rpc/get_recipe_candidate_detail')), false);
  assert.equal(calls.filter((call) => call.url.endsWith('/v1/responses')).at(-1)?.body?.model, 'gpt-5.6-terra');
  const trace = calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'))
    ?.body?.trace as Record<string, unknown>;
  assert.equal(trace.initial_candidate_origin, 'AI_GENERATED');
  assert.equal(trace.generation_path, 'ai_only');
  assert.equal(trace.candidate_score_band, null);
});

test('a generated recipe missing any explicitly requested food is repaired before return', async () => {
  const missingScallion = {
    ...modelRecipe,
    title: '두부 쌈장 겹들임',
    ingredients: [ingredient, {
      ingredientKey: 'ssamjang', name: '쌈장', quantity: 15, unit: 'g',
      inInventory: true, requiredPurchase: false,
    }],
    steps: [{ text: '두부에 쌈장을 곁들여 먹는다.', minutes: 0 }],
  };
  const valid = {
    ...modelRecipe,
    title: '두부 대파 된장찌개',
    ingredients: [ingredient, {
      ingredientKey: 'scallion', name: '대파', quantity: 20, unit: 'g',
      inInventory: true, requiredPurchase: false,
    }, {
      ingredientKey: 'doenjang', name: '된장', quantity: 30, unit: 'g',
      inInventory: true, requiredPurchase: false,
    }, {
      ingredientKey: null, name: '물', quantity: 350, unit: 'ml',
      inInventory: false, requiredPurchase: false,
    }],
    steps: [{ text: '물에 된장을 풀고 두부를 끓인 뒤 대파를 넣어 끓인다.', minutes: 10 }],
  };
  const pantry = [
    { ingredient_key: 'tofu', display_name: '두부', quantity: 200, unit: 'g', use_by_at: '2999-10-20' },
    { ingredient_key: 'scallion', display_name: '대파', quantity: 100, unit: 'g', use_by_at: '2999-10-20' },
    { ingredient_key: 'ssamjang', display_name: '쌈장', quantity: 500, unit: 'g', use_by_at: '2999-04-10' },
    { ingredient_key: 'doenjang', display_name: '된장', quantity: 500, unit: 'g', use_by_at: '2999-04-15' },
  ];
  const { response, result, calls } = await invokeMenuChat([], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.validationFeedback ? valid : missingScallion;
  }, pantry, [], {
    message: '두부와 대파로 요리해줘', dishName: '', ingredientNames: ['두부', '대파'],
  });

  assert.equal(response.status, 200);
  assert.deepEqual((result.recipe as typeof valid).ingredients.map((item) => item.name), ['두부', '대파', '된장', '물']);
  const terraCalls = calls.filter((call) => call.url.endsWith('/v1/responses') && call.body?.model === 'gpt-5.6-terra');
  const finalInput = JSON.parse(String(terraCalls.at(-1)?.body?.input)) as Record<string, unknown>;
  assert.deepEqual(finalInput.requiredIngredients, ['두부', '대파']);
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

test('each authenticated request stores one content-free permanent trace and exposes its request id', async () => {
  const { response, calls } = await invokeMenuChat([]);
  const requestId = response.headers.get('x-request-id');
  assert.match(requestId ?? '', /^[0-9a-f-]{36}$/i);
  const traceCalls = calls.filter((call) => call.url.endsWith('/rpc/record_ai_request_trace'));
  assert.equal(traceCalls.length, 1);
  const trace = traceCalls[0]?.body?.trace as Record<string, unknown>;
  assert.equal(trace.request_id, requestId);
  assert.equal(trace.status, 200);
  assert.equal(trace.owner_id, 'test-user');
  assert.equal(trace.luna_call_count, 1);
  assert.equal(trace.terra_call_count, 1);
  assert.equal(trace.luna_input_tokens, 100);
  assert.equal(trace.terra_output_tokens, 200);
  for (const forbidden of ['message', 'history', 'inventory', 'recipe', 'prompt', 'input', 'output']) {
    assert.equal(Object.hasOwn(trace, forbidden), false);
  }
});

test('one failed generation plus one repair is recorded as two Terra calls with a repair reason', async () => {
  const unsafe = { ...modelRecipe, ingredients: [ingredient,
    { ...ingredient, ingredientKey: null, name: '멸치', requiredPurchase: true },
    { ...ingredient, ingredientKey: null, name: '다시마', requiredPurchase: true }],
  };
  const { response, calls } = await invokeMenuChat([], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.validationFeedback ? modelRecipe : unsafe;
  });
  assert.equal(response.status, 200);
  const traceCall = calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'));
  const trace = traceCall?.body?.trace as Record<string, unknown>;
  assert.equal(trace.terra_call_count, 2);
  assert.equal(trace.repair_reason, 'PURCHASE_LIMIT_EXCEEDED');
  assert.equal((trace.openai_request_ids as string[]).length, 3);
});

test('a different repair validation failure becomes the actual final error', async () => {
  const overPurchaseLimit = { ...modelRecipe, ingredients: [ingredient,
    { ...ingredient, ingredientKey: null, name: '멸치', requiredPurchase: true },
    { ...ingredient, ingredientKey: null, name: '다시마', requiredPurchase: true }],
  };
  const missingRequestedFood = {
    ...modelRecipe,
    title: '달걀찜',
    ingredients: [{ ...ingredient, ingredientKey: 'egg', name: '달걀' }],
    steps: [{ text: '달걀을 풀어 익힌다.', minutes: 8 }],
  };
  const { response, calls } = await invokeMenuChat([], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.validationFeedback ? missingRequestedFood : overPurchaseLimit;
  });

  assert.equal(response.status, 422);
  const traceCall = calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'));
  const trace = traceCall?.body?.trace as Record<string, unknown>;
  assert.equal(trace.error_code, 'REQUESTED_INGREDIENT_MISSING');
  assert.equal(trace.initial_failure_code, 'PURCHASE_LIMIT_EXCEEDED');
  assert.equal(trace.repair_failure_code, 'REQUESTED_INGREDIENT_MISSING');
  assert.equal(trace.final_failure_code, 'REQUESTED_INGREDIENT_MISSING');
  assert.equal(trace.failure_stage, 'validation_repair');
});

test('a successful repair retains only the initial failure diagnostic', async () => {
  const overPurchaseLimit = { ...modelRecipe, ingredients: [ingredient,
    { ...ingredient, ingredientKey: null, name: '멸치', requiredPurchase: true },
    { ...ingredient, ingredientKey: null, name: '다시마', requiredPurchase: true }],
  };
  const { response, calls } = await invokeMenuChat([], [], (body) => {
    const input = JSON.parse(String(body.input)) as Record<string, unknown>;
    return input.validationFeedback ? modelRecipe : overPurchaseLimit;
  });

  assert.equal(response.status, 200);
  const traceCall = calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'));
  const trace = traceCall?.body?.trace as Record<string, unknown>;
  assert.equal(trace.initial_failure_code, 'PURCHASE_LIMIT_EXCEEDED');
  assert.equal(trace.repair_failure_code, null);
  assert.equal(trace.final_failure_code, null);
  assert.equal(trace.failure_stage, null);
});

test('an initial Terra provider failure records its attempt and provider stage', async () => {
  const { response, calls } = await invokeMenuChat([], [], modelRecipe, undefined, [], {
    terraStatus: 500,
  });

  assert.equal(response.status, 502);
  const traceCall = calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'));
  const trace = traceCall?.body?.trace as Record<string, unknown>;
  assert.equal(trace.error_code, 'OPENAI_500');
  assert.equal(trace.initial_failure_code, 'OPENAI_500');
  assert.equal(trace.final_failure_code, 'OPENAI_500');
  assert.equal(trace.failure_stage, 'terra_initial');
});

test('a trace storage failure never changes the successful user response', async () => {
  const { response, result, calls } = await invokeMenuChat([], [], modelRecipe, undefined, [], {
    traceStatus: 500,
  });
  assert.equal(response.status, 200);
  assert.equal((result.recipe as typeof modelRecipe).title, '두부국');
  assert.equal(calls.filter((call) => call.url.endsWith('/rpc/record_ai_request_trace')).length, 1);
});

test('an authenticated rate-limit rejection is traceable without any model call', async () => {
  const { response, calls } = await invokeMenuChat([], [], modelRecipe, undefined, [], {
    rateAllowed: false,
  });
  assert.equal(response.status, 429);
  assert.equal(calls.some((call) => call.url.endsWith('/v1/responses')), false);
  const traceCall = calls.find((call) => call.url.endsWith('/rpc/record_ai_request_trace'));
  const trace = traceCall?.body?.trace as Record<string, unknown>;
  assert.equal(trace.status, 429);
  assert.equal(trace.error_code, 'RATE_LIMITED');
  assert.equal(trace.final_failure_code, 'RATE_LIMITED');
  assert.equal(trace.failure_stage, 'rate_limit');
  assert.equal(trace.luna_call_count, 0);
  assert.equal(trace.terra_call_count, 0);
});

test('authenticated controlled boundaries persist their exact final failure stage', async (t) => {
  const overPurchaseLimit = { ...modelRecipe, ingredients: [ingredient,
    { ...ingredient, ingredientKey: null, name: '멸치', requiredPurchase: true },
    { ...ingredient, ingredientKey: null, name: '다시마', requiredPurchase: true }],
  };
  const cases: Array<{
    name: string;
    expectedCode: string;
    expectedStage: string;
    generatedRecipe?: typeof modelRecipe | ((body: Record<string, unknown>) => typeof modelRecipe);
    options: Parameters<typeof invokeMenuChat>[5];
  }> = [
    { name: 'request JSON parsing', expectedCode: 'INVALID_REQUEST', expectedStage: 'request_parse',
      options: { rawBody: '{' } },
    { name: 'inventory query', expectedCode: 'INVENTORY_READ', expectedStage: 'inventory_query',
      options: { inventoryStatus: 500 } },
    { name: 'intent provider', expectedCode: 'OPENAI_500', expectedStage: 'intent_model',
      options: { lunaStatus: 500 } },
    { name: 'intent JSON parsing', expectedCode: 'OPENAI_INVALID_JSON', expectedStage: 'intent_parse',
      options: { lunaOutputText: '{' } },
    { name: 'catalog search', expectedCode: 'CATALOG_READ', expectedStage: 'catalog_search',
      options: { catalogStatus: 500 } },
    { name: 'initial recipe validation', expectedCode: 'OPENAI_INVALID_JSON', expectedStage: 'validation_initial',
      options: { terraOutputText: '{' } },
    { name: 'repair provider', expectedCode: 'OPENAI_500', expectedStage: 'terra_repair',
      generatedRecipe: overPurchaseLimit, options: { repairTerraStatus: 500 } },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const { response, calls } = await invokeMenuChat([], [], scenario.generatedRecipe ?? modelRecipe,
        undefined, [], scenario.options);
      assert.ok(response.status >= 400);
      const traceCalls = calls.filter((call) => call.url.endsWith('/rpc/record_ai_request_trace'));
      assert.equal(traceCalls.length, 1);
      const trace = traceCalls[0]?.body?.trace as Record<string, unknown>;
      assert.equal(trace.error_code, scenario.expectedCode);
      assert.equal(trace.final_failure_code, scenario.expectedCode);
      assert.equal(trace.failure_stage, scenario.expectedStage);
    });
  }
});

test('pre-auth 401 and 405 expose request ids without persisting permanent traces', async (t) => {
  for (const scenario of [
    { name: 'missing authorization', options: { authorization: null } },
    { name: 'unsupported method', options: { method: 'PUT' } },
  ]) {
    await t.test(scenario.name, async () => {
      const { response, calls } = await invokeMenuChat([], [], modelRecipe, undefined, [], scenario.options);
      assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/i);
      assert.equal(calls.some((call) => call.url.endsWith('/rpc/record_ai_request_trace')), false);
    });
  }
});

test.after(() => {
  Reflect.set(globalThis, 'Deno', previousDeno);
});
