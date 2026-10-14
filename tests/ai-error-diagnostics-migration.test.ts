import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = (() => {
  try {
    return readFileSync(new URL(
      '../supabase/migrations/202610110002_ai_error_diagnostics.sql',
      import.meta.url,
    ), 'utf8').toLowerCase();
  } catch {
    return '';
  }
})();

const previousMigration = readFileSync(new URL(
  '../supabase/migrations/202610110001_ai_request_observability.sql',
  import.meta.url,
), 'utf8').toLowerCase();

test('diagnostic migration adds bounded failure columns and the exact stage whitelist', () => {
  for (const field of [
    'initial_failure_code', 'repair_failure_code', 'final_failure_code', 'failure_stage',
  ]) {
    assert.match(migration, new RegExp(`add column ${field}`));
  }
  assert.match(migration, /length\(initial_failure_code\) <= 64/);
  assert.match(migration, /length\(repair_failure_code\) <= 64/);
  assert.match(migration, /length\(final_failure_code\) <= 64/);
  const expectedStages = [
    'auth', 'request_parse', 'rate_limit', 'inventory_query', 'intent_model',
    'intent_parse', 'catalog_search', 'terra_initial', 'validation_initial',
    'terra_repair', 'validation_repair', 'response', 'unknown',
  ];
  const stageCheck = migration.match(/failure_stage is null\s+or failure_stage in \(([^)]+)\)/)?.[1] ?? '';
  assert.deepEqual([...stageCheck.matchAll(/'([^']+)'/g)].map((match) => match[1]), expectedStages);
  const rpcStageCheck = migration.match(/trace ->> 'failure_stage'\) not in \(([^)]+)\)/)?.[1] ?? '';
  assert.deepEqual([...rpcStageCheck.matchAll(/'([^']+)'/g)].map((match) => match[1]), expectedStages);
});

test('replacement trace RPC validates and inserts all diagnostics without weakening safeguards', () => {
  assert.match(migration, /create or replace function public\.record_ai_request_trace\(trace jsonb\)/);
  assert.match(migration, /request_role <> 'service_role'/);
  assert.match(migration, /octet_length\(trace::text\) > 4096/);
  assert.match(migration, /trace \?\| array\['message', 'history', 'inventory', 'recipe', 'prompt', 'input', 'output'\]/);
  for (const field of [
    'initial_failure_code', 'repair_failure_code', 'final_failure_code', 'failure_stage',
  ]) {
    assert.match(migration, new RegExp(`trace ->> '${field}'`));
  }
  assert.match(migration, /jsonb_array_length\(coalesce\(trace -> 'openai_request_ids', '\[\]'::jsonb\)\) > 3/);
  assert.match(migration, /initial_failure_code'\) !~ '\^\[a-z\]\[a-z0-9_\]\{0,63\}\$'/);
  assert.match(migration, /repair_failure_code'\) !~ '\^\[a-z\]\[a-z0-9_\]\{0,63\}\$'/);
  assert.match(migration, /final_failure_code'\) !~ '\^\[a-z\]\[a-z0-9_\]\{0,63\}\$'/);
  assert.doesNotMatch(migration, /rename to record_ai_request_trace_v1|record_ai_request_trace_v1|update observability\.ai_request_traces/);
  assert.match(migration, /insert into observability\.ai_request_traces \([\s\S]*initial_failure_code[\s\S]*repair_failure_code[\s\S]*final_failure_code[\s\S]*failure_stage[\s\S]*\) values \([\s\S]*trace_initial_failure_code[\s\S]*trace_repair_failure_code[\s\S]*trace_final_failure_code[\s\S]*trace_failure_stage/);
  assert.match(migration, /on conflict \(request_id\) do nothing/);
  assert.match(previousMigration, /trace_status >= 400[\s\S]*interval '90 days'/);
  assert.match(migration, /trace_status >= 400 or trace_repair_reason is not null or trace_total_ms >= 15000[\s\S]*interval '90 days'/);
  assert.match(migration, /pg_try_advisory_xact_lock/);
  assert.match(migration, /percentile_cont\(0\.5\)/);
  assert.match(migration, /percentile_cont\(0\.95\)/);
  assert.match(migration, /delete from observability\.ai_request_traces[\s\S]*retain_until < now\(\)/);
  assert.match(migration, /grant execute on function public\.record_ai_request_trace\(jsonb\)\s+to service_role/);
  assert.match(migration, /revoke all on function public\.record_ai_request_trace\(jsonb\)[\s\S]*from public, anon, authenticated/);
});
