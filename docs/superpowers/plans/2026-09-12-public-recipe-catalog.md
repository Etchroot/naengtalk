# Public Recipe Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the three final MFDS/MAFRA recipe CSV files into an isolated private Supabase schema with repeatable import and verified row counts, without changing the Expo UI or current recipe runtime.

**Architecture:** Keep the existing user-owned `public.recipes` table intact and create `recipe_catalog.recipes`, `recipe_catalog.ingredients`, and `recipe_catalog.steps`. A tracked Python standard-library importer reads Git-ignored CSV files, validates them locally, and calls service-role-only static upsert RPCs in bounded batches before checking remote integrity through a summary-only RPC.

**Tech Stack:** Supabase PostgreSQL migrations and RPCs, Python 3 standard library, Node.js built-in test runner, existing linked Supabase CLI project.

**Spec:** `docs/superpowers/specs/2026-09-12-public-recipe-catalog-design.md`

## Global Constraints

- Do not modify, normalize, merge, split, or re-export any CSV value.
- Preserve `recipe_id` strings such as `MFDS_000028` and `MAFRA_000001` exactly.
- Keep root `/scripts/` and all three CSV files out of Git.
- Never place a service role key, database password, CSV content, or raw recipe row in tracked files or logs.
- Do not rename or alter the existing user-owned `public.recipes` table.
- Do not change Expo UI, Supabase client services, `menu-chat`, recipe search, or AI routing in this phase.
- Import order is `recipes`, `ingredients`, `steps`.
- Expected remote counts are exactly 1,684 recipes, 18,920 ingredients, and 9,542 steps.
- Recipe recommendation fallback is a later phase: catalog miss or low accuracy will use `gpt-5.6-terra` without web search.

---

### Task 1: Lock the private catalog migration contract

**Files:**
- Create: `tests/public-recipe-catalog-migration.test.ts`
- Create: `supabase/migrations/202609120003_public_recipe_catalog.sql`

**Interfaces:**
- Consumes: Existing `public.recipes` and cooking foreign keys defined by `202609080001_core_inventory.sql`.
- Produces: Private catalog tables and service-role-only `public.import_recipe_catalog_batch(text, jsonb)` and `public.verify_recipe_catalog()` RPCs.

- [ ] **Step 1: Write the failing migration contract test**

Create a Node test that reads the migration and asserts:

```ts
test('public recipe catalog is isolated from user recipes', () => {
  assert.match(sql, /create schema if not exists recipe_catalog/i);
  assert.match(sql, /create table recipe_catalog\.recipes/i);
  assert.match(sql, /recipe_id text primary key/i);
  assert.match(sql, /create table recipe_catalog\.ingredients/i);
  assert.match(sql, /references recipe_catalog\.recipes\(recipe_id\) on delete cascade/i);
  assert.match(sql, /unique \(recipe_id, ingredient_no\)/i);
  assert.match(sql, /create table recipe_catalog\.steps/i);
  assert.match(sql, /unique \(recipe_id, step_no\)/i);
  assert.doesNotMatch(sql, /alter table public\.recipes/i);
});
```

Add these concrete contract assertions:

