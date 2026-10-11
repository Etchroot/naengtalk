import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = (() => {
  try {
    return readFileSync(new URL(
      '../supabase/migrations/202610110001_ai_request_observability.sql',
      import.meta.url,
    ), 'utf8').toLowerCase();
  } catch {
    return '';
  }
})();

test('AI traces live in a private schema with no client table privileges', () => {
  assert.match(migration, /create schema if not exists observability/);
  assert.match(migration, /create table observability\.ai_request_traces/);
  assert.match(migration, /create table observability\.ai_request_daily_metrics/);
  assert.match(migration, /revoke all on schema observability from public, anon, authenticated/);
  assert.match(migration, /revoke all on all tables in schema observability from public, anon, authenticated/);
  assert.doesNotMatch(migration, /\b(?:message|history|inventory|recipe|prompt)_?(?:text|json|body|content)?\b\s+(?:text|jsonb)/);
});

test('trace rows are bounded summaries with ordinary and diagnostic retention', () => {
  assert.match(migration, /terra_call_count smallint[^,]+check\s*\(terra_call_count between 0 and 2\)/s);
  assert.match(migration, /total_ms integer[^,]+check\s*\(total_ms between 0 and 120000\)/s);
  assert.match(migration, /retain_until timestamptz not null/);
  assert.match(migration, /total_ms >= 15000[\s\S]*?interval '90 days'/);
  assert.match(migration, /interval '30 days'/);
  assert.match(migration, /length\(coalesce\(trace ->> 'error_code', ''\)\) > 64/);
  assert.match(migration, /jsonb_array_length\(coalesce\(trace -> 'openai_request_ids', '\[\]'::jsonb\)\) > 3/);
});

test('one service-role RPC inserts traces and performs bounded daily maintenance', () => {
  assert.match(migration, /create or replace function public\.record_ai_request_trace\(trace jsonb\)/);
  assert.match(migration, /request_role <> 'service_role'/);
  assert.match(migration, /insert into observability\.ai_request_traces/);
  assert.match(migration, /pg_try_advisory_xact_lock/);
  assert.match(migration, /percentile_cont\(0\.5\)/);
  assert.match(migration, /percentile_cont\(0\.95\)/);
  assert.match(migration, /delete from observability\.ai_request_traces[\s\S]*?retain_until < now\(\)/);
  assert.match(migration, /grant execute on function public\.record_ai_request_trace\(jsonb\)\s+to service_role/);
  assert.match(migration, /revoke all on function public\.record_ai_request_trace\(jsonb\)[\s\S]*?from public, anon, authenticated/);
});

test('daily metrics retain support-useful latency, error, repair, call and token aggregates', () => {
  for (const field of [
    'request_count', 'success_count', 'error_count', 'repair_count', 'slow_count',
    'error_rate', 'repair_rate',
    'average_total_ms', 'p50_total_ms', 'p95_total_ms', 'luna_call_count',
    'terra_call_count', 'input_tokens', 'output_tokens',
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
});
