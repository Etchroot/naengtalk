# Public Recipe Technique Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use MFDS·MAFRA and shared recipes as bounded cooking-technique references even when their full ingredient lists are not in stock, while ensuring the final recipe uses only requested ingredients, owned inventory, and optional water.

**Architecture:** A new service-role RPC returns technique candidates with separate requested-ingredient and pantry overlap metrics. Deterministic TypeScript selects one eligible public candidate, then shared candidate, converts only that detail into a bounded `TechniqueReference`, and gives it to one Terra generation call; the existing inventory and safety guards remain the final authority, and the sole repair call runs without the reference. Content-free observability records whether the successful path used public technique, shared technique, AI-only generation, or AI repair.

**Tech Stack:** Supabase PostgreSQL migrations and service-role RPCs, Supabase Edge Functions on Deno/TypeScript, OpenAI Responses API structured output, Node test runner, Expo/React Native TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-13-public-recipe-technique-reference-design.md`

## Global Constraints

- Public recipes are technique evidence, not ingredient lists to copy.
- Every explicitly requested ingredient must appear in the final recipe.
- Final required ingredients may contain only owned inventory and water or drinking water when the cooking method actually needs it.
- Water is optional, unlimited, never purchased, and never deducted; stock, milk, oil, and sauces receive no water exemption.
- At most one absent ingredient may appear only in `optionalIngredientTip`, never in ingredients, mandatory steps, or deduction.
- Do not add web search or an extra model summarization call.
- One request may call Terra once normally and once for repair; repair receives no technique reference.
- Never persist prompts, user messages, inventory names, candidate titles, or generated recipe content in observability.
- Do not commit, push, apply remote migrations, or deploy until the user explicitly requests those operations.

## Review Focus

- A two-ingredient request whose public candidate contains both ingredients plus many absent garnishes must still use the candidate as technique evidence and return a zero-purchase final recipe.
- A named-dish request with an exact title match but none of its explicit ingredients in the candidate must reject that candidate instead of trusting title alone.
- A vague request with only one pantry overlap must use AI-only generation rather than an unrelated public recipe.
- A reference-induced absent ingredient must cause one reference-free repair, not a second catalog candidate loop or a user-visible purchase requirement.
- Water may be used without stock only when returned by the model; non-water liquids and powders must match an owned lot and quantity.

---

### Task 1: Technique-candidate RPC and deterministic ranking

**Files:**
- Create: `supabase/migrations/202610130001_recipe_technique_candidates.sql`
- Modify: `supabase/functions/_shared/recipe-routing.ts`
- Modify: `tests/recipe-routing.test.ts`
- Create: `tests/recipe-technique-candidate-migration.test.ts`

**Interfaces:**
- Consumes: recipe catalog tables created by `202609120001_recipe_catalog.sql` and shared recipes created by `202609130001_recipe_search_sharing.sql`.
- Produces: RPC `public.search_recipe_technique_candidates(query_name text, required_ingredient_names text[], inventory_names text[], source_kind text) returns jsonb`, an expanded service-role `get_recipe_candidate_detail`, `scoreTechniqueCandidate(input, candidate): number`, `candidateScoreBand(score): 'high' | 'medium' | 'low'`, and `selectTechniqueCandidate(input, candidates): RecipeTechniqueCandidate | null`.

- [ ] **Step 1: Write migration contract tests that fail before the new RPC exists**

```ts
test('technique search separates required foods from pantry overlap', () => {
  assert.match(sql, /search_recipe_technique_candidates\(/);
  assert.match(sql, /required_ingredient_names text\[\]/);
  assert.match(sql, /inventory_names text\[\]/);
  assert.match(sql, /required_matched_count/);
  assert.match(sql, /inventory_matched_count/);
  assert.match(sql, /step_count/);
  assert.match(sql, /'cookingMethod', recipe\.cooking_method/);
  assert.match(sql, /'tip', recipe\.tip/);
});

test('technique search stays service-role-only', () => {
  assert.match(sql, /grant execute[\s\S]*to service_role/);
  assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/);
});
```

- [ ] **Step 2: Run the migration test and verify it fails**

Run: `node --test tests/recipe-technique-candidate-migration.test.ts`

Expected: FAIL because `202610130001_recipe_technique_candidates.sql` does not exist.

- [ ] **Step 3: Add failing ranking tests for all eligibility branches**

```ts
assert.equal(selectTechniqueCandidate(
  { dishName: '', requiredIngredientCount: 2 },
  [{ ...base, required_matched_count: 2, required_count: 2,
    inventory_matched_count: 2, ingredient_count: 7, step_count: 3 }],
)?.id, 'MFDS_1');

