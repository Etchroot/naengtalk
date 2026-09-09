import {
  assertAllergenSafe,
  classifierSchema,
  recipeResponseSchema,
  sanitizeRequest,
  type MenuChatRequest,
} from '../_shared/menu-chat-contract.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
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

async function openAiResponse(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_NOT_CONFIGURED');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(28_000),
    headers: { authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, store: false }),
  });
  if (!response.ok) throw new Error(`OPENAI_${response.status}`);
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

async function generateRecipe(context: string, allergens: string[], fallback = false): Promise<Record<string, unknown>> {
  const searchTool = fallback
    ? { type: 'web_search', search_context_size: 'low' }
    : { type: 'web_search', search_context_size: 'low', filters: { allowed_domains: ['10000recipe.com'] } };
  const response = await openAiResponse({
    model: 'gpt-5.6-terra',
    reasoning: { effort: 'low' },
    max_output_tokens: 1800,
    tools: [searchTool],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    instructions: `당신은 1인 가구용 냉장고 레시피 도우미 냉톡이다. 반드시 웹 검색으로 레시피 근거를 확인한다. ${fallback ? '만개의레시피에 적합한 근거가 없었다. YouTube와 신뢰할 수 있는 일반 웹 자료로 확장한다.' : '10000recipe.com의 만개의레시피를 우선 근거로 사용한다.'} 현재 재고를 최대한 쓰되 사용자가 원하는 메뉴를 우선한다. 필수 재료가 없으면 requiredPurchase=true로 표시하고 구매를 제안한다. 재고 재료의 ingredientKey, 실제 차감 가능한 수량과 단위만 정확히 복사한다. 등록 알레르기를 절대 포함하지 않는다. 위험 식재료의 충분한 가열과 위생 단계를 포함한다. 한국어로 답하고 출처 원문을 복제하지 않는다.`,
    input: context,
    text: {
      format: {
        type: 'json_schema',
        name: 'naengtalk_recipe_response',
        strict: true,
        schema: recipeResponseSchema,
      },
      verbosity: 'low',
    },
  });
  const result = parseOutput(response);
  assertAllergenSafe(result, allergens);
  const recipe = result.recipe as { sources?: unknown[] } | undefined;
  if (!recipe?.sources?.length) throw new Error('NO_RECIPE_SOURCE');
  return result;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'POST 요청만 지원합니다.' });

  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json(401, { error: '로그인이 필요합니다.' });

    const input = sanitizeRequest(await request.json());

    const userResponse = await supabaseRequest('/auth/v1/user', authorization);
    if (!userResponse.ok) return json(401, { error: '로그인이 만료되었습니다.' });
    const user = await userResponse.json() as { id?: string };
    if (!user.id) return json(401, { error: '로그인이 필요합니다.' });

    const rateResponse = await supabaseRequest('/rest/v1/rpc/consume_ai_request', authorization, {
      method: 'POST', body: JSON.stringify({ daily_limit: 30 }),
    });
    if (!rateResponse.ok) throw new Error('RATE_LIMIT_CHECK');
    if (await rateResponse.json() !== true) return json(429, { error: '오늘의 AI 사용 횟수를 모두 사용했습니다.' });

    const inventoryResponse = await supabaseRequest(
      '/rest/v1/inventory_lots?select=ingredient_key,display_name,quantity,unit,use_by_at,date_source&quantity=gt.0&order=use_by_at.asc',
      authorization,
    );
    if (!inventoryResponse.ok) throw new Error('INVENTORY_READ');
    const inventory = await inventoryResponse.json();
    const context = conversationText(input, inventory);

    const classifier = parseOutput(await openAiResponse({
      model: 'gpt-5.6-luna',
      reasoning: { effort: 'none' },
      max_output_tokens: 500,
      instructions: '당신은 냉톡의 대화 라우터다. 사용자가 메뉴 추천, 레시피, 무엇을 먹을지 묻거나 기존 레시피 수정을 원하면 recipe 또는 recipe_revision을 선택한다. 재고 질문이나 가벼운 인사는 reply_only다. reply는 짧고 친절한 한국어로 쓴다.',
      input: context,
      text: {
        format: { type: 'json_schema', name: 'naengtalk_intent', strict: true, schema: classifierSchema },
        verbosity: 'low',
      },
    }));

    if (classifier.intent === 'reply_only') {
      return json(200, { reply: classifier.reply, recipe: null });
    }

    try {
      return json(200, await generateRecipe(context, input.allergens));
    } catch (error) {
      if ((error as Error).message === 'ALLERGEN_REJECTED') throw error;
      return json(200, await generateRecipe(context, input.allergens, true));
    }
  } catch (error) {
    const code = (error as Error).message;
    if (code === 'INVALID_REQUEST' || error instanceof SyntaxError) {
      return json(400, { error: '메시지 형식을 확인해주세요.' });
    }
    if (code === 'OPENAI_NOT_CONFIGURED') {
      return json(503, { error: 'AI 연결 설정이 아직 완료되지 않았습니다.' });
    }
    if (code === 'ALLERGEN_REJECTED') {
      return json(502, { error: '알레르기 안전 검사를 통과한 레시피를 만들지 못했습니다.' });
    }
    if (code === 'TimeoutError' || (error as Error).name === 'TimeoutError') {
      return json(504, { error: 'AI 응답 시간이 초과되었습니다.' });
    }
    return json(502, { error: 'AI 응답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.' });
  }
});
