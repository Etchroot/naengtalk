// Manual production smoke. Creates an isolated anonymous guest and logs no credentials.
import { readFileSync } from 'node:fs';
import { createClient } from '../mobile/node_modules/@supabase/supabase-js/dist/index.mjs';
import { createGuestTools } from '../mobile/src/domain/seed.ts';

const settings = Object.fromEntries(readFileSync(new URL('../mobile/.env.local', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const client = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error: signInError } = await client.auth.signInAnonymously();
if (signInError) throw signInError;
const { error: bootstrapError } = await client.rpc('bootstrap_guest_inventory');
if (bootstrapError) throw bootstrapError;

for (const message of process.argv.slice(2).length ? process.argv.slice(2) : ['오늘 뭐 먹지?', '무랑 양배추로 요리해줘']) {
  const { data, error } = await client.functions.invoke('menu-chat', { body: {
    message, history: [], cookingTools: createGuestTools(), allergens: ['새우'],
  } });
  if (error) {
    const response = error.context instanceof Response ? error.context : null;
    const body = response ? await response.json().catch(() => ({})) : {};
    throw new Error(`${message}: HTTP ${response?.status ?? 'unknown'} ${body.error ?? 'unknown error'}`);
  }
  const recipe = data?.recipe;
  if (!recipe || !Array.isArray(recipe.ingredients)) throw new Error(`${message}: no recipe returned`);
  const purchases = recipe.ingredients.filter((ingredient) => ingredient.requiredPurchase).length;
  if (purchases > 1) throw new Error(`${message}: too many purchases (${purchases})`);
  const result = { message, title: recipe.title, purchases,
    ingredients: recipe.ingredients.map((ingredient) => ingredient.name),
    stepCount: recipe.steps?.length ?? 0 };
  console.log(JSON.stringify(result));
  if (/없음|불가|못함|불가능/.test(recipe.title) || result.stepCount === 0) {
    throw new Error(`${message}: unusable recipe response`);
  }
}