```ts
assert.match(sql, /create index ingredients_recipe_id_idx[\s\S]*\(recipe_id\)/i);
assert.match(sql, /create index ingredients_normalized_name_recipe_id_idx[\s\S]*\(normalized_name, recipe_id\)/i);
assert.match(sql, /create index ingredients_parent_ingredient_recipe_id_idx[\s\S]*\(parent_ingredient, recipe_id\)[\s\S]*where parent_ingredient is not null/i);
assert.match(sql, /create index ingredients_search_key_recipe_id_idx[\s\S]*\(search_key, recipe_id\)/i);
assert.match(sql, /create index steps_recipe_id_idx[\s\S]*\(recipe_id\)/i);
assert.match(sql, /create index recipes_name_idx[\s\S]*\(name\)/i);
assert.match(sql, /jsonb_array_length\(rows\) > 500/i);
assert.match(sql, /when 'recipes'/i);
assert.match(sql, /when 'ingredients'/i);
assert.match(sql, /when 'steps'/i);
assert.match(sql, /revoke all on function public\.import_recipe_catalog_batch\(text, jsonb\) from public, anon, authenticated/i);
assert.match(sql, /grant execute on function public\.import_recipe_catalog_batch\(text, jsonb\) to service_role/i);
for (const key of ['recipes', 'ingredients', 'steps', 'ingredient_orphans', 'step_orphans', 'ingredient_duplicate_keys', 'step_duplicate_keys']) {
  assert.match(sql, new RegExp(`'${key}'`, 'i'));
}
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```powershell
node --test tests/public-recipe-catalog-migration.test.ts
```

Expected: FAIL because `202609120003_public_recipe_catalog.sql` does not exist.

- [ ] **Step 3: Implement the migration schema and constraints**

Create the schema and `recipe_catalog.recipes` with all 26 CSV columns and their nullable rules. Create `ingredients` and `steps` with identity PKs, cascading recipe FKs, and unique natural keys. Enable RLS without client policies, revoke schema/table access from `public`, `anon`, and `authenticated`, and create the indexes listed in the spec.

- [ ] **Step 4: Implement service-role-only batch upsert and verification RPCs**

Use fixed branches rather than interpolated SQL. The recipe branch can safely consume the table row type because it has no generated column:

```sql
case target_table
  when 'recipes' then
    insert into recipe_catalog.recipes
    select record.*
    from jsonb_populate_recordset(null::recipe_catalog.recipes, rows) as record
    on conflict (recipe_id) do update set
      source = excluded.source,
      source_name = excluded.source_name,
      source_dataset = excluded.source_dataset,
      source_recipe_id = excluded.source_recipe_id,
      name = excluded.name,
      summary = excluded.summary,
      cuisine = excluded.cuisine,
      category = excluded.category,
      cooking_method = excluded.cooking_method,
      cooking_time = excluded.cooking_time,
      servings = excluded.servings,
      difficulty = excluded.difficulty,
      estimated_cost = excluded.estimated_cost,
      main_ingredient_category = excluded.main_ingredient_category,
      weight_g = excluded.weight_g,
      kcal = excluded.kcal,
      carbs_g = excluded.carbs_g,
      protein_g = excluded.protein_g,
      fat_g = excluded.fat_g,
      sodium_mg = excluded.sodium_mg,
      hashtag = excluded.hashtag,
      image_main_url = excluded.image_main_url,
      image_cooking_url = excluded.image_cooking_url,
      tip = excluded.tip,
      ingredients_raw = excluded.ingredients_raw;
  when 'ingredients' then
    insert into recipe_catalog.ingredients (
      recipe_id, source, source_recipe_id, ingredient_no,
      ingredient_group, ingredient_raw, ingredient_name,
      normalized_name, parent_ingredient, amount, search_key, parse_status
    )
    select
      record.recipe_id, record.source, record.source_recipe_id,
      record.ingredient_no, record.ingredient_group, record.ingredient_raw,
      record.ingredient_name, record.normalized_name,
      record.parent_ingredient, record.amount, record.search_key,
      record.parse_status
    from jsonb_to_recordset(rows) as record(
      recipe_id text, source text, source_recipe_id text,
      ingredient_no integer, ingredient_group text, ingredient_raw text,
      ingredient_name text, normalized_name text, parent_ingredient text,
      amount text, search_key text, parse_status text
    )
    on conflict (recipe_id, ingredient_no) do update set
      source = excluded.source,
      source_recipe_id = excluded.source_recipe_id,
      ingredient_group = excluded.ingredient_group,
      ingredient_raw = excluded.ingredient_raw,
      ingredient_name = excluded.ingredient_name,
      normalized_name = excluded.normalized_name,
      parent_ingredient = excluded.parent_ingredient,
      amount = excluded.amount,
      search_key = excluded.search_key,
      parse_status = excluded.parse_status;
  when 'steps' then
    insert into recipe_catalog.steps (
      recipe_id, source, source_recipe_id, step_no, source_step_no,
      description, description_raw, image_url, step_tip
    )
    select
      record.recipe_id, record.source, record.source_recipe_id,
      record.step_no, record.source_step_no, record.description,
      record.description_raw, record.image_url, record.step_tip
    from jsonb_to_recordset(rows) as record(
      recipe_id text, source text, source_recipe_id text,
      step_no integer, source_step_no text, description text,
      description_raw text, image_url text, step_tip text
    )
    on conflict (recipe_id, step_no) do update set
      source = excluded.source,
      source_recipe_id = excluded.source_recipe_id,
      source_step_no = excluded.source_step_no,
      description = excluded.description,
      description_raw = excluded.description_raw,
      image_url = excluded.image_url,
      step_tip = excluded.step_tip;
  else
    raise exception 'unsupported catalog table';
