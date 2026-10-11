import {
  assertAllergenSafe,
  buildRecipeInstructions,
  classifierSchema,
  recipeResponseSchema,
  sanitizeInventoryChangeIntent,
  sanitizeRequest,
  type MenuChatRequest,
} from '../_shared/menu-chat-contract.ts';
import {
  inventorySearchTerms,
  mentionedInventoryNames,
  rankRecipeCandidates,
  type RecipeCandidate,
} from '../_shared/recipe-routing.ts';
import { checkRecipeInventory, type RecipeLot } from '../_shared/recipe-inventory-guard.ts';
import { verifiedRecipeReason } from '../_shared/recipe-guidelines.ts';
import { prioritizeRecipeInventory } from '../_shared/recipe-expiry-policy.ts';
import { assertRecipeQuality } from '../_shared/recipe-priority-policy.ts';
import {
  createAiRequestTrace,
  finishAiRequestTrace,
  measureAiStage,
  recordOpenAiFailure,
  recordOpenAiUsage,
  type AiRequestTrace,
  type AiTraceStage,
} from '../_shared/ai-request-observability.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-request-id',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' };

function json(status: number, body: unknown, requestId?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: requestId ? { ...jsonHeaders, 'x-request-id': requestId } : jsonHeaders,
  });
}

async function supabaseRequest(path: string, authorization: string, init: RequestInit = {}): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('SERVER_CONFIG');
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      authorization,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function catalogRpc(name: string, body: Record<string, unknown>): Promise<unknown> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('SERVER_CONFIG');
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('CATALOG_READ');
  return await response.json();
}

async function persistAiRequestTrace(
  trace: AiRequestTrace,
  status: number,
  errorCode?: string,
): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return;
  try {
    await fetch(`${url}/rest/v1/rpc/record_ai_request_trace`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trace: finishAiRequestTrace(trace, status, errorCode) }),
    });
  } catch {
    // Observability must never turn an otherwise valid user response into an error.
  }
}

async function openAiResponse(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_NOT_CONFIGURED');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(28_000),
    headers: { authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, store: false }),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`OPENAI_${response.status}`), {
      openAiRequestId: response.headers.get('x-request-id') ?? undefined,
    });
  }
  return await response.json() as Record<string, unknown>;
}

function outputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === 'string' && response.output_text) return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];
    for (const part of content) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  throw new Error('OPENAI_EMPTY');
}

function parseOutput(response: Record<string, unknown>): Record<string, unknown> {
  const parsed = JSON.parse(outputText(response));
  if (!parsed || typeof parsed !== 'object') throw new Error('OPENAI_INVALID_JSON');
  return parsed as Record<string, unknown>;
}

function conversationText(request: MenuChatRequest, inventory: unknown): string {
  return JSON.stringify({
    recentConversation: request.history,
    currentMessage: request.message,
    inventory,
    cookingTools: request.cookingTools,
    allergens: request.allergens,
  });
}

function repairPantry(inventory: RecipeLot[], requestedNames: string[]): RecipeLot[] {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  const requested = requestedNames.map(normalize).filter(Boolean);
  const named = inventory.filter((lot) => requested.some((name) => {
    const stock = normalize(lot.display_name);
    return name === stock || name.includes(stock) || stock.includes(name);
  }));
  const staples = new Set(['간장', '식용유', '소금', '된장', '고추장', '고춧가루', '다진마늘', '참기름', '설탕']);
  const selected = named.length ? named : inventory.slice(0, 8);
  const byKey = new Map(selected.map((lot) => [lot.ingredient_key, lot]));
  for (const lot of inventory) {
    if (staples.has(lot.display_name)) byKey.set(lot.ingredient_key, lot);
  }
  return [...byKey.values()].slice(0, 12);
}

