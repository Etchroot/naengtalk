import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationUrl = new URL(
  '../supabase/migrations/202609120003_public_recipe_catalog.sql',
  import.meta.url,
);
const claimsFixMigrationUrl = new URL(
  '../supabase/migrations/202609120004_fix_recipe_catalog_rpc_claims.sql',
  import.meta.url,
);

function readMigration(): string {
  try {
    return readFileSync(migrationUrl, 'utf8').toLowerCase();
  } catch {
    return '';
  }
}

const migration = readMigration();
const claimsFixMigration = (() => {
  try {
    return readFileSync(claimsFixMigrationUrl, 'utf8').toLowerCase();
  } catch {
    return '';
  }
})();

test('catalog tables stay isolated from the existing user recipe table', () => {
  assert.match(migration, /create schema if not exists recipe_catalog/);
  assert.match(migration, /create table recipe_catalog\.recipes/);
  assert.match(migration, /recipe_id text primary key/);
  assert.match(migration, /create table recipe_catalog\.ingredients/);
  assert.match(
    migration,
    /references recipe_catalog\.recipes\s*\(recipe_id\)\s*on delete cascade/,
  );
  assert.match(migration, /unique\s*\(recipe_id, ingredient_no\)/);
  assert.match(migration, /create table recipe_catalog\.steps/);
  assert.match(migration, /unique\s*\(recipe_id, step_no\)/);
  assert.doesNotMatch(migration, /alter table public\.recipes/);
});

test('catalog indexes support recipe details and structured ingredient matching', () => {
  assert.match(
    migration,
    /create index ingredients_recipe_id_idx[\s\S]*?on recipe_catalog\.ingredients\s*\(recipe_id\)/,
  );
  assert.match(
    migration,
    /create index ingredients_normalized_name_recipe_id_idx[\s\S]*?\(normalized_name, recipe_id\)/,
  );
  assert.match(
    migration,
    /create index ingredients_parent_ingredient_recipe_id_idx[\s\S]*?\(parent_ingredient, recipe_id\)[\s\S]*?where parent_ingredient is not null/,
  );
  assert.match(
    migration,
    /create index ingredients_search_key_recipe_id_idx[\s\S]*?\(search_key, recipe_id\)/,
  );
  assert.match(
    migration,
    /create index steps_recipe_id_idx[\s\S]*?on recipe_catalog\.steps\s*\(recipe_id\)/,
  );
  assert.match(
    migration,
    /create index recipes_name_idx[\s\S]*?on recipe_catalog\.recipes\s*\(name\)/,
  );
});

test('catalog import is bounded, static, and callable only by service role', () => {
  assert.match(
    migration,
    /create or replace function public\.import_recipe_catalog_batch\s*\(\s*target_table text,\s*rows jsonb\s*\)/,
  );
  assert.match(migration, /jsonb_array_length\(rows\) > 500/);
  assert.match(migration, /when 'recipes'/);
  assert.match(migration, /when 'ingredients'/);
  assert.match(migration, /when 'steps'/);
  assert.doesNotMatch(migration, /execute\s+format\s*\(/);
  assert.match(
    migration,
    /revoke all on function public\.import_recipe_catalog_batch\(text, jsonb\)\s*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.import_recipe_catalog_batch\(text, jsonb\)\s*to service_role/,
  );
});

test('catalog RPC authorization supports current PostgREST JWT claims', () => {
  assert.match(
    claimsFixMigration,
    /current_setting\('request\.jwt\.claims', true\)::jsonb\s*->>\s*'role'/,
  );
  assert.match(
    claimsFixMigration,
    /rename to import_recipe_catalog_batch_legacy/,
  );
  assert.match(
    claimsFixMigration,
    /rename to verify_recipe_catalog_legacy/,
  );
  assert.match(
    claimsFixMigration,
    /revoke all on function public\.import_recipe_catalog_batch_legacy\(text, jsonb\)[\s\S]*?from public, anon, authenticated, service_role/,
  );
});

test('catalog verification exposes counts only and stays service-role-only', () => {
  assert.match(
    migration,
    /create or replace function public\.verify_recipe_catalog\(\)/,
  );
  for (const key of [
    'recipes',
    'ingredients',
    'steps',
    'ingredient_orphans',
    'step_orphans',
    'ingredient_duplicate_keys',
    'step_duplicate_keys',
  ]) {
    assert.match(migration, new RegExp(`'${key}'`));
  }
  assert.match(
    migration,
    /revoke all on function public\.verify_recipe_catalog\(\)\s*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.verify_recipe_catalog\(\)\s*to service_role/,
  );
});