end case;
```

Reject non-array, empty, or over-500-row payloads. Revoke execute from `public`, `anon`, and `authenticated`; grant only to `service_role`. The verification RPC returns only counts, orphan counts, and duplicate-key counts.

- [ ] **Step 5: Run the targeted test and verify GREEN**

Run `node --test tests/public-recipe-catalog-migration.test.ts`.

Expected: all catalog migration contract tests PASS.

- [ ] **Step 6: Commit the migration slice**

```powershell
git add tests/public-recipe-catalog-migration.test.ts supabase/migrations/202609120003_public_recipe_catalog.sql
git commit -m "feat: add private public recipe catalog schema"
```

### Task 2: Build a read-only local CSV validator first

**Files:**
- Create: `tests/public-recipe-catalog-import.test.ts`
- Create: `tools/import_recipe_catalog.py`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `scripts/data/FINAL_recipes.csv`, `FINAL_ingredients.csv`, and `FINAL_steps.csv`.
- Produces: `python tools/import_recipe_catalog.py --validate-only` JSON summary and a safe `--apply` entry point.

- [ ] **Step 1: Write failing tests for ignore and validation behavior**

```ts
test('catalog CSV files stay outside version control', () => {
  assert.match(readFileSync('.gitignore', 'utf8'), /^\/scripts\/$/m);
});

