// One-off experiment: Terra without tools -> isolated anonymous inventory.
// Requires OPENAI_API_KEY in this process; never prints secrets or user IDs.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createClient } from '../mobile/node_modules/@supabase/supabase-js/dist/index.mjs';
import { normalizedIngredientKey } from '../mobile/src/domain/purchase-ocr.ts';

const samples = [
  { name: '딸기잼', quantity: 1, unit: '개', packageState: 'unopened', expectedStorage: 'room_temperature' },
  { name: '식빵', quantity: 1, unit: '개', packageState: 'unopened', expectedStorage: 'room_temperature' },
  { name: '감자', quantity: 500, unit: 'g', packageState: 'unpackaged', expectedStorage: 'room_temperature' },
  { name: '참치 통조림', quantity: 1, unit: '개', packageState: 'unopened', expectedStorage: 'room_temperature' },
  { name: '우유', quantity: 500, unit: 'ml', packageState: 'unopened', expectedStorage: 'refrigerated' },
  { name: '두부', quantity: 300, unit: 'g', packageState: 'unopened', expectedStorage: 'refrigerated' },
  { name: '달걀', quantity: 10, unit: '개', packageState: 'unopened', expectedStorage: 'refrigerated' },
  { name: '새송이버섯', quantity: 300, unit: 'g', packageState: 'unpackaged', expectedStorage: 'refrigerated' },
  { name: '냉동 닭다리살', quantity: 500, unit: 'g', packageState: 'unopened', expectedStorage: 'frozen' },
  { name: '냉동 만두', quantity: 1, unit: '개', packageState: 'unopened', expectedStorage: 'frozen' },
];

