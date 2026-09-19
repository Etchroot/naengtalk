import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = (() => {
  try {
    return readFileSync(new URL('../supabase/migrations/202609130001_recipe_search_sharing.sql', import.meta.url), 'utf8').toLowerCase();
  } catch {
    return '';
  }
})();

test('shared recipes are independent snapshots, never cascaded from private recipes', () => {
  assert.match(migration, /create table recipe_catalog\.shared_recipes/);
  assert.match(migration, /origin_recipe_id uuid not null unique/);
  assert.doesNotMatch(migration, /origin_recipe_id[^,]+references public\.recipes/);
  assert.match(migration, /alter table recipe_catalog\.shared_recipes enable row level security/);
  assert.match(migration, /revoke all on table recipe_catalog\.shared_recipes\s+from public, anon, authenticated/);
});

test('catalog search uses structured ingredients and is service-role only', () => {
  assert.match(migration, /create function public\.search_recipe_candidates/);
  assert.match(migration, /normalized_name/);
  assert.match(migration, /parent_ingredient/);
  assert.match(migration, /search_key/);
  assert.doesNotMatch(migration, /\bingredients_raw\b/);
  assert.match(migration, /grant execute on function public\.search_recipe_candidates\(text, text\[\], text\)\s+to service_role/);
});

test('publication requires completed ownership and AI origin', () => {
  assert.match(migration, /create function public\.share_completed_ai_recipe/);
  assert.match(migration, /from public\.completed_recipes/);
  assert.match(migration, /owner_id = auth\.uid\(\)/);
  assert.match(migration, /'ai_generated'/);
});

test('conditional sharing stays within the completion transaction', () => {
  assert.match(migration, /create function public\.complete_recipe_cooking_shared/);
  assert.match(migration, /public\.complete_recipe_cooking\(/);
  assert.match(migration, /public\.share_completed_ai_recipe\(/);
});
