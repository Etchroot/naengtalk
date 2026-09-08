import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/202609080001_core_inventory.sql', import.meta.url),
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