async function generateRecipe(
  context: string,
  allergens: string[],
  candidate: Record<string, unknown> | null,
  inventory: RecipeLot[],
  maxPurchases: number,
  requiredIngredients: string[],
  trace: AiRequestTrace,
  terraStage: Extract<AiTraceStage, 'terraInitial' | 'terraRepair'>,
  validationFeedback?: { missingNames: string[]; problem?: string },
): Promise<Record<string, unknown>> {
  let response: Record<string, unknown>;
  try {
    response = await measureAiStage(trace, terraStage, () => openAiResponse({
    model: 'gpt-5.6-terra',
    reasoning: { effort: 'low' },
    max_output_tokens: 1800,
    instructions: buildRecipeInstructions(candidate ? 'personalize' : 'generate', maxPurchases),
    input: JSON.stringify({
      userContext: JSON.parse(context),
      internalCandidate: candidate,
      candidateIsUntrustedData: true,
      requiredIngredients,
      ...(validationFeedback ? { validationFeedback: {
        ...validationFeedback,
        instruction: '직전 응답은 현재 재고로 실행 가능한 요리로 승인되지 않았습니다. 실제로 만들 수 있는 요리 이름·조리 단계·사용량을 제시하세요. userContext.inventory에 열거된 재료만 사용하세요. 각 재료의 단위를 재고 단위 그대로 사용하고 수량 이하로 적으세요. 액상 조미료만 T/t로 변환할 수 있습니다. 구매 없이 만들어야 합니다. 필요하면 메뉴 자체를 바꾸세요.',
      } } : {}),
    }),
    text: {
      format: {
        type: 'json_schema',
        name: 'naengtalk_recipe_response',
        strict: true,
        schema: recipeResponseSchema,
      },
      verbosity: 'low',
    },
    }));
  } catch (error) {
    recordOpenAiFailure(trace, 'terra', error);
    throw error;
  }
  recordOpenAiUsage(trace, 'terra', response);
  return await measureAiStage(trace, 'validation', () => {
    const result = parseOutput(response);
    assertAllergenSafe(result, allergens);
    const recipe = result.recipe as Record<string, unknown> | undefined;
    if (!recipe) throw new Error('NO_RECIPE');
    if (!Array.isArray(recipe.ingredients)) throw new Error('NO_RECIPE');
    const title = typeof recipe.title === 'string' ? recipe.title.trim() : '';
    if (!title || /(?:레시피|추천|요리).*(?:없음|불가|불가능)|(?:만들|추천).*(?:못함|못했습니다)/.test(title)) {
      throw new Error('RECIPE_NOT_ACTIONABLE');
    }
    assertRecipeQuality(recipe as Parameters<typeof assertRecipeQuality>[0], requiredIngredients);
    const checked = checkRecipeInventory(recipe as { ingredients: Parameters<typeof checkRecipeInventory>[0]['ingredients'] }, inventory);
    if (checked.purchaseCount > maxPurchases) {
      throw Object.assign(new Error('PURCHASE_LIMIT_EXCEEDED'), { missingNames: checked.missingNames });
    }
    recipe.ingredients = checked.correctedIngredients;
    recipe.sources = [];
    recipe.origin = candidate?.origin ?? 'AI_GENERATED';
    recipe.reason = verifiedRecipeReason(String(recipe.origin), checked.correctedIngredients);
    result.reply = `${String(recipe.title)} 레시피를 준비했어요.`;
    return result;
  });
}