test('validator reports the immutable catalog snapshot counts', () => {
  const result = spawnSync('python', [
    'tools/import_recipe_catalog.py',
    '--validate-only',
    '--data-dir',
    'scripts/data',
  ], { encoding: 'utf8' });
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
});
```

Add a test that `--apply` without both server-only environment variables fails before making a request and never prints a secret value.

- [ ] **Step 2: Run the targeted test and verify RED**

Run `node --test tests/public-recipe-catalog-import.test.ts`.

Expected: FAIL because the root ignore rule and import tool do not exist.

- [ ] **Step 3: Add the root-only Git ignore rule**

Append exactly `/scripts/`. This leaves already tracked `mobile/scripts/` files tracked and ignores only the root data workspace.

- [ ] **Step 4: Implement exact-header and row validation**

The Python tool must:

- resolve the default data directory as `<repo>/scripts/data`;
- compare each `csv.DictReader.fieldnames` list with a hard-coded ordered header list;
- require the exact expected row counts;
- validate `recipe_id` with `^(MFDS|MAFRA)_\d{6}$`;
- detect duplicate recipe IDs and duplicate child natural keys;
- detect child IDs absent from the recipe set;
- parse non-empty numeric fields with `decimal.Decimal` and order columns with `int`;
- map empty strings to `None` only when building the RPC JSON payload;
- omit all recipe text and row contents from stdout and errors.

The summary must report exact counts, zero orphans, zero duplicates, and `recipes_without_ingredients: 1`.

- [ ] **Step 5: Implement explicit safe CLI modes**

Use a mutually exclusive `argparse` group requiring one of `--validate-only` or `--apply`. For `--apply`, require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; do not accept `EXPO_PUBLIC_SUPABASE_ANON_KEY` as an import credential.

- [ ] **Step 6: Run the targeted test and verify GREEN**

Run `node --test tests/public-recipe-catalog-import.test.ts`.

Expected: all import validation and secret-boundary tests PASS.

- [ ] **Step 7: Commit the validator slice**

```powershell
git add .gitignore tests/public-recipe-catalog-import.test.ts tools/import_recipe_catalog.py
git commit -m "feat: validate public recipe catalog imports"
```

### Task 3: Add bounded remote batch import behavior

**Files:**
- Modify: `tests/public-recipe-catalog-import.test.ts`
- Modify: `tools/import_recipe_catalog.py`

**Interfaces:**
- Consumes: Validated row dictionaries and `public.import_recipe_catalog_batch(target_table, rows)`.
- Produces: Ordered, at-most-500-row HTTPS RPC calls followed by `public.verify_recipe_catalog()`.

- [ ] **Step 1: Write a failing HTTP contract test**

Start a local Node HTTP server in the test, launch the Python CLI with `--apply`, point `SUPABASE_URL` at that server, and assert the observed requests are all recipe batches, then all ingredient batches, then all step batches, and finally one verification call. Set the test secret to `test-service-role-key`; assert every batch has at most 500 rows, `apikey` equals that value, `Authorization` equals `Bearer test-service-role-key`, and stdout does not contain that value.

- [ ] **Step 2: Run the targeted HTTP test and verify RED**

Run `node --test tests/public-recipe-catalog-import.test.ts`.

Expected: FAIL because `--apply` does not issue the ordered RPC calls yet.

- [ ] **Step 3: Implement the minimal RPC client and batch loop**

Use `urllib.request.Request` with JSON bodies containing `target_table` and `rows`. Send batches in the fixed tuple `("recipes", "ingredients", "steps")`, use a 60-second timeout, and stop immediately on an HTTP or JSON failure. Errors may include the table and batch number but not response bodies that could contain source rows.

- [ ] **Step 4: Compare remote verification with the expected summary**

After import, call `verify_recipe_catalog` and fail unless counts are exact and all orphan/duplicate counters are zero. Print only the safe validation summary.

- [ ] **Step 5: Run the targeted test and verify GREEN**

Run `node --test tests/public-recipe-catalog-import.test.ts`.

Expected: HTTP order, batch limit, verification, and no-secret assertions PASS.

- [ ] **Step 6: Commit the remote import slice**

```powershell
git add tests/public-recipe-catalog-import.test.ts tools/import_recipe_catalog.py
git commit -m "feat: import public recipe catalog in batches"
```

### Task 4: Verify the complete local implementation

**Files:**
- Modify: `docs/TRD.md`
- Modify: `docs/PRODUCT_DECISIONS.md`
- Modify: `TODO.md`
- Modify: `HUMAN-IN-THE-ROOF.md`

**Interfaces:**
- Consumes: Completed migration and importer.
- Produces: Evidence that the catalog work does not regress the existing app and documentation reflects the actual state.

- [ ] **Step 1: Run local CSV validation**

Run `python tools/import_recipe_catalog.py --validate-only`.

Expected: exit 0 with exact counts, zero orphans, zero duplicates, and `recipes_without_ingredients: 1`.

- [ ] **Step 2: Run all repository tests**

Run `npm test`.

Expected: all existing and catalog tests PASS with zero failures.

- [ ] **Step 3: Run migration lint when available**

Run `npx supabase db lint --linked --level warning`.

Expected: exit 0 with no migration error that blocks deployment. If this command is unavailable in the installed CLI, record that exact limitation and use `db push --dry-run` plus contract tests.

- [ ] **Step 4: Update implementation records**

Record the actual migration, import tool, local counts, remaining service-key action, and unchanged UI/runtime scope. Do not mark remote import complete before the remote verification RPC returns exact counts.

- [ ] **Step 5: Commit local verification documentation**

```powershell
git add docs/TRD.md docs/PRODUCT_DECISIONS.md TODO.md HUMAN-IN-THE-ROOF.md
git commit -m "docs: record public recipe catalog import"
```

### Task 5: Apply and verify the catalog in the linked Supabase project

**Files:**
- No tracked source changes expected.
- Runtime input: local process environment only.

**Interfaces:**
- Consumes: Linked Supabase project, migration, local CSVs, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: Exact remote catalog counts and zero orphan/duplicate counters.

- [ ] **Step 1: Confirm migration scope with a dry run**

Run `npx supabase db push --linked --dry-run`.

Expected: only `202609120003_public_recipe_catalog.sql` is pending.

- [ ] **Step 2: Apply the migration**

Run `npx supabase db push --linked`.

Expected: migration applies successfully without altering `public.recipes`.

- [ ] **Step 3: Inject server-only credentials into the current process**

The user sets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the local terminal or another ignored local secret store. Do not paste the service role key into chat, tracked `.env` files, command history shown in logs, or Expo public variables.

- [ ] **Step 4: Run the one-time import**

Run `python tools/import_recipe_catalog.py --apply`.

Expected: recipes import first, ingredients second, steps third, then remote verification succeeds.

- [ ] **Step 5: Re-run the same import to verify idempotence**

Run `python tools/import_recipe_catalog.py --apply` again.

Expected: exact counts remain and no natural-key duplicate is created.

- [ ] **Step 6: Re-run the full verification suite**

```powershell
npm test
python tools/import_recipe_catalog.py --validate-only
git diff --check
git status --short
```

Expected: all tests pass, local counts remain exact, no whitespace errors exist, and `/scripts/` no longer appears as untracked. Existing user-owned `.vs/` remains untouched.

- [ ] **Step 7: Update and commit final status only after remote evidence**

Change the catalog row in `TODO.md` from 진행 중 to 완료 and append the verified remote counts to `HUMAN-IN-THE-ROOF.md` or `docs/TRD.md` without including source rows or credentials.

```powershell
git add TODO.md HUMAN-IN-THE-ROOF.md docs/TRD.md
git commit -m "docs: verify deployed public recipe catalog"
```
