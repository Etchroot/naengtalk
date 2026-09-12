import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !publicKey) throw new Error('Supabase public environment is required.');

const supabase = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const expectedKeys = [
  'doenjang',
  'egg',
  'green-onion',
  'kimchi',
  'oil',
  'onion',
  'pork',
  'potato',
  'soy',
  'tofu',
];

const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
if (authError || !authData.user) throw authError ?? new Error('Anonymous user was not created.');

const ownerId = authData.user.id;
const { error: bootstrapError } = await supabase.rpc('bootstrap_guest_inventory');
if (bootstrapError) throw bootstrapError;

const { error: insertError } = await supabase.from('inventory_lots').insert({
  owner_id: ownerId,
  ingredient_key: 'unexpected-test-item',
  display_name: '초기화 검증 임시 품목',
  quantity: 1,
  unit: '개',
  use_by_at: '2099-12-31',
  date_source: 'estimated',
});
if (insertError) throw insertError;

const { error: resetError } = await supabase.rpc('reset_guest_demo');
if (resetError) throw resetError;

const { data: rows, error: inventoryError } = await supabase
  .from('inventory_lots')
  .select('ingredient_key')
  .order('ingredient_key');
if (inventoryError) throw inventoryError;

assert.deepEqual(rows.map((row) => row.ingredient_key), expectedKeys);
console.log('Guest reset integration verified: isolated 10-item seed restored.');
