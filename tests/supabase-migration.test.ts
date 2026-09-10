import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/202609080001_core_inventory.sql', import.meta.url),
  'utf8',
).toLowerCase();

const purchaseOcrRateLimitMigration = readFileSync(
  new URL('../supabase/migrations/202609090003_purchase_ocr_rate_limits.sql', import.meta.url),
  'utf8',
).toLowerCase();

const sharedShelfLifeMigration = readFileSync(
  new URL('../supabase/migrations/202609100001_shared_shelf_life.sql', import.meta.url),
  'utf8',
).toLowerCase();

test('public inventory tables use explicit least-privilege Data API grants', () => {
  assert.match(migration, /revoke all on table\s+public\.profiles[\s\S]*from anon, authenticated;/);
  assert.match(
    migration,
    /grant select, insert, update, delete on table[\s\S]*public\.completed_recipes[\s\S]*to authenticated;/,
  );
  assert.match(
    migration,
    /grant select, insert on table public\.inventory_events to authenticated;/,
  );
  assert.doesNotMatch(migration, /grant[\s\S]*on table[\s\S]*to anon;/);
});

test('purchase OCR rate limit is per-user, per-feature and callable only by authenticated users', () => {
  assert.match(purchaseOcrRateLimitMigration, /primary key \(owner_id, feature, usage_date\)/);
  assert.match(purchaseOcrRateLimitMigration, /owner_id = auth\.uid\(\)/);
  assert.match(purchaseOcrRateLimitMigration, /feature_name <> 'purchase_ocr'/);
  assert.match(purchaseOcrRateLimitMigration, /request_count < daily_limit/);
  assert.match(purchaseOcrRateLimitMigration, /revoke all on function public\.consume_feature_request\(text, integer\) from public, anon/);
  assert.match(purchaseOcrRateLimitMigration, /grant execute on function public\.consume_feature_request\(text, integer\) to authenticated/);
});

test('shared shelf-life rules are client read-only and uniquely keyed by storage context', () => {
  assert.match(sharedShelfLifeMigration, /unique\s*\(canonical_key, storage_method, package_state\)/);
  assert.match(sharedShelfLifeMigration, /grant select on table public\.shelf_life_rules to authenticated/);
  assert.doesNotMatch(sharedShelfLifeMigration, /grant[^;]*(insert|update|delete)[^;]*shelf_life_rules[^;]*authenticated/);
  assert.match(sharedShelfLifeMigration, /status = 'active'/);
});

test('inventory import RPC is owner-scoped, idempotent, and callable only after authentication', () => {
  assert.match(sharedShelfLifeMigration, /create or replace function public\.register_inventory_import\(request_key text, items jsonb\)/);
  assert.match(sharedShelfLifeMigration, /current_user_id uuid := auth\.uid\(\)/);
  assert.match(sharedShelfLifeMigration, /on conflict \(owner_id, idempotency_key\) do nothing/);
  assert.match(sharedShelfLifeMigration, /grant execute on function public\.register_inventory_import\(text,jsonb\) to authenticated/);
});
