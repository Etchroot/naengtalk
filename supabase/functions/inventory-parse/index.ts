import {
  buildInventoryParseOpenAiRequest,
  sanitizeInventoryParseRequest,
} from '../_shared/inventory-parse-contract.ts';
import { resolveShelfLifeForOcr } from '../_shared/shelf-life-resolver.ts';

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

async function parseInventoryText(text: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_NOT_CONFIGURED');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(28_000),
    headers: { authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildInventoryParseOpenAiRequest(text)),
  });
  if (!response.ok) throw new Error(`OPENAI_${response.status}`);
  const parsed = JSON.parse(outputText(await response.json() as Record<string, unknown>));
  if (!parsed || typeof parsed !== 'object') throw new Error('OPENAI_INVALID_JSON');
  return parsed as Record<string, unknown>;
}

function applyProvidedDates(result: Record<string, unknown>, baseDate: string): Record<string, unknown> {
  const items = Array.isArray(result.items) ? result.items : [];
  return {
    ...result,
    items: items.map((value) => {
      if (!value || typeof value !== 'object') return value;
      const item = value as Record<string, unknown>;
      const providedUseBy = typeof item.providedUseBy === 'string' ? item.providedUseBy : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(providedUseBy) || providedUseBy < baseDate) return item;
      return {
        ...item,
        recommendedUseBy: providedUseBy,
        shelfLifeStatus: 'cached',
        needsReview: !item.quantity || !item.unit,
        internalNote: '사용자가 직접 입력한 소비기한을 적용했습니다.',
      };
    }),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'POST 요청만 지원합니다.' });

  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json(401, { error: '로그인이 필요합니다.' });
    const input = sanitizeInventoryParseRequest(await request.json());
    const userResponse = await supabaseRequest('/auth/v1/user', authorization);
    if (!userResponse.ok) return json(401, { error: '로그인이 만료되었습니다.' });

    const rateResponse = await supabaseRequest('/rest/v1/rpc/consume_feature_request', authorization, {
      method: 'POST',
      body: JSON.stringify({ feature_name: 'inventory_parse', daily_limit: 30 }),
    });
    if (!rateResponse.ok) throw new Error('RATE_LIMIT_CHECK');
    if (await rateResponse.json() !== true) {
      return json(429, { error: '오늘의 직접 입력 분석 횟수를 모두 사용했습니다.' });
    }

    const recognized = await parseInventoryText(input.text);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!supabaseUrl || !serviceRoleKey || !openAiKey) throw new Error('SERVER_CONFIG');
    const baseDate = new Date().toISOString().slice(0, 10);
    const enriched = await resolveShelfLifeForOcr(recognized, {
      supabaseUrl,
      serviceRoleKey,
      openAiKey,
      baseDate,
    });
    return json(200, applyProvidedDates(enriched, baseDate));
  } catch (error) {
    const code = (error as Error).message;
    if (code === 'INVALID_TEXT' || error instanceof SyntaxError) {
      return json(400, { error: '식품 이름과 수량을 입력해주세요.' });
    }
    if (code === 'OPENAI_NOT_CONFIGURED') return json(503, { error: 'AI 연결 설정이 아직 완료되지 않았습니다.' });
    if (code === 'TimeoutError' || (error as Error).name === 'TimeoutError') {
      return json(504, { error: '직접 입력 분석 시간이 초과되었습니다.' });
    }
    return json(502, { error: '입력한 식품을 분석하지 못했습니다. 잠시 후 다시 시도해주세요.' });
  }
});