function publicSettings() {
  return Object.fromEntries(readFileSync(new URL('../mobile/.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}

function addDays(baseDate, days) {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function outputText(response) {
  return (response.output ?? []).filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? []).filter((part) => part.type === 'output_text')
    .map((part) => part.text).join('');
}

function validatedEstimates(raw) {
  const rows = raw?.estimates;
  if (!Array.isArray(rows) || rows.length !== samples.length) {
    throw new Error(`Terra returned ${Array.isArray(rows) ? rows.length : 0}/10 estimates; no DB write`);
  }
  const expected = new Map(samples.map((sample) => [sample.name, sample]));
  const seen = new Set();
  for (const row of rows) {
    const sample = expected.get(row?.name);
    if (!sample || seen.has(row.name)) throw new Error('Unexpected or duplicate estimate; no DB write');
    seen.add(row.name);
    if (!['room_temperature', 'refrigerated', 'frozen'].includes(row.storageMethod)
      || row.packageState !== sample.packageState
      || (row.durationDays !== null && (!Number.isInteger(row.durationDays)
        || row.durationDays < 1 || row.durationDays > 3650))) {
      throw new Error(`Invalid estimate for ${row.name}; no DB write`);
    }
  }
  return samples.map((sample) => rows.find((row) => row.name === sample.name));
}

const openAiKey = process.env.OPENAI_API_KEY;
if (!openAiKey) throw new Error('OPENAI_API_KEY is not set. No request or DB write was made.');
const settings = publicSettings();
if (!settings.EXPO_PUBLIC_SUPABASE_URL || !settings.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Public Supabase settings missing. No request or DB write was made.');
}

const started = performance.now();
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-5.6-terra',
    reasoning: { effort: 'low' },
    store: false,
    max_output_tokens: 4000,
    instructions: `웹 검색이나 외부 도구 없이 일반적인 식품 보관 지식만으로 권장 보관기간을 추정한다.
제품 포장에 인쇄된 소비기한을 안다고 가장하지 않는다. 구매일 기준의 보수적인 최소 일수를 durationDays에 적는다.
개봉하지 않은 가공식품과 포장되지 않은 농산물을 구분한다. 냉동으로 명시된 품목은 냉동 보관한다.
일반적인 기간조차 신뢰할 수 없으면 durationDays를 null로 둔다. 실제 표시일 확인이 필요한 이유는 basis에 적는다.
출처 URL이나 검색 결과를 지어내지 않는다. 입력의 이름과 packageState를 그대로 반환한다.`,
    input: JSON.stringify(samples.map(({ name, packageState }) => ({ name, packageState }))),
    text: { format: {
      type: 'json_schema', name: 'terra_only_shelf_life_trial', strict: true,
      schema: {
        type: 'object', additionalProperties: false, required: ['estimates'],
        properties: { estimates: {
          type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['name', 'storageMethod', 'packageState', 'durationDays', 'basis'],
            properties: {
              name: { type: 'string' },
              storageMethod: { type: 'string', enum: ['room_temperature', 'refrigerated', 'frozen'] },
              packageState: { type: 'string', enum: ['unopened', 'opened', 'unpackaged'] },
              durationDays: { type: ['integer', 'null'] },
              basis: { type: 'string' },
            },
          },
        } },
      },
    } },
  }),
  signal: AbortSignal.timeout(60_000),
});
const modelMs = Math.round(performance.now() - started);
if (!response.ok) throw new Error(`OpenAI status ${response.status}. No DB write was made.`);
const modelResponse = await response.json();
if (modelResponse.status !== 'completed') {
  throw new Error(`OpenAI response status ${modelResponse.status}. No DB write was made.`);
}
const estimates = validatedEstimates(JSON.parse(outputText(modelResponse)));
const today = new Date().toISOString().slice(0, 10);
const ready = estimates.filter((row) => row.durationDays !== null);
const client = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error: authError } = await client.auth.signInAnonymously();
if (authError) throw new Error(`Guest login failed: ${authError.message}. No DB write was made.`);
let saved = [];
if (ready.length) {
  const items = ready.map((row) => {
    const sample = samples.find((entry) => entry.name === row.name);
    return {
      ingredient_key: normalizedIngredientKey(row.name), display_name: row.name,
      quantity: sample.quantity, unit: sample.unit,
      use_by_at: addDays(today, row.durationDays), date_source: 'estimated',
      storage_method: row.storageMethod, import_resolution: 'auto',
      internal_note: 'Terra 단독 추정 실험. 웹 출처 없음. 실제 제품 표시일 확인 필요.',
    };
  });
  const { data: written, error: writeError } = await client.rpc('register_inventory_import', {
    request_key: `terra-only-trial-${crypto.randomUUID()}`, items,
  });
  if (writeError) throw new Error(`Guest inventory write failed: ${writeError.message}`);
  if (written?.status !== 'registered' || written?.count !== ready.length) {
    throw new Error('Guest inventory RPC did not confirm the expected insert count');
  }
  const { data: lots, error: readError } = await client.from('inventory_lots')
    .select('display_name,quantity,unit,use_by_at,date_source,storage_method,internal_note')
    .in('display_name', ready.map((row) => row.name));
  if (readError) throw new Error(`Guest inventory readback failed: ${readError.message}`);
  for (const item of items) {
    if (!lots.some((lot) => lot.display_name === item.display_name
      && Number(lot.quantity) === item.quantity && lot.unit === item.unit
      && lot.use_by_at === item.use_by_at && lot.date_source === item.date_source
      && lot.storage_method === item.storage_method)) {
      throw new Error(`Readback mismatch for ${item.display_name}`);
    }
  }
  saved = lots;
}

const usage = modelResponse.usage ?? {};
const inputTokens = usage.input_tokens ?? null;
const outputTokens = usage.output_tokens ?? null;
console.log(JSON.stringify({
  strategy: 'gpt-5.6-terra_without_tools',
  today, modelMs, totalMs: Math.round(performance.now() - started),
  usage: { inputTokens, outputTokens },
  estimatedModelCostUsd: inputTokens === null || outputTokens === null ? null
    : Number((inputTokens * 2 / 1_000_000 + outputTokens * 12 / 1_000_000).toFixed(6)),
  estimates: estimates.map((row) => ({ ...row,
    expectedStorage: samples.find((entry) => entry.name === row.name).expectedStorage,
    storageMatchesBenchmark: row.storageMethod
      === samples.find((entry) => entry.name === row.name).expectedStorage,
    suggestedUseBy: row.durationDays === null ? null : addDays(today, row.durationDays),
  })),
  savedCount: saved.length,
  saved,
  sharedShelfLifeRulesWritten: 0,
}, null, 2));