assert.equal(selectTechniqueCandidate(
  { dishName: '된장찌개', requiredIngredientCount: 1 },
  [{ ...base, name_score: 100, required_matched_count: 0, required_count: 1, step_count: 3 }],
), null);

assert.equal(selectTechniqueCandidate(
  { dishName: '', requiredIngredientCount: 0 },
  [{ ...base, inventory_matched_count: 1, ingredient_count: 5, step_count: 3 }],
), null);
```

Also pin ordering: required coverage, name/method score, pantry overlap ratio, step completeness, stable ID.

- [ ] **Step 4: Run the routing tests and verify the new assertions fail**

Run: `node --test tests/recipe-routing.test.ts`

Expected: FAIL because `RecipeTechniqueCandidate` and `selectTechniqueCandidate` do not exist.

- [ ] **Step 5: Implement the service-role RPC**

Create a new function rather than overloading the old three-argument RPC. Return no user content beyond bounded catalog metadata:

```sql
create function public.search_recipe_technique_candidates(
  query_name text,
  required_ingredient_names text[],
  inventory_names text[],
  source_kind text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
-- validate service_role, 100-char query/terms, and 10 required + 20 inventory terms
-- catalog rows return:
-- id, title, origin, name_score, method_score,
-- required_matched_count, required_count,
-- inventory_matched_count, ingredient_count, step_count
-- shared rows derive step_count from content->'steps'
-- order a bounded 20-row window and return [] when nothing matches
$$;
```

For public recipes, calculate requested and pantry matches independently against `normalized_name`, `parent_ingredient`, and `search_key`. Calculate `step_count` with a correlated count on `recipe_catalog.steps`; calculate `method_score` from `recipes.cooking_method`. For shared recipes, compare `ingredient_names` and use `jsonb_array_length(content->'steps')` only when the value is an array. In the same migration, replace `get_recipe_candidate_detail` so public results additionally expose `cookingMethod` from `recipes.cooking_method` and `tip` from `recipes.tip`; preserve its service-role-only boundary. Revoke public/anon/authenticated access and grant service role only.

- [ ] **Step 6: Implement ranking types and selection**

```ts
export type RecipeTechniqueCandidate = {
  id: string;
  title: string;
  origin: 'MFDS' | 'MAFRA' | 'SHARED_AI';
  name_score: number;
  method_score: number;
  required_matched_count: number;
  required_count: number;
  inventory_matched_count: number;
  ingredient_count: number;
  step_count: number;
};

export function selectTechniqueCandidate(
  input: { dishName: string; requiredIngredientCount: number },
  candidates: RecipeTechniqueCandidate[],
): RecipeTechniqueCandidate | null;

export function scoreTechniqueCandidate(
  input: { dishName: string; requiredIngredientCount: number },
  candidate: RecipeTechniqueCandidate,
): number;

export function candidateScoreBand(score: number): 'high' | 'medium' | 'low';
```

Implement the exact eligibility rules from the spec: named menu requires name/method score `>= 70` and at least one requested match when requested foods exist; one or two requested foods require all matches; three or more require at least two and `>= 60%`; vague requests require at least two pantry matches and `>= 30%` pantry overlap; every candidate requires at least two steps.

Score eligible candidates from 0–100 with `required coverage × 50`, `max(name_score, method_score) / 100 × 25`, `pantry overlap × 20`, and `min(step_count / 4, 1) × 5`. Sort descending by total score, then required match count, pantry match count, and ascending stable ID. Clamp divisions by zero to zero. Define `high >= 75`, `medium >= 55`, and otherwise `low`; ineligible candidates are filtered before scoring and never receive a band in the request trace.

- [ ] **Step 7: Run focused tests**

Run: `node --test tests/recipe-technique-candidate-migration.test.ts tests/recipe-routing.test.ts`

Expected: PASS.

- [ ] **Step 8: Record the checkpoint without committing**

Run: `git diff --check -- supabase/migrations/202610130001_recipe_technique_candidates.sql supabase/functions/_shared/recipe-routing.ts tests/recipe-routing.test.ts tests/recipe-technique-candidate-migration.test.ts`

Expected: no whitespace errors. Do not commit under the global constraint.

### Task 2: Bounded technique-reference contract and prompt

**Files:**
- Create: `supabase/functions/_shared/recipe-technique-reference.ts`
- Modify: `supabase/functions/_shared/recipe-guidelines.ts`
- Modify: `supabase/functions/_shared/menu-chat-contract.ts`
- Create: `tests/recipe-technique-reference.test.ts`
- Modify: `tests/recipe-routing.test.ts`

**Interfaces:**
- Consumes: raw result from `get_recipe_candidate_detail`.
- Produces: `TechniqueReference` and `toTechniqueReference(value): TechniqueReference | null`; `buildRecipeInstructions(mode: 'technique' | 'generate')`.

- [ ] **Step 1: Write failing sanitizer tests**

```ts
const reference = toTechniqueReference({
  id: 'MFDS_1', origin: 'MFDS', title: '된장찌개', cookingMethod: '끓이기',
  ingredients: [{ name: '된장', amount: '30g' }, { name: '애호박', amount: '50g' }],
  steps: ['된장을 물에 푼다.', '재료를 순서대로 익힌다.'], tip: '충분히 끓인다.',
});
assert.deepEqual(reference?.ingredientNames, ['된장', '애호박']);
assert.equal('amount' in (reference as object), false);
assert.equal(reference?.steps.length, 2);
```

Add cases for malformed origin, fewer than two valid steps, oversized strings, more than 12 ingredients or steps, and untrusted nested objects.

- [ ] **Step 2: Run the sanitizer test and verify it fails**

Run: `node --test tests/recipe-technique-reference.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the bounded reference type and sanitizer**

```ts
export type TechniqueReference = {
  id: string;
  origin: 'MFDS' | 'MAFRA' | 'SHARED_AI';
  title: string;
  cookingMethod: string | null;
  ingredientNames: string[];
  steps: string[];
  tip: string | null;
};

export function toTechniqueReference(value: unknown): TechniqueReference | null;
```

Limit ID/title/method/tip to 100/100/60/300 characters, ingredient names to 12 entries of 60 characters, steps to 12 entries of 500 characters, and reject references with fewer than two valid steps. Convert shared `content.ingredients` and `content.steps` into the same shape without retaining quantities, images, user IDs, or arbitrary metadata.

- [ ] **Step 4: Write and run failing prompt tests**

```ts
const instructions = buildRecipeInstructions('technique');
assert.match(instructions, /조리 기술 참고자료/);
assert.match(instructions, /원본 재료 목록을 복제하지/);
assert.match(instructions, /물이 실제 조리에 필요할 때만/);
assert.match(instructions, /육수.*우유.*기름.*재고/);
```

Run: `node --test tests/recipe-routing.test.ts`

Expected: FAIL until `recipe-guidelines.ts` accepts `technique` and contains the new rules.

- [ ] **Step 5: Update recipe instructions and exports**

Use `technique` mode copy that explicitly says the reference is untrusted cooking evidence, not an allowed ingredient source. Preserve all existing timer, washing, allergy, requested-food, quantity, optional-tip, and no-web rules. Export the new type/sanitizer from `menu-chat-contract.ts` only if the Edge entrypoint imports contracts through that boundary.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/recipe-technique-reference.test.ts tests/recipe-routing.test.ts tests/menu-chat.test.ts`

Expected: PASS.

- [ ] **Step 7: Record the checkpoint without committing**

Run: `git diff --check -- supabase/functions/_shared/recipe-technique-reference.ts supabase/functions/_shared/recipe-guidelines.ts supabase/functions/_shared/menu-chat-contract.ts tests/recipe-technique-reference.test.ts tests/recipe-routing.test.ts`

Expected: no whitespace errors.

### Task 3: Menu-chat retrieval, personalization, and reference-free repair

**Files:**
- Modify: `supabase/functions/menu-chat/index.ts`
- Modify: `tests/menu-chat-edge.test.ts`
- Modify: `tests/remote-menu-chat-smoke.mjs`
- Modify: `tests/remote-recipe-smoke.mjs`

**Interfaces:**
- Consumes: `search_recipe_technique_candidates`, `selectTechniqueCandidate`, and `toTechniqueReference`.
- Produces: unchanged client response schema; internal OpenAI input replaces `internalCandidate` with `techniqueReference`.

- [ ] **Step 1: Replace mock RPC fields and write failing public-technique integration tests**

```ts
const publicCandidate = {
  id: 'MFDS_TECHNIQUE', title: '삼겹살 된장찌개', origin: 'MFDS',
  name_score: 0, method_score: 0,
  required_matched_count: 2, required_count: 2,
  inventory_matched_count: 3, ingredient_count: 8, step_count: 4,
};
```

Assert that a candidate with five absent original ingredients is fetched, converted to `techniqueReference`, and sent to exactly one Terra call; the returned recipe contains only requested/pantry ingredients and keeps origin `MFDS`.

- [ ] **Step 2: Add the five Review Focus integration tests before implementation**

Pin these exact outcomes in `tests/menu-chat-edge.test.ts`:

```ts
assert.equal(result.recipe.origin, 'MFDS');                    // broad source recipe used as technique
assert.equal(getDetailCalls.length, 1);                       // one selected candidate only
assert.equal(terraInput.techniqueReference.ingredients, undefined);
assert.equal(terraInput.techniqueReference.ingredientNames.includes('애호박'), true);
assert.equal(result.recipe.ingredients.some(i => i.name === '애호박'), false);
assert.equal(repairInput.techniqueReference, null);            // reference-free sole repair
```

Also assert exact-title/no-required-match rejection, vague one-match rejection, no second catalog detail fetch during repair, and broth/milk/oil failing the existing inventory guard while water passes.

- [ ] **Step 3: Run the Edge tests and verify failure**

Run: `node --test tests/menu-chat-edge.test.ts tests/recipe-inventory-guard.test.ts`

Expected: FAIL because the endpoint still calls `search_recipe_candidates`, selects only zero-purchase candidates, and passes `internalCandidate` into repair.

- [ ] **Step 4: Parse and request the new candidate schema**

Replace `candidates()` with a strict `techniqueCandidates()` parser for all nine numeric fields. Call the new RPC twice:

```ts
{
  query_name: dishName,
  required_ingredient_names: namedIngredients,
  inventory_names: searchTerms,
  source_kind: 'catalog' | 'shared',
}
```

Select `publicTechnique ?? sharedTechnique`; do not require `ingredient_count <= matched_count`.

- [ ] **Step 5: Convert one detail record and change the generation boundary**

Change the generator signature to:

```ts
async function generateRecipe(
  context: string,
  allergens: string[],
  techniqueReference: TechniqueReference | null,
  inventory: RecipeLot[],
  requiredIngredients: string[],
  trace: AiRequestTrace,
  terraStage: Extract<AiTraceStage, 'terraInitial' | 'terraRepair'>,
  setFailureStage: (stage: AiFailureStage) => void,
  validationFeedback?: { missingNames: string[]; problem?: string },
): Promise<Record<string, unknown>>;
```

Send `techniqueReference` in the JSON input, use `buildRecipeInstructions(reference ? 'technique' : 'generate')`, and set recipe origin from the verified reference only. Keep final `checkRecipeInventory`, `assertRecipeQuality`, allergy, optional-tip, unit, and quantity guards unchanged.

- [ ] **Step 6: Make repair AI-only**

After any permitted validation failure, call `generateRecipe(focusedContext, allergens, null, ...)` exactly once. Do not retrieve an alternate public/shared detail during repair. Preserve the initial failure code and repair reason in observability.

- [ ] **Step 7: Update remote smoke expectations**

Keep remote tests content-independent: assert HTTP success or bounded traceable failure, final zero-purchase ingredients, required foods present, at most two Terra calls, and origin limited to `MFDS|MAFRA|SHARED_AI|AI_GENERATED`. Do not make remote smoke depend on a specific catalog title.

- [ ] **Step 8: Run focused integration tests**

Run: `node --test tests/menu-chat-edge.test.ts tests/recipe-inventory-guard.test.ts tests/menu-chat.test.ts`

Expected: PASS.

- [ ] **Step 9: Record the checkpoint without committing**

Run: `git diff --check -- supabase/functions/menu-chat/index.ts tests/menu-chat-edge.test.ts tests/remote-menu-chat-smoke.mjs tests/remote-recipe-smoke.mjs`

Expected: no whitespace errors.

### Task 4: Content-free technique-path observability

**Files:**
- Create: `supabase/migrations/202610130002_recipe_technique_observability.sql`
- Modify: `supabase/functions/_shared/ai-request-observability.ts`
- Modify: `tests/ai-request-observability.test.ts`
- Create: `tests/recipe-technique-observability-migration.test.ts`
- Modify: `tests/menu-chat-edge.test.ts`

**Interfaces:**
- Consumes: selected candidate and final generation outcome from Task 3.
- Produces: `initialCandidateOrigin`, `generationPath`, and `candidateScoreBand` in the bounded trace payload and private observability row.

- [ ] **Step 1: Write failing trace serializer tests**

```ts
trace.initialCandidateOrigin = 'MFDS';
trace.generationPath = 'public_technique';
trace.candidateScoreBand = 'high';
const payload = summarizeAiRequestTrace(trace, 200);
assert.equal(payload.initial_candidate_origin, 'MFDS');
assert.equal(payload.generation_path, 'public_technique');
assert.equal(payload.candidate_score_band, 'high');
assert.equal(JSON.stringify(payload).includes('삼겹살'), false);
```

Test allowlists and null fallback for unknown values.

- [ ] **Step 2: Write failing migration tests**

Assert three nullable bounded columns, check constraints with exact allowlists, explicit JSON-key validation in `record_ai_request_trace`, service-role-only execution, and no grants on the private observability table.

- [ ] **Step 3: Run the observability tests and verify failure**

Run: `node --test tests/ai-request-observability.test.ts tests/recipe-technique-observability-migration.test.ts`

Expected: FAIL because the fields and migration do not exist.

- [ ] **Step 4: Add bounded trace fields and serializer allowlists**

```ts
type GenerationPath = 'public_technique' | 'shared_technique' | 'ai_only' | 'ai_repair';
type CandidateScoreBand = 'high' | 'medium' | 'low';

// AiRequestTrace additions
initialCandidateOrigin: 'MFDS' | 'MAFRA' | 'SHARED_AI' | 'AI_GENERATED' | null;
generationPath: GenerationPath | null;
candidateScoreBand: CandidateScoreBand | null;
```

Map only these values into snake-case RPC payload keys. Do not add candidate IDs, titles, ingredients, prompts, or messages.

- [ ] **Step 5: Add the private-schema migration**

Alter `observability.ai_request_traces` with the three columns and exact check constraints. Replace `public.record_ai_request_trace(trace jsonb)` following the current `202610110002_ai_error_diagnostics.sql` safeguards: reject unexpected content keys, clamp payload length, validate UUID/role/status/counts, insert the new fields, retain advisory-lock maintenance, revoke public roles, and grant only `service_role`.

- [ ] **Step 6: Populate the fields in menu-chat**

Set initial origin and score band immediately after selection. Set path to `public_technique` or `shared_technique` on first-attempt success, `ai_only` when no reference succeeds, and `ai_repair` when the only repair succeeds. Do not overwrite the initial origin during repair.

- [ ] **Step 7: Run observability and Edge tests**

Run: `node --test tests/ai-request-observability.test.ts tests/recipe-technique-observability-migration.test.ts tests/menu-chat-edge.test.ts`

Expected: PASS and each authenticated request still writes exactly one trace.

- [ ] **Step 8: Record the checkpoint without committing**

Run: `git diff --check -- supabase/migrations/202610130002_recipe_technique_observability.sql supabase/functions/_shared/ai-request-observability.ts tests/ai-request-observability.test.ts tests/recipe-technique-observability-migration.test.ts tests/menu-chat-edge.test.ts`

Expected: no whitespace errors.

### Task 5: Documentation and complete local verification

**Files:**
- Modify: `docs/TRD.md`
- Modify: `docs/PRD.md`
- Modify: `docs/PRODUCT_DECISIONS.md`
- Modify: `TODO.md`
- Modify: `HUMAN-IN-THE-ROOF.md`
- Modify: `docs/superpowers/specs/2026-10-13-public-recipe-technique-reference-design.md`

**Interfaces:**
- Consumes: completed implementation and verification evidence from Tasks 1–4.
- Produces: current product/technical decisions, progress record, and release handoff without deployment claims.

- [ ] **Step 1: Update only the routed document sections**

Record the final behavior in the recipe retrieval/adaptation sections: technique-reference eligibility, optional water semantics, public→shared→AI-only ordering, reference-free single repair, and content-free path metrics. Mark the design document status `구현 완료·배포 대기` only after tests pass.

- [ ] **Step 2: Add the user decision and progress rows**

Add one valid Markdown table row to `HUMAN-IN-THE-ROOF.md` for the 2026-10-13 approval and one current row to `TODO.md` stating local implementation/verification status and that remote migrations/deploy remain unperformed.

- [ ] **Step 3: Run all Node tests**

Run: `node --test tests/*.test.ts`

Expected: all tests pass with zero failures.

- [ ] **Step 4: Run strict mobile TypeScript**

Run from `mobile`: `node node_modules/typescript/bin/tsc --noEmit`

Expected: exit code 0 with no output.

- [ ] **Step 5: Export the web application**

Run from `mobile`: `npx expo export --platform web --output-dir dist-technique-check`

Expected: export completes. The existing nonblocking iOS AdMob warning may appear; no new compile or bundling error is allowed.

- [ ] **Step 6: Review the complete diff and security boundary**

Run:

```powershell
git diff --check
rg -n "OPENAI_API_KEY|service_role.*ey|sk-[A-Za-z0-9]" supabase mobile docs tests
git status --short
```

Expected: no whitespace errors, no secret value, and only intended files plus preserved pre-existing user changes.

- [ ] **Step 7: Stop before external mutations**

Do not apply `202610130001` or `202610130002` remotely, deploy Edge/web, commit, or push. Report the local test evidence, migration paths, and remaining user-authorized release steps.
