import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const importScript = fileURLToPath(
  new URL('../tools/import_recipe_catalog.py', import.meta.url),
);
const dataDirectory = fileURLToPath(new URL('../scripts/data/', import.meta.url));

test('root recipe data workspace stays outside version control', () => {
  const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(gitignore, /^\/scripts\/$/m);
});

test('validator reports the immutable catalog snapshot counts', () => {
  const result = spawnSync(
    'python',
    [importScript, '--validate-only', '--data-dir', dataDirectory],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary.counts, {
    recipes: 1684,
    ingredients: 18920,
    steps: 9542,
  });
  assert.deepEqual(summary.orphans, { ingredients: 0, steps: 0 });
  assert.deepEqual(summary.duplicates, {
    recipes: 0,
    ingredients: 0,
    steps: 0,
  });
  assert.equal(summary.recipes_without_ingredients, 1);
});

test('remote apply refuses public client credentials and never prints secrets', () => {
  const sentinelSecret = 'must-not-appear-in-output';
  const env = {
    ...process.env,
    SUPABASE_URL: 'https://example.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: sentinelSecret,
  };
  delete env.SUPABASE_SERVICE_ROLE_KEY;

  const result = spawnSync(
    'python',
    [importScript, '--apply', '--data-dir', dataDirectory],
    { encoding: 'utf8', env },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(sentinelSecret));
});
