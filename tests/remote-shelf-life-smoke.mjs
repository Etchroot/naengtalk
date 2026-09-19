// Manual remote smoke: an isolated guest, no credentials or personal data printed.
import { readFileSync } from 'node:fs';
import { createClient } from '../mobile/node_modules/@supabase/supabase-js/dist/index.mjs';

const settings = Object.fromEntries(readFileSync(new URL('../mobile/.env.local', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const client = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error: authError } = await client.auth.signInAnonymously();
if (authError) throw authError;
const { data, error } = await client.functions.invoke('inventory-parse', {
  body: { text: process.argv.find((arg, index) => index >= 2 && !arg.startsWith('--'))
    || '냉동 고등어 300g을 샀고 냉장 고등어 300g도 샀어.' },
});
if (error) throw new Error(`inventory-parse: ${error.message}; ${JSON.stringify(data)}`);
const foods = data.items.filter((item) => item.isFood && item.foodName.includes('고등어'));
const storage = foods.map((item) => item.storageMethod).sort();
if (!process.argv.find((arg, index) => index >= 2 && !arg.startsWith('--'))
  && (storage.length !== 2 || storage[0] !== 'frozen' || storage[1] !== 'refrigerated')) {
  throw new Error(`storage methods were merged: ${JSON.stringify(storage)}`);
}
console.log(JSON.stringify(data.items.filter((item) => item.isFood).map((item) => ({ name: item.foodName,
  storageMethod: item.storageMethod, hasDate: Boolean(item.recommendedUseBy),
  status: item.shelfLifeStatus }))));
if (process.argv.includes('--register')) {
  const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const items = foods.map((item) => ({ ingredient_key: 'ocr-고등어', display_name: '고등어',
    quantity: item.quantity, unit: item.unit, use_by_at: item.recommendedUseBy ?? date,
    date_source: item.recommendedUseBy ? 'estimated' : 'user_override',
    storage_method: item.storageMethod, import_resolution: 'user_confirmed', internal_note: null }));
  const { error: registerError } = await client.rpc('register_inventory_import', {
    request_key: `storage-smoke-${crypto.randomUUID()}`, items,
  });
  if (registerError) throw registerError;
  const { data: lots, error: readError } = await client.from('inventory_lots')
    .select('storage_method').eq('ingredient_key', 'ocr-고등어');
  if (readError) throw readError;
  const actual = lots.map((lot) => lot.storage_method).sort();
  if (actual.length !== 2 || actual[0] !== 'frozen' || actual[1] !== 'refrigerated') {
    throw new Error(`storage was not persisted separately: ${JSON.stringify(actual)}`);
  }
  console.log(JSON.stringify({ registeredStorageMethods: actual }));
}
