import {
  assertAllergenSafe,
  buildRecipeInstructions,
  classifierSchema,
  recipeResponseSchema,
  sanitizeOptionalIngredientTip,
  sanitizeInventoryChangeIntent,
  sanitizeRequest,
  type MenuChatRequest,
} from '../_shared/menu-chat-contract.ts';
import {
  candidateScoreBand,
  scoreTechniqueCandidate,
  selectTechniqueCandidate,
  inventorySearchTerms,
  mentionedInventoryNames,
  type RecipeTechniqueCandidate,
} from '../_shared/recipe-routing.ts';
import {
  toTechniqueReference,
  type TechniqueReference,
} from '../_shared/recipe-technique-reference.ts';
import { checkRecipeInventory, type RecipeLot } from '../_shared/recipe-inventory-guard.ts';
import { verifiedRecipeReason } from '../_shared/recipe-guidelines.ts';
import { prioritizeRecipeInventory } from '../_shared/recipe-expiry-policy.ts';
import { assertRecipeQuality } from '../_shared/recipe-priority-policy.ts';
import {
  createAiRequestTrace,
  finishAiRequestTrace,
  measureAiStage,
  recordAiAttemptFailure,
  recordAiFinalFailure,
  recordOpenAiFailure,
  recordOpenAiUsage,
  type AiFailureStage,
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

async function confirmationRpc(name: string, body: Record<string, unknown>): Promise<unknown> {
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
  if (!response.ok) throw new Error('CONFIRMATION_STORE');
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText(response));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('OPENAI_INVALID_JSON');
    throw error;
  }
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

