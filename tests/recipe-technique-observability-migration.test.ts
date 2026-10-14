import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL(
  '../supabase/migrations/202610130002_recipe_technique_observability.sql',
  import.meta.url,
);

test('technique observability migration adds bounded private trace columns', async () => {
  const migration = (await readFile(migrationPath, 'utf8')).toLowerCase();
  assert.match(migration, /alter table observability\.ai_request_traces[\s\S]*initial_candidate_origin text/);
  assert.match(migration, /initial_candidate_origin in \('mfds', 'mafra', 'shared_ai', 'ai_generated'\)/);
  assert.match(migration, /generation_path in \('public_technique', 'shared_technique', 'ai_only', 'ai_repair'\)/);
  assert.match(migration, /candidate_score_band in \('high', 'medium', 'low'\)/);
});

test('trace RPC explicitly allowlists keys and remains service-role only', async () => {
  const migration = (await readFile(migrationPath, 'utf8')).toLowerCase();
  assert.match(migration, /create or replace function public\.record_ai_request_trace\(trace jsonb\)/);
  assert.match(migration, /jsonb_object_keys\(trace\)/);
  for (const key of ['initial_candidate_origin', 'generation_path', 'candidate_score_band']) {
    assert.match(migration, new RegExp(`'${key}'`));
  }
  assert.match(migration, /insert into observability\.ai_request_traces[\s\S]*initial_candidate_origin[\s\S]*generation_path[\s\S]*candidate_score_band/);
  assert.match(migration, /revoke all on function public\.record_ai_request_trace\(jsonb\)[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.record_ai_request_trace\(jsonb\)[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete|all)[\s\S]*observability\.ai_request_traces/);
});
