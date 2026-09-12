import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
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

test('remote apply sends bounded catalog batches in foreign-key order', async (context) => {
  const requests: Array<{
    path: string;
    body: Record<string, unknown>;
    apikey: string | undefined;
    authorization: string | undefined;
  }> = [];
  const serviceRoleKey = 'test-service-role-key';
  const remoteSummary = {
    recipes: 1684,
    ingredients: 18920,
    steps: 9542,
    ingredient_orphans: 0,
    step_orphans: 0,
    ingredient_duplicate_keys: 0,
    step_duplicate_keys: 0,
  };

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => {
      const bodyText = Buffer.concat(chunks).toString('utf8');
      const body = bodyText ? JSON.parse(bodyText) : {};
      requests.push({
        path: request.url ?? '',
        body,
        apikey: request.headers.apikey as string | undefined,
        authorization: request.headers.authorization,
      });
      response.setHeader('content-type', 'application/json');
      if (request.url?.endsWith('/verify_recipe_catalog')) {
        response.end(JSON.stringify(remoteSummary));
      } else {
        const rows = Array.isArray(body.rows) ? body.rows : [];
        response.end(JSON.stringify(rows.length));
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());
  const address = server.address() as AddressInfo;

  const childResult = await new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn(
      'python',
      [importScript, '--apply', '--data-dir', dataDirectory],
      {
        env: {
          ...process.env,
          SUPABASE_URL: `http://127.0.0.1:${address.port}`,
          SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
          CATALOG_IMPORT_ALLOW_LOOPBACK_HTTP: '1',
        },
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

  assert.equal(childResult.code, 0, childResult.stderr);
  assert.doesNotMatch(
    `${childResult.stdout}\n${childResult.stderr}`,
    new RegExp(serviceRoleKey),
  );

  const importRequests = requests.filter((request) =>
    request.path.endsWith('/import_recipe_catalog_batch'));
  assert.equal(importRequests.length, 62);
  assert.deepEqual(
    importRequests.map((request) => request.body.target_table),
    [
      ...Array(4).fill('recipes'),
      ...Array(38).fill('ingredients'),
      ...Array(20).fill('steps'),
    ],
  );
  for (const request of importRequests) {
    assert.ok(Array.isArray(request.body.rows));
    assert.ok((request.body.rows as unknown[]).length <= 500);
    assert.equal(request.apikey, serviceRoleKey);
    assert.equal(request.authorization, `Bearer ${serviceRoleKey}`);
  }

  assert.equal(requests.at(-1)?.path, '/rest/v1/rpc/verify_recipe_catalog');
  assert.deepEqual(JSON.parse(childResult.stdout), remoteSummary);
});
