// Manual smoke test. Creates isolated anonymous guests and prints no credentials.
import { readFileSync } from 'node:fs';
import { createClient } from '../mobile/node_modules/@supabase/supabase-js/dist/index.mjs';

const settings = Object.fromEntries(readFileSync(new URL('../mobile/.env.local', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const client = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error: signInError } = await client.auth.signInAnonymously();
if (signInError) throw new Error(`guest sign-in: ${signInError.message}`);
const { error: bootstrapError } = await client.rpc('bootstrap_guest_inventory');
if (bootstrapError) throw bootstrapError;
const getPork = async () => {
  const { data, error } = await client.from('inventory_lots').select('quantity')
    .eq('ingredient_key', 'pork').gt('quantity', 0);
  if (error) throw error;
  return data.reduce((sum, row) => sum + Number(row.quantity), 0);
};
const before = await getPork();
const { data: proposal, error: proposalError } = await client.functions.invoke('menu-chat', {
  body: { message: '돼지고기 앞다리살 400g 썼어', history: [], cookingTools: [], allergens: [] },
});
if (proposalError) throw new Error(`chat: ${proposalError.message}`);
if (proposal.inventoryChanges?.[0]?.action !== 'consume') throw new Error('chat did not propose consumption');
if (await getPork() !== before) throw new Error('chat mutated inventory before approval');
const key = `chat-smoke-${crypto.randomUUID()}`;
const change = { action: 'consume', ingredient_key: 'pork', display_name: '돼지고기 앞다리살',
  quantity: before + 100, unit: 'g', use_by_at: null };
const { data: overdraw, error: overdrawError } = await client.rpc('apply_chat_inventory_change', {
  request_key: key, changes: [change],
});
if (overdrawError) throw overdrawError;
if (overdraw.status !== 'needs_confirmation' || Number(overdraw.available) !== before) {
  throw new Error('overdraw did not request confirmation');
}
if (await getPork() !== before) throw new Error('overdraw partially mutated inventory');
const { data: applied, error: applyError } = await client.rpc('apply_chat_inventory_change', {
  request_key: key, changes: [{ ...change, quantity: before }],
});
if (applyError) throw applyError;
if (applied.status !== 'applied' || await getPork() !== 0) throw new Error('approval did not consume stock');
const { data: replay, error: replayError } = await client.rpc('apply_chat_inventory_change', {
  request_key: key, changes: [{ ...change, quantity: before }],
});
if (replayError || replay.status !== 'already_applied' || await getPork() !== 0) {
  throw new Error('replay changed inventory');
}
const name = `검증감자${crypto.randomUUID().slice(0, 6)}`;
const newKey = `ocr-${name}`;
const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const { data: mixed, error: mixedError } = await client.rpc('apply_chat_inventory_change', {
  request_key: `chat-smoke-${crypto.randomUUID()}`,
  changes: [
    { action: 'add', ingredient_key: newKey, display_name: name, quantity: 3, unit: '개', use_by_at: date,
      storage_method: 'frozen' },
    { action: 'consume', ingredient_key: newKey, display_name: name, quantity: 1, unit: '개', use_by_at: null },
  ],
});
if (mixedError || mixed.status !== 'applied') throw mixedError ?? new Error('mixed command failed');
const { data: mixedRows, error: mixedReadError } = await client.from('inventory_lots').select('quantity,storage_method')
  .eq('ingredient_key', newKey).gt('quantity', 0);
if (mixedReadError || mixedRows.reduce((sum, row) => sum + Number(row.quantity), 0) !== 2
  || mixedRows.some((row) => row.storage_method !== 'frozen')) {
  throw new Error('mixed command result incorrect');
}
const other = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error: otherSignInError } = await other.auth.signInAnonymously();
if (otherSignInError) throw otherSignInError;
const { error: otherBootstrapError } = await other.rpc('bootstrap_guest_inventory');
if (otherBootstrapError) throw otherBootstrapError;
const { data: otherPork, error: otherReadError } = await other.from('inventory_lots')
  .select('quantity').eq('ingredient_key', 'pork').gt('quantity', 0);
if (otherReadError || otherPork.reduce((sum, row) => sum + Number(row.quantity), 0) !== before) {
  throw new Error('independent guest inventory changed');
}
const { error: lotAddError } = await client.rpc('apply_chat_inventory_change', {
  request_key: `chat-smoke-${crypto.randomUUID()}`,
  changes: [
    { action: 'add', ingredient_key: 'pork', display_name: '돼지고기 앞다리살', quantity: 100,
      unit: 'g', use_by_at: date },
    { action: 'add', ingredient_key: 'pork', display_name: '돼지고기 앞다리살', quantity: 200,
      unit: 'g', use_by_at: date },
  ],
});
if (lotAddError) throw lotAddError;
const { data: cooked, error: cookingError } = await client.rpc('complete_recipe_cooking_shared', {
  recipe_title: '재고 묶음 검증', recipe_content: { origin: 'AI_GENERATED' },
  usage_lines: [{ ingredient_key: 'pork', quantity: 250, unit: 'g' }],
  request_key: `cook-smoke-${crypto.randomUUID()}`, share_after_completion: false,
});
if (cookingError || cooked.status !== 'completed' || await getPork() !== 50) {
  throw cookingError ?? new Error('cooking did not consume across multiple lots');
}
console.log(JSON.stringify({ proposalWithoutWrite: true, overdrawWithoutWrite: true,
  approvedConsumed: true, replayIgnored: true, mixedAddConsume: true, frozenStoragePreserved: true,
  otherGuestIsolated: true, cookingAcrossLots: true }));
