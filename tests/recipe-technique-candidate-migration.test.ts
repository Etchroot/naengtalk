import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = (() => {
  try {
    return readFileSync(new URL(
      '../supabase/migrations/202610130001_recipe_technique_candidates.sql',
      import.meta.url,
    ), 'utf8').toLowerCase();
  } catch {
    return '';
  }
})();

test('technique search separates requested foods from pantry overlap', () => {
  assert.match(migration, /create function public\.search_recipe_technique_candidates\(/);
  assert.match(migration, /required_ingredient_names text\[\]/);
  assert.match(migration, /inventory_names text\[\]/);
  assert.match(migration, /required_matched_count/);
  assert.match(migration, /inventory_matched_count/);
  assert.match(migration, /step_count/);
  assert.match(migration, /'cookingmethod', recipe\.cooking_method/);
  assert.match(migration, /'tip', recipe\.tip/);
});

test('technique search and detail stay service-role-only', () => {
  assert.match(migration, /revoke all on function public\.search_recipe_technique_candidates\([\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.search_recipe_technique_candidates\([\s\S]*to service_role/);
  assert.match(migration, /create or replace function public\.get_recipe_candidate_detail/);
  assert.match(migration, /revoke all on function public\.get_recipe_candidate_detail\(text, text\)[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_recipe_candidate_detail\(text, text\)[\s\S]*to service_role/);
});

test('technique search validates bounded inputs and structured catalog fields', () => {
  assert.match(migration, /array_length\(required_ingredient_names, 1\), 0\) > 10/);
  assert.match(migration, /array_length\(inventory_names, 1\), 0\) > 20/);
  assert.match(migration, /ingredient\.normalized_name/);
  assert.match(migration, /ingredient\.parent_ingredient/);
  assert.match(migration, /ingredient\.search_key/);
  assert.match(migration, /limit 20/);
});
