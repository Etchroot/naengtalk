// Manual production smoke for ten non-personal sample foods. Never prints credentials or user IDs.
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createClient } from '../mobile/node_modules/@supabase/supabase-js/dist/index.mjs';
import { buildPurchaseReviewRows, toInventoryImportPayload, validatePurchaseReviewRows } from '../mobile/src/domain/purchase-review.ts';

const names = ['딸기잼', '식빵', '감자', '참치 통조림', '우유', '두부', '달걀', '새송이버섯', '냉동 닭다리살', '냉동 만두'];
const text = '딸기잼 1개, 식빵 1개, 감자 500g, 참치 통조림 1개, 우유 500ml, 두부 300g, 달걀 10개, 새송이버섯 300g, 냉동 닭다리살 500g, 냉동 만두 1개를 샀어.';
const settings = Object.fromEntries(readFileSync(new URL('../mobile/.env.local', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const client = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });

const started = performance.now();
const { error: authError } = await client.auth.signInAnonymously();
if (authError) throw new Error(`guest login failed: ${authError.message}`);

const keys = ['딸기잼', '식빵', '감자', '참치-통조림', '우유', '두부', '달걀', '새송이버섯', '닭다리살', '만두'];
const { data: before, error: beforeError } = await client.from('shelf_life_rules')
  .select('canonical_key,storage_method,package_state,duration_days,source_url')
  .in('canonical_key', keys).eq('status', 'active');
if (beforeError) throw new Error(`cache read failed: ${beforeError.message}`);

const parseStarted = performance.now();
const { data, error } = await client.functions.invoke('inventory-parse', { body: { text } });
const parseMs = Math.round(performance.now() - parseStarted);
if (error) {
  console.log(JSON.stringify({ stage: 'parse_failed', parseMs, error: error.message,
    response: data?.error ?? null, cacheBefore: before.length }, null, 2));
  process.exitCode = 1;
} else {
  const items = (Array.isArray(data?.items) ? data.items : []).filter((item) => item.isFood);
  const today = new Date().toISOString().slice(0, 10);
  const rows = buildPurchaseReviewRows([{ sourceId: 'ten-food-smoke', items }]);
  const valid = rows.filter((row) => validatePurchaseReviewRows([row], today).length === 0);
  const invalid = rows.filter((row) => validatePurchaseReviewRows([row], today).length !== 0);
  let registered = [];
  if (valid.length) {
    const payload = toInventoryImportPayload(valid, today);
    const { error: registerError } = await client.rpc('register_inventory_import', {
      request_key: `ten-food-smoke-${crypto.randomUUID()}`, items: payload,
    });
    if (registerError) throw new Error(`registration failed: ${registerError.message}`);
    const { data: lots, error: readError } = await client.from('inventory_lots')
      .select('display_name,quantity,unit,use_by_at,storage_method,date_source')
      .in('display_name', valid.map((row) => row.name));
    if (readError) throw new Error(`registered rows read failed: ${readError.message}`);
    registered = lots;
  }
  const { data: after, error: afterError } = await client.from('shelf_life_rules')
    .select('canonical_key,storage_method,package_state,duration_days,source_url')
    .in('canonical_key', keys).eq('status', 'active');
  if (afterError) throw new Error(`post-cache read failed: ${afterError.message}`);
  console.log(JSON.stringify({ stage: 'complete', requestedNames: names, parseMs,
    totalMs: Math.round(performance.now() - started),
    cacheBefore: before, cacheAfter: after,
    returned: items.map((item) => ({ productName: item.productName, name: item.foodName,
      category: item.category, storageMethod: item.storageMethod,
      packageState: item.packageState, recommendedUseBy: item.recommendedUseBy,
      shelfLifeStatus: item.shelfLifeStatus, quantity: item.quantity, unit: item.unit })),
    needingManualDateOrField: invalid.map((row) => row.name), registered }, null, 2));
}
