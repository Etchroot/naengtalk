import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const demoAssetsSource = readFileSync(
  new URL('../mobile/src/features/purchase-demo-assets.ts', import.meta.url),
  'utf8',
);

const demoShelfLifeMigrationUrl = new URL(
  '../supabase/migrations/202609210002_demo_purchase_shelf_life.sql',
  import.meta.url,
);

test('guest purchase examples expose four numbered samples without R2', () => {
  assert.doesNotMatch(demoAssetsSource, /id:\s*'R2'/);
  assert.doesNotMatch(demoAssetsSource, /purchases\/r2\.jpg/);
  assert.deepEqual(
    [...demoAssetsSource.matchAll(/id:\s*'(R\d)'.*?label:\s*'([^']+)'/g)]
      .map((match) => ({ id: match[1], label: match[2] })),
    [
      { id: 'R1', label: '예시 1' },
      { id: 'R3', label: '예시 2' },
      { id: 'R4', label: '예시 3' },
      { id: 'R5', label: '예시 4' },
    ],
  );
});

test('demo-only foods have approved AI shelf-life rules', () => {
  assert.equal(existsSync(demoShelfLifeMigrationUrl), true, 'demo shelf-life migration must exist');
  const migration = readFileSync(demoShelfLifeMigrationUrl, 'utf8');
  for (const [key, days, storage, category] of [
    ['깻잎-무쌈', '30', 'refrigerated', 'prepared'],
    ['닭가슴살-치킨너겟', '30', 'frozen', 'frozen'],
    ['치킨너겟', '30', 'frozen', 'frozen'],
    ['카레', '365', 'room_temperature', 'pantry'],
    ['양배추-샐러드-소스', '180', 'room_temperature', 'pantry'],
  ]) {
    assert.match(
      migration,
      new RegExp(`\\('${key}','[^']+','${category}','${storage}','unopened',${days},'AI추정'`),
    );
  }
  assert.equal((migration.match(/'ai_estimated_approved'/g) ?? []).length, 5);
  assert.match(migration, /on conflict \(canonical_key, storage_method, package_state\)/);
});
