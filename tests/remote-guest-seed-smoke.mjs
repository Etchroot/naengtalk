// Manual production smoke: creates one isolated anonymous guest, never logs credentials.
import { readFileSync } from 'node:fs';
import { createClient } from '../mobile/node_modules/@supabase/supabase-js/dist/index.mjs';
import { createGuestInventory } from '../mobile/src/domain/seed.ts';

const settings = Object.fromEntries(readFileSync(new URL('../mobile/.env.local', import.meta.url), 'utf8')
  .split(/\r?\n/).filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const client = createClient(settings.EXPO_PUBLIC_SUPABASE_URL, settings.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { error: signInError } = await client.auth.signInAnonymously();
if (signInError) throw signInError;
const { error: bootstrapError } = await client.rpc('bootstrap_guest_inventory');
if (bootstrapError) throw bootstrapError;

async function verifySeed(label) {
  const { data, error } = await client.from('inventory_lots')
    .select('ingredient_key,display_name,quantity,unit').gt('quantity', 0);
  if (error) throw error;
  if (data.length !== 30 || new Set(data.map((item) => item.display_name)).size !== 30) {
    throw new Error(`${label}: expected 30 distinct guest foods, got ${data.length}`);
  }
  for (const expected of createGuestInventory(new Date().toISOString().slice(0, 10))) {
    const actual = data.find((item) => item.display_name === expected.name);
    if (!actual || Number(actual.quantity) !== expected.quantity || actual.unit !== expected.unit) {
      throw new Error(`${label}: local and remote seed disagree for ${expected.name}`);
    }
  }
  for (const [name, unit] of [['간장', 'ml'], ['설탕', 'g'], ['소금', 'g'], ['된장', 'g'], ['고추장', 'g']]) {
    const row = data.find((item) => item.display_name === name);
    if (!row || Number(row.quantity) !== 500 || row.unit !== unit) {
      throw new Error(`${label}: wrong demo quantity for ${name}`);
    }
  }
}

await verifySeed('bootstrap');
const { error: resetError } = await client.rpc('reset_guest_demo');
if (resetError) throw resetError;
await verifySeed('reset');
console.log(JSON.stringify({ bootstrapFoods: 30, resetFoods: 30, basicSeasonings: '500g/ml' }));
