// Manual smoke test only. Uses local public Supabase client settings and prints no credentials.
// --share creates an anonymous guest and publishes one AI-generated test recipe to the shared catalog.
import { readFileSync } from 'node:fs';
import { createClient } from '../mobile/node_modules/@supabase/supabase-js/dist/index.mjs';

const settings = Object.fromEntries(readFileSync(new URL('../mobile/.env.local', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const client = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: signInError } = await client.auth.signInAnonymously();
if (signInError) throw new Error(`guest sign-in: ${signInError.message}`);
const { error: bootstrapError } = await client.rpc('bootstrap_guest_inventory');
if (bootstrapError) throw new Error(`guest bootstrap: ${bootstrapError.message}`);
if (process.argv.includes('--security')) {
  const { error: searchError } = await client.rpc('search_recipe_candidates', {
    query_name: '계란말이', ingredient_names: ['계란'], source_kind: 'catalog',
  });
  if (!searchError) throw new Error('public client accessed private catalog search');
  const { error: prematureShareError } = await client.rpc('share_completed_ai_recipe', {
    target_recipe_id: crypto.randomUUID(),
  });
  if (!prematureShareError) throw new Error('uncompleted recipe was shareable');
  const { error: wrongOriginError } = await client.rpc('complete_recipe_cooking_shared', {
    recipe_title: '검증용', recipe_content: { origin: 'MFDS' },
    usage_lines: [{ ingredient_key: 'kimchi', quantity: 1, unit: 'g' }],
    request_key: `security-${crypto.randomUUID()}`, share_after_completion: true,
  });
  if (!wrongOriginError) throw new Error('non-AI recipe was shareable');
  console.log(JSON.stringify({ privateSearchDenied: true, prematureShareDenied: true, wrongOriginDenied: true }));
  process.exit(0);
}
const { data, error } = await client.functions.invoke('menu-chat', {
  body: {
    message: process.argv.includes('--share')
      ? '감자된장달걀팬전이라는 새로운 요리를 만들어줘'
      : process.argv[2] || '계란말이를 만들어줘',
    history: [], cookingTools: ['프라이팬'], allergens: ['새우'],
  },
});
if (error) throw new Error(`menu-chat: ${error.message}; ${JSON.stringify(data)}`);
const purchases = data.recipe?.ingredients?.filter((item) => item.requiredPurchase).map((item) => item.name) ?? [];
if (purchases.length > 1) throw new Error(`recipe exceeded the one-purchase limit: ${purchases.join(', ')}`);
console.log(JSON.stringify({ reply: data.reply, title: data.recipe?.title, origin: data.recipe?.origin,
  ingredients: data.recipe?.ingredients?.length, purchases }));

if (process.argv.includes('--share')) {
  if (data.recipe?.origin !== 'AI_GENERATED') throw new Error('expected AI-generated recipe');
  const used = data.recipe.ingredients.find((item) => item.inInventory && item.ingredientKey && item.unit);
  if (!used) throw new Error(`no matching pantry ingredient to verify cooking: ${JSON.stringify(data.recipe.ingredients.map(({ name, unit, inInventory }) => ({ name, unit, inInventory })))}`);
  const usageUnit = used.unit === 'T' || used.unit === 't' ? 'ml' : used.unit;
  const { data: completed, error: completeError } = await client.rpc('complete_recipe_cooking_shared', {
    recipe_title: data.recipe.title,
    recipe_content: data.recipe,
    usage_lines: [{ ingredient_key: used.ingredientKey, quantity: 1, unit: usageUnit }],
    request_key: `smoke-${crypto.randomUUID()}`,
    share_after_completion: true,
  });
  if (completeError) throw new Error(`complete and share: ${completeError.message}`);
  if (completed.status !== 'completed' || !completed.shared_recipe_id) throw new Error('completion or sharing missing');
  const otherGuest = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otherSignInError } = await otherGuest.auth.signInAnonymously();
  if (otherSignInError) throw new Error(`second guest sign-in: ${otherSignInError.message}`);
  const { error: otherBootstrapError } = await otherGuest.rpc('bootstrap_guest_inventory');
  if (otherBootstrapError) throw new Error(`second guest bootstrap: ${otherBootstrapError.message}`);
  const { data: sharedResult, error: sharedError } = await otherGuest.functions.invoke('menu-chat', {
    body: { message: '감자된장달걀팬전을 만들어줘', history: [], cookingTools: ['프라이팬'], allergens: ['새우'] },
  });
  if (sharedError) throw new Error(`shared recommendation: ${sharedError.message}`);
  console.log(JSON.stringify({ completed: completed.status, shared: Boolean(completed.shared_recipe_id), secondGuestOrigin: sharedResult.recipe?.origin }));
  if (sharedResult.recipe?.origin !== 'SHARED_AI') throw new Error('shared recipe was not selected second');
}