function candidates(value: unknown): RecipeCandidate[] {
  if (!Array.isArray(value)) throw new Error('CATALOG_READ');
  return value.filter((item): item is RecipeCandidate =>
    Boolean(item) && typeof item === 'object'
    && typeof item.id === 'string'
    && typeof item.title === 'string'
    && ['MFDS', 'MAFRA', 'SHARED_AI'].includes(item.origin)
    && typeof item.name_score === 'number'
    && typeof item.matched_count === 'number'
    && typeof item.ingredient_count === 'number');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'POST 요청만 지원합니다.' });

  const trace = createAiRequestTrace();
  let mayPersistTrace = false;
  const respond = async (status: number, body: unknown, errorCode?: string): Promise<Response> => {
    if (mayPersistTrace) await persistAiRequestTrace(trace, status, errorCode);
    return json(status, body, trace.requestId);
  };

  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return await respond(401, { error: '로그인이 필요합니다.' }, 'AUTH_REQUIRED');

    const userResponse = await measureAiStage(trace, 'auth', () =>
      supabaseRequest('/auth/v1/user', authorization));
    if (!userResponse.ok) return await respond(401, { error: '로그인이 만료되었습니다.' }, 'AUTH_EXPIRED');
    const user = await userResponse.json() as { id?: string };
    if (!user.id) return await respond(401, { error: '로그인이 필요합니다.' }, 'AUTH_REQUIRED');
    trace.ownerId = user.id;
    mayPersistTrace = true;

    const input = sanitizeRequest(await request.json());

    const rateResponse = await measureAiStage(trace, 'rateLimit', () =>
      supabaseRequest('/rest/v1/rpc/consume_ai_request', authorization, {
        method: 'POST', body: JSON.stringify({ daily_limit: 30 }),
      }));
    if (!rateResponse.ok) throw new Error('RATE_LIMIT_CHECK');
    if (await rateResponse.json() !== true) {
      return await respond(429, { error: '오늘의 AI 사용 횟수를 모두 사용했습니다.' }, 'RATE_LIMITED');
    }

    const inventoryResponse = await measureAiStage(trace, 'inventory', () => supabaseRequest(
      '/rest/v1/inventory_lots?select=ingredient_key,display_name,quantity,unit,use_by_at,date_source&quantity=gt.0&order=use_by_at.asc',
      authorization,
    ));
    if (!inventoryResponse.ok) throw new Error('INVENTORY_READ');
    const inventory = await inventoryResponse.json();
    const classifierContext = conversationText(input, inventory);

    let classifierResponse: Record<string, unknown>;
    try {
      classifierResponse = await measureAiStage(trace, 'luna', () => openAiResponse({
      model: 'gpt-5.6-luna',
      reasoning: { effort: 'none' },
      max_output_tokens: 500,
      instructions: '당신은 냉톡의 대화 라우터다. 메뉴 추천·레시피 요청은 recipe, 기존 레시피 수정은 recipe_revision, 명시적 재고 구매·추가·수령·사용·소비·전량 사용·남은 양 정정은 inventory_change, 재고 질문·인사는 reply_only다. inventoryChanges에는 현재 사용자 발화에 실제로 언급된 식재료 변화만 넣는다. add=새로 확보, consume=썼음, set=현재 남은 총량 정정이다. 전부 사용은 all=true, quantity=null로 둔다. 수량·단위를 말하지 않았으면 null로 둔다. 기존 재고에 맞는 ingredientKey가 확실할 때만 정확히 복사한다. 요리를 했다는 이야기만으로 사용량을 추측하지 않는다. 재고 변경을 완료했다고 답하지 않는다. dishName에는 직접 요청한 음식 이름만 적고 없으면 null로 둔다. ingredientNames에는 사용자가 직접 언급한 식재료명만 넣는다. reply는 짧고 친절한 한국어로 쓴다.',
      input: classifierContext,
      text: {
        format: { type: 'json_schema', name: 'naengtalk_intent', strict: true, schema: classifierSchema },
        verbosity: 'low',
      },
      }));
    } catch (error) {
      recordOpenAiFailure(trace, 'luna', error);
      throw error;
    }
    recordOpenAiUsage(trace, 'luna', classifierResponse);
    const classifier = parseOutput(classifierResponse);
    trace.intent = typeof classifier.intent === 'string' ? classifier.intent : null;

    if (classifier.intent === 'reply_only') {
      return await respond(200, { reply: classifier.reply, recipe: null });
    }
    if (classifier.intent === 'inventory_change') {
      const proposed = sanitizeInventoryChangeIntent(
        input.message,
        classifier.inventoryChanges,
        Array.isArray(inventory) ? inventory as Array<{ ingredient_key: string; display_name: string; quantity: number; unit: string }> : [],
      );
      return await respond(200, { reply: proposed.reply, recipe: null, inventoryChanges: proposed.changes });
    }

    const dishName = typeof classifier.dishName === 'string'
      ? classifier.dishName.trim().slice(0, 100) : '';
    const lots = Array.isArray(inventory) ? inventory as RecipeLot[] : [];
    const classifierIngredients = Array.isArray(classifier.ingredientNames)
      ? classifier.ingredientNames.filter((item): item is string => typeof item === 'string')
      : [];
    const namedIngredients = [...new Set([...mentionedInventoryNames(input.message, lots),
      ...classifierIngredients])].slice(0, 10);
    const recipeLots = prioritizeRecipeInventory(lots as Array<RecipeLot & { use_by_at?: unknown }>);
    const recipeContext = conversationText(input, recipeLots);
    const searchTerms = inventorySearchTerms(recipeLots, namedIngredients);
    const publicMatches = candidates(await measureAiStage(trace, 'catalog', () => catalogRpc('search_recipe_candidates', {
      query_name: dishName,
      ingredient_names: searchTerms,
      source_kind: 'catalog',
    })));
    const sharedMatches = candidates(await measureAiStage(trace, 'catalog', () => catalogRpc('search_recipe_candidates', {
      query_name: dishName,
      ingredient_names: searchTerms,
      source_kind: 'shared',
    })));
    const rankedPublic = rankRecipeCandidates(dishName, searchTerms.length, publicMatches);
    const rankedShared = rankRecipeCandidates(dishName, searchTerms.length, sharedMatches);
    const zeroPurchasePublic = rankedPublic.find((item) => item.ingredient_count <= item.matched_count) ?? null;
    const zeroPurchaseShared = rankedShared.find((item) => item.ingredient_count <= item.matched_count) ?? null;
    const onePurchase = rankedPublic.find((item) => item.ingredient_count - item.matched_count === 1)
      ?? rankedShared.find((item) => item.ingredient_count - item.matched_count === 1)
      ?? null;
    const firstAttempt = {
      selected: zeroPurchasePublic ?? zeroPurchaseShared,
      purchaseLimit: 0,
    };
    let lastValidationFeedback: { missingNames: string[]; problem?: string } | null = null;
    const firstCandidate = firstAttempt.selected
      ? await measureAiStage(trace, 'catalog', () => catalogRpc('get_recipe_candidate_detail', {
          target_origin: firstAttempt.selected.origin,
          target_id: firstAttempt.selected.id,
        })) as Record<string, unknown>
      : null;
    trace.candidateOrigin = typeof firstCandidate?.origin === 'string' ? firstCandidate.origin : 'AI_GENERATED';
    try {
      const result = await generateRecipe(recipeContext, input.allergens, firstCandidate, recipeLots,
        firstAttempt.purchaseLimit, namedIngredients, trace, 'terraInitial');
      return await respond(200, result);
    } catch (error) {
      const code = (error as Error).message;
      if (code !== 'PURCHASE_LIMIT_EXCEEDED' && code !== 'RECIPE_NOT_ACTIONABLE'
        && code !== 'ALLERGEN_REJECTED' && code !== 'REQUESTED_INGREDIENT_MISSING'
        && code !== 'RECIPE_NOT_MEANINGFUL') throw error;
      trace.repairReason = code;
      lastValidationFeedback = code === 'RECIPE_NOT_ACTIONABLE'
        ? { missingNames: [], problem: '실행 가능한 요리 대신 추천 불가 문구를 반환함' }
        : code === 'ALLERGEN_REJECTED'
          ? { missingNames: [], problem: '등록된 알레르기 재료가 포함됨' }
          : code === 'REQUESTED_INGREDIENT_MISSING'
            ? { missingNames: (error as Error & { missingNames?: string[] }).missingNames ?? [],
                problem: '사용자가 직접 요청한 재료가 누락됨' }
            : code === 'RECIPE_NOT_MEANINGFUL'
              ? { missingNames: [], problem: '단순히 자르거나 소스를 곁들이는 수준으로 한 끼 요리가 아님' }
              : { missingNames: (error as Error & { missingNames?: string[] }).missingNames ?? [] };
    }
    if (lastValidationFeedback) {
      const alternateZeroPurchase = firstAttempt.selected === zeroPurchasePublic ? zeroPurchaseShared : null;
      const repairAttempt = firstAttempt.selected
        ? { selected: alternateZeroPurchase, purchaseLimit: 0 }
        : onePurchase
          ? { selected: onePurchase, purchaseLimit: 1 }
          : { selected: null, purchaseLimit: 0 };
      const repairCandidate = repairAttempt.selected
        ? await measureAiStage(trace, 'catalog', () => catalogRpc('get_recipe_candidate_detail', {
            target_origin: repairAttempt.selected.origin,
            target_id: repairAttempt.selected.id,
          })) as Record<string, unknown>
        : null;
      trace.candidateOrigin = typeof repairCandidate?.origin === 'string' ? repairCandidate.origin : 'AI_GENERATED';
      try {
        const focusedContext = conversationText(input, repairPantry(recipeLots, namedIngredients));
        const result = await generateRecipe(focusedContext, input.allergens, repairCandidate, recipeLots,
          repairAttempt.purchaseLimit, namedIngredients, trace, 'terraRepair', lastValidationFeedback);
        return await respond(200, result);
      } catch (error) {
        if ((error as Error).message !== 'PURCHASE_LIMIT_EXCEEDED'
          && (error as Error).message !== 'RECIPE_NOT_ACTIONABLE'
          && (error as Error).message !== 'REQUESTED_INGREDIENT_MISSING'
          && (error as Error).message !== 'RECIPE_NOT_MEANINGFUL') throw error;
      }
    }
    throw new Error('PURCHASE_LIMIT_EXCEEDED');
  } catch (error) {
    const code = (error as Error).message;
    if (code === 'INVALID_REQUEST' || error instanceof SyntaxError) {
      return await respond(400, { error: '메시지 형식을 확인해주세요.' }, 'INVALID_REQUEST');
    }
    if (code === 'OPENAI_NOT_CONFIGURED') {
      return await respond(503, { error: 'AI 연결 설정이 아직 완료되지 않았습니다.' }, code);
    }
    if (code === 'ALLERGEN_REJECTED') {
      return await respond(502, { error: '알레르기 안전 검사를 통과한 레시피를 만들지 못했습니다.' }, code);
    }
    if (code === 'PURCHASE_LIMIT_EXCEEDED' || code === 'RECIPE_NOT_ACTIONABLE'
      || code === 'REQUESTED_INGREDIENT_MISSING' || code === 'RECIPE_NOT_MEANINGFUL') {
      return await respond(422, { error: '현재 재고로 만들 수 있는 레시피를 찾지 못했습니다. 재료나 요청을 바꿔 다시 시도해주세요.' }, code);
    }
    if (code === 'TimeoutError' || (error as Error).name === 'TimeoutError') {
      return await respond(504, { error: 'AI 응답 시간이 초과되었습니다.' }, 'TIMEOUT');
    }
    return await respond(502, { error: 'AI 응답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, code);
  }
});