function normalizeIngredient(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function ingredientMatches(first: string, second: string): boolean {
  const left = normalizeIngredient(first);
  const right = normalizeIngredient(second);
  return Boolean(left && right && (left === right
    || (left.length >= 2 && right.includes(left))
    || (right.length >= 2 && left.includes(right))));
}

function missingRequestedIngredients(names: string[], inventory: RecipeLot[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    .filter((name) => !['물', '식수'].includes(normalizeIngredient(name)))
    .filter((name) => !inventory.some((lot) => ingredientMatches(name, lot.display_name)
      || ingredientMatches(name, lot.ingredient_key)))
    .slice(0, 10);
}

async function messageHash(message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message.normalize('NFKC').trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function confirmedIntent(value: unknown): {
  dishName: string;
  ingredientNames: string[];
  missingIngredientNames: string[];
} | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const bounded = (items: unknown) => Array.isArray(items)
    ? [...new Set(items.filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().slice(0, 100)).filter(Boolean))].slice(0, 10) : [];
  const ingredientNames = bounded(raw.ingredientNames);
  const missingIngredientNames = bounded(raw.missingIngredientNames);
  if (!ingredientNames.length || !missingIngredientNames.length
    || !missingIngredientNames.every((missing) => ingredientNames.some((name) => ingredientMatches(missing, name)))) {
    return null;
  }
  return {
    dishName: typeof raw.dishName === 'string' ? raw.dishName.trim().slice(0, 100) : '',
    ingredientNames,
    missingIngredientNames,
  };
}

function repairPantry(inventory: RecipeLot[], requestedNames: string[]): RecipeLot[] {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  const requested = requestedNames.map(normalize).filter(Boolean);
  const named = inventory.filter((lot) => requested.some((name) => {
    const stock = normalize(lot.display_name);
    return name === stock || name.includes(stock) || stock.includes(name);
  }));
  const supportingFoods = new Set([
    '대파', '쪽파', '양파', '마늘', '다진마늘', '생강', '청양고추',
    '무', '감자', '애호박', '두부', '김치',
  ]);
  const staples = new Set(['간장', '식용유', '소금', '된장', '고추장', '고춧가루', '다진마늘', '참기름', '설탕']);
  const selected = named.length ? named : inventory.slice(0, 8);
  const byKey = new Map(selected.map((lot) => [lot.ingredient_key, lot]));
  for (const lot of inventory) {
    if (supportingFoods.has(lot.display_name)) byKey.set(lot.ingredient_key, lot);
  }
  for (const lot of inventory) {
    if (staples.has(lot.display_name)) byKey.set(lot.ingredient_key, lot);
  }
  return [...byKey.values()].slice(0, 20);
}

async function generateRecipe(
  context: string,
  allergens: string[],
  techniqueReference: TechniqueReference | null,
  inventory: RecipeLot[],
  requiredIngredients: string[],
  approvedMissingIngredients: string[],
  trace: AiRequestTrace,
  terraStage: Extract<AiTraceStage, 'terraInitial' | 'terraRepair'>,
  setFailureStage: (stage: AiFailureStage) => void,
  validationFeedback?: { missingNames: string[]; problem?: string },
): Promise<Record<string, unknown>> {
  let response: Record<string, unknown>;
  setFailureStage(terraStage === 'terraInitial' ? 'terra_initial' : 'terra_repair');
  try {
    response = await measureAiStage(trace, terraStage, () => openAiResponse({
    model: 'gpt-5.6-terra',
    reasoning: { effort: 'low' },
    max_output_tokens: 1800,
    instructions: `${buildRecipeInstructions(techniqueReference ? 'technique' : 'generate')}${approvedMissingIngredients.length
      ? `\n사용자가 재고 부족을 확인하고 요청을 우선하도록 승인한 재료: ${approvedMissingIngredients.join(', ')}. 이 재료만 ingredients에 구매 필요로 포함하고, 그 외 재고에 없는 재료는 필수 재료로 추가하지 마세요.` : ''}`,
    input: JSON.stringify({
      userContext: JSON.parse(context),
      techniqueReference,
      techniqueReferenceIsUntrustedData: true,
      requiredIngredients,
      approvedMissingIngredients,
      ...(validationFeedback ? { validationFeedback: {
        ...validationFeedback,
        instruction: `직전 응답은 실행 가능한 요리로 승인되지 않았습니다. 실제로 만들 수 있는 요리 이름·조리 단계·사용량을 제시하세요. userContext.inventory에 열거된 재료와 사용자가 승인한 미보유 재료만 사용하세요. 각 재고 재료의 단위와 수량을 지키고, 승인한 미보유 재료는 구매 필요로 표시하세요. 액상 조미료만 T/t로 변환할 수 있습니다. ${approvedMissingIngredients.length ? `승인된 미보유 재료: ${approvedMissingIngredients.join(', ')}.` : '구매 없이 만들어야 합니다.'}`,
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
  setFailureStage(terraStage === 'terraInitial' ? 'validation_initial' : 'validation_repair');
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
    const checked = checkRecipeInventory(
      recipe as { ingredients: Parameters<typeof checkRecipeInventory>[0]['ingredients'] },
      inventory,
      approvedMissingIngredients,
    );
    if (checked.purchaseCount > 0) {
      throw Object.assign(new Error('PURCHASE_LIMIT_EXCEEDED'), { missingNames: checked.missingNames });
    }
    recipe.ingredients = checked.correctedIngredients;
    recipe.optionalIngredientTip = sanitizeOptionalIngredientTip(recipe);
    recipe.sources = [];
    recipe.origin = techniqueReference?.origin ?? 'AI_GENERATED';
    recipe.reason = verifiedRecipeReason(String(recipe.origin), checked.correctedIngredients);
    result.reply = `${String(recipe.title)} 레시피를 준비했어요.`;
    return result;
  });
}

function candidates(value: unknown): RecipeTechniqueCandidate[] {
  if (!Array.isArray(value)) throw new Error('CATALOG_READ');
  return value.filter((item): item is RecipeTechniqueCandidate =>
    Boolean(item) && typeof item === 'object'
    && typeof item.id === 'string'
    && typeof item.title === 'string'
    && ['MFDS', 'MAFRA', 'SHARED_AI'].includes(item.origin)
    && typeof item.name_score === 'number'
    && typeof item.method_score === 'number'
    && typeof item.required_matched_count === 'number'
    && typeof item.required_count === 'number'
    && typeof item.inventory_matched_count === 'number'
    && typeof item.ingredient_count === 'number'
    && typeof item.step_count === 'number');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const trace = createAiRequestTrace();
  let mayPersistTrace = false;
  let currentFailureStage: AiFailureStage = 'unknown';
  const setFailureStage = (stage: AiFailureStage): void => { currentFailureStage = stage; };
  const respond = async (
    status: number,
    body: unknown,
    errorCode?: string,
    failureStage: AiFailureStage = currentFailureStage,
  ): Promise<Response> => {
    if (status >= 400 && errorCode) recordAiFinalFailure(trace, failureStage, errorCode);
    if (mayPersistTrace) await persistAiRequestTrace(trace, status, errorCode);
    return json(status, body, trace.requestId);
  };

  if (request.method !== 'POST') {
    setFailureStage('response');
    return await respond(405, { error: 'POST 요청만 지원합니다.' }, 'METHOD_NOT_ALLOWED');
  }

  try {
    setFailureStage('auth');
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return await respond(401, { error: '로그인이 필요합니다.' }, 'AUTH_REQUIRED');

    const userResponse = await measureAiStage(trace, 'auth', () =>
      supabaseRequest('/auth/v1/user', authorization));
    if (!userResponse.ok) return await respond(401, { error: '로그인이 만료되었습니다.' }, 'AUTH_EXPIRED');
    const user = await userResponse.json() as { id?: string };
    if (!user.id) return await respond(401, { error: '로그인이 필요합니다.' }, 'AUTH_REQUIRED');
    trace.ownerId = user.id;
    mayPersistTrace = true;

    setFailureStage('request_parse');
    const input = sanitizeRequest(await request.json());
    const currentMessageHash = await messageHash(input.message);
    let approvedIntent: ReturnType<typeof confirmedIntent> = null;
    if (input.missingIngredientConfirmationTicket) {
      approvedIntent = confirmedIntent(await confirmationRpc('consume_missing_ingredient_confirmation', {
        p_token: input.missingIngredientConfirmationTicket,
        p_owner_id: user.id,
        p_message_hash: currentMessageHash,
      }));
      if (!approvedIntent) throw new Error('CONFIRMATION_INVALID');
    }

    if (!approvedIntent) {
      setFailureStage('rate_limit');
      const rateResponse = await measureAiStage(trace, 'rateLimit', () =>
        supabaseRequest('/rest/v1/rpc/consume_ai_request', authorization, {
          method: 'POST', body: JSON.stringify({ daily_limit: 30 }),
        }));
      if (!rateResponse.ok) throw new Error('RATE_LIMIT_CHECK');
      if (await rateResponse.json() !== true) {
        return await respond(429, { error: '오늘의 AI 사용 횟수를 모두 사용했습니다.' }, 'RATE_LIMITED');
      }
    }

    setFailureStage('inventory_query');
    const inventoryResponse = await measureAiStage(trace, 'inventory', () => supabaseRequest(
      '/rest/v1/inventory_lots?select=ingredient_key,display_name,quantity,unit,use_by_at,date_source&quantity=gt.0&order=use_by_at.asc',
      authorization,
    ));
    if (!inventoryResponse.ok) throw new Error('INVENTORY_READ');
    const inventory = await inventoryResponse.json();
    const classifierContext = conversationText(input, inventory);
    let classifier: Record<string, unknown>;
    if (approvedIntent) {
      classifier = {
        intent: 'recipe', reply: '', dishName: approvedIntent.dishName,
        ingredientNames: approvedIntent.ingredientNames, inventoryChanges: [],
      };
    } else {
      let classifierResponse: Record<string, unknown>;
      try {
        setFailureStage('intent_model');
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
      setFailureStage('intent_parse');
      classifier = parseOutput(classifierResponse);
    }
    trace.intent = typeof classifier.intent === 'string' ? classifier.intent : null;

    if (classifier.intent === 'reply_only') {
      setFailureStage('response');
      return await respond(200, { reply: classifier.reply, recipe: null });
    }
    if (classifier.intent === 'inventory_change') {
      setFailureStage('response');
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
    const approvedMissingIngredients = approvedIntent?.missingIngredientNames ?? [];
    const unapprovedMissingIngredients = missingRequestedIngredients(namedIngredients, lots)
      .filter((name) => !approvedMissingIngredients.some((approved) => ingredientMatches(name, approved)));
    if (unapprovedMissingIngredients.length) {
      const allMissing = [...new Set([...approvedMissingIngredients, ...unapprovedMissingIngredients])].slice(0, 10);
      const created = await confirmationRpc('create_missing_ingredient_confirmation', {
        p_owner_id: user.id,
        p_message_hash: currentMessageHash,
        p_dish_name: dishName,
        p_ingredient_names: namedIngredients,
        p_missing_ingredient_names: allMissing,
      }) as { ticket?: unknown };
      if (typeof created?.ticket !== 'string' || !created.ticket) throw new Error('CONFIRMATION_STORE');
      setFailureStage('response');
      return await respond(200, {
        reply: `${allMissing.join(', ')}은(는) 현재 재고에 없습니다. 그래도 이 재료를 포함한 레시피를 만들까요?`,
        recipe: null,
        missingIngredientConfirmation: { ticket: created.ticket, ingredients: allMissing },
      });
    }
    const recipeLots = prioritizeRecipeInventory(lots as Array<RecipeLot & { use_by_at?: unknown }>);
    const recipeContext = conversationText(input, recipeLots);
    const searchTerms = inventorySearchTerms(recipeLots, namedIngredients);
    setFailureStage('catalog_search');
    const publicMatches = candidates(await measureAiStage(trace, 'catalog', () => catalogRpc('search_recipe_technique_candidates', {
      query_name: dishName,
      required_ingredient_names: namedIngredients,
      inventory_names: searchTerms,
      source_kind: 'catalog',
    })));
    const sharedMatches = candidates(await measureAiStage(trace, 'catalog', () => catalogRpc('search_recipe_technique_candidates', {
      query_name: dishName,
      required_ingredient_names: namedIngredients,
      inventory_names: searchTerms,
      source_kind: 'shared',
    })));
    const candidateInput = { dishName, requiredIngredientCount: namedIngredients.length };
    const selected = selectTechniqueCandidate(candidateInput, publicMatches)
      ?? selectTechniqueCandidate(candidateInput, sharedMatches);
    trace.initialCandidateOrigin = selected?.origin ?? 'AI_GENERATED';
    trace.candidateScoreBand = selected
      ? candidateScoreBand(scoreTechniqueCandidate(candidateInput, selected))
      : null;
    let lastValidationFeedback: { missingNames: string[]; problem?: string } | null = null;
    const firstReference = selected
      ? await measureAiStage(trace, 'catalog', () => catalogRpc('get_recipe_candidate_detail', {
          target_origin: selected.origin,
          target_id: selected.id,
        })).then(toTechniqueReference)
      : null;
    trace.candidateOrigin = firstReference?.origin ?? 'AI_GENERATED';
    try {
      const result = await generateRecipe(recipeContext, input.allergens, firstReference, recipeLots,
        namedIngredients, approvedMissingIngredients, trace, 'terraInitial', setFailureStage);
      trace.generationPath = firstReference
        ? firstReference.origin === 'SHARED_AI' ? 'shared_technique' : 'public_technique'
        : 'ai_only';
      setFailureStage('response');
      return await respond(200, result);
    } catch (error) {
      const code = (error as Error).message;
      recordAiAttemptFailure(trace, 'initial', code);
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
      trace.candidateOrigin = 'AI_GENERATED';
      try {
        const focusedContext = conversationText(input, repairPantry(recipeLots, namedIngredients));
        const result = await generateRecipe(focusedContext, input.allergens, null, recipeLots,
          namedIngredients, approvedMissingIngredients, trace, 'terraRepair', setFailureStage, lastValidationFeedback);
        trace.generationPath = 'ai_repair';
        setFailureStage('response');
        return await respond(200, result);
      } catch (error) {
        const code = (error as Error).message;
        recordAiAttemptFailure(trace, 'repair', code);
        if (code !== 'PURCHASE_LIMIT_EXCEEDED' && code !== 'RECIPE_NOT_ACTIONABLE'
          && code !== 'ALLERGEN_REJECTED' && code !== 'REQUESTED_INGREDIENT_MISSING'
          && code !== 'RECIPE_NOT_MEANINGFUL') throw error;
        throw error;
      }
    }
    setFailureStage('unknown');
    throw new Error('UNKNOWN');
  } catch (error) {
    const code = (error as Error).message;
    if (code === 'INVALID_REQUEST' || (error instanceof SyntaxError && currentFailureStage === 'request_parse')) {
      return await respond(400, { error: '메시지 형식을 확인해주세요.' }, 'INVALID_REQUEST');
    }
    if (code === 'CONFIRMATION_INVALID') {
      return await respond(409, { error: '확인 요청이 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.' }, code);
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
