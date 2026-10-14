import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = (() => {
  try {
    return readFileSync(new URL(
      '../supabase/migrations/202610130003_missing_ingredient_confirmations.sql',
      import.meta.url,
    ), 'utf8').toLowerCase();
  } catch {
    return '';
  }
})();

test('missing ingredient confirmations are private, expiring, and single-use', () => {
  assert.match(migration, /create table private\.missing_ingredient_confirmations/);
  assert.match(migration, /expires_at timestamptz not null/);
  assert.match(migration, /consumed_at timestamptz/);
  assert.match(migration, /create function public\.create_missing_ingredient_confirmation/);
  assert.match(migration, /create function public\.consume_missing_ingredient_confirmation/);
  assert.match(migration, /for update/);
  assert.match(migration, /consumed_at is null/);
  assert.match(migration, /expires_at > now\(\)/);
});

test('confirmation RPCs are service-role-only and payloads are bounded', () => {
  assert.match(migration, /service_role/);
  assert.match(migration, /array_length\(p_ingredient_names, 1\), 0\) > 10/);
  assert.match(migration, /length\(p_message_hash\) <> 64/);
  assert.match(migration, /revoke all on function public\.create_missing_ingredient_confirmation[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.consume_missing_ingredient_confirmation[\s\S]*from public, anon, authenticated/);
});
