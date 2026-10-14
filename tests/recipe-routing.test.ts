import { test } from 'node:test';
import assert from 'node:assert/strict';

const routing = await import('../supabase/functions/_shared/recipe-routing.ts').catch(() => ({}));
const contract = await import('../supabase/functions/_shared/menu-chat-contract.ts').catch(() => ({}));

const candidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'MFDS_000028', title: '김치찌개', origin: 'MFDS',
  name_score: 0, matched_count: 0, ingredient_count: 5,
  ...overrides,
});

const techniqueCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: 'MFDS_TECHNIQUE', title: '삼겹살 된장찌개', origin: 'MFDS',
  name_score: 0, method_score: 0,
  required_matched_count: 2, required_count: 2,
  inventory_matched_count: 3, ingredient_count: 8, step_count: 4,
  ...overrides,
});

test('technique candidate may contain absent garnish when both requested foods match', () => {
  const select = Reflect.get(routing, 'selectTechniqueCandidate');
  assert.equal(typeof select, 'function');
  const selected = select({ dishName: '', requiredIngredientCount: 2 }, [techniqueCandidate()]);
  assert.equal(selected?.id, 'MFDS_TECHNIQUE');
});

test('named candidate cannot rely on its title while missing every requested food', () => {
  const select = Reflect.get(routing, 'selectTechniqueCandidate');
  assert.equal(typeof select, 'function');
  const selected = select({ dishName: '된장찌개', requiredIngredientCount: 1 }, [techniqueCandidate({
    title: '된장찌개', name_score: 100,
    required_matched_count: 0, required_count: 1,
  })]);
  assert.equal(selected, null);
});

test('vague request needs two pantry matches and thirty percent overlap', () => {
  const select = Reflect.get(routing, 'selectTechniqueCandidate');
  assert.equal(typeof select, 'function');
  assert.equal(select({ dishName: '', requiredIngredientCount: 0 }, [techniqueCandidate({
    required_matched_count: 0, required_count: 0,
    inventory_matched_count: 1, ingredient_count: 5,
  })]), null);
  assert.equal(select({ dishName: '', requiredIngredientCount: 0 }, [techniqueCandidate({
    required_matched_count: 0, required_count: 0,
    inventory_matched_count: 2, ingredient_count: 8,
  })]), null);
  assert.equal(select({ dishName: '', requiredIngredientCount: 0 }, [techniqueCandidate({
    id: 'eligible', required_matched_count: 0, required_count: 0,
    inventory_matched_count: 3, ingredient_count: 8,
  })])?.id, 'eligible');
});

test('technique score and stable tie breaks follow the approved priority', () => {
  const select = Reflect.get(routing, 'selectTechniqueCandidate');
  const score = Reflect.get(routing, 'scoreTechniqueCandidate');
  const band = Reflect.get(routing, 'candidateScoreBand');
  assert.equal(typeof score, 'function');
  assert.equal(typeof band, 'function');
  const input = { dishName: '', requiredIngredientCount: 2 };
  const high = techniqueCandidate({ id: 'high', inventory_matched_count: 7, ingredient_count: 8 });
  const low = techniqueCandidate({ id: 'low', inventory_matched_count: 2, ingredient_count: 8 });
  assert.ok(score(input, high) > score(input, low));
  assert.equal(band(75), 'high');
  assert.equal(band(55), 'medium');
  assert.equal(band(54.99), 'low');
  assert.deepEqual(select(input, [low, high])?.id, 'high');
  assert.equal(select(input, [techniqueCandidate({ step_count: 1 })]), null);
});

test('exact named dish cannot outrank pantry feasibility', () => {
  const chooseRecipeCandidate = Reflect.get(routing, 'chooseRecipeCandidate');
  assert.equal(typeof chooseRecipeCandidate, 'function');
  assert.equal(chooseRecipeCandidate('김치찌개', 3, [candidate({ name_score: 100 })]), null);
});

test('zero estimated purchases outrank a closer dish name with one missing ingredient', () => {
  const rankRecipeCandidates = Reflect.get(routing, 'rankRecipeCandidates');
  assert.equal(typeof rankRecipeCandidates, 'function');
  const ranked = rankRecipeCandidates('김치찌개', 4, [
    candidate({ id: 'one', name_score: 100, matched_count: 3, ingredient_count: 4 }),
    candidate({ id: 'zero', name_score: 0, matched_count: 4, ingredient_count: 4 }),
  ]);
  assert.deepEqual(ranked.map((item: { id: string }) => item.id), ['zero', 'one']);
});

test('one matching pantry ingredient does not make a broad request high confidence', () => {
  const chooseRecipeCandidate = Reflect.get(routing, 'chooseRecipeCandidate');
  assert.equal(chooseRecipeCandidate('', 4, [candidate({ matched_count: 1, ingredient_count: 3 })]), null);
});

test('multiple matching ingredients still reject more than one likely purchase', () => {
  const chooseRecipeCandidate = Reflect.get(routing, 'chooseRecipeCandidate');
  assert.equal(chooseRecipeCandidate('', 3, [
    candidate({ id: 'MFDS_000029', matched_count: 2, ingredient_count: 5 }),
  ]), null);
});

test('low-quality public candidate yields to a good shared candidate', () => {
  const chooseRecipeCandidate = Reflect.get(routing, 'chooseRecipeCandidate');
  const publicPick = chooseRecipeCandidate('', 4, [candidate({ matched_count: 1 })]);
  const sharedPick = publicPick ?? chooseRecipeCandidate('', 4, [
    candidate({ id: 'shared-1', origin: 'SHARED_AI', matched_count: 3, ingredient_count: 4 }),
  ]);
  assert.equal(sharedPick?.id, 'shared-1');
});

test('a feasible zero-purchase alternative may replace an unavailable named dish', () => {
  const chooseRecipeCandidate = Reflect.get(routing, 'chooseRecipeCandidate');
  assert.equal(chooseRecipeCandidate('감자 된장 계란 팬케이크', 3, [{
    id: 'MAFRA_000001', title: '된장국', origin: 'MAFRA',
    name_score: 0, matched_count: 3, ingredient_count: 3,
  }])?.title, '된장국');
});

test('recipe instructions do not request any external website lookup', () => {
  const buildRecipeInstructions = Reflect.get(contract, 'buildRecipeInstructions');
  assert.equal(typeof buildRecipeInstructions, 'function');
  for (const mode of ['personalize', 'generate']) {
    const instructions = buildRecipeInstructions(mode);
    assert.doesNotMatch(instructions, /만개의레시피|10000recipe\.com|youtube|웹 검색으로/i);
    assert.match(instructions, /외부 레시피/);
  }
});

test('technique instructions borrow cooking logic without copying absent ingredients', () => {
  const buildRecipeInstructions = Reflect.get(contract, 'buildRecipeInstructions');
  const instructions = buildRecipeInstructions('technique');
  assert.match(instructions, /조리 기술 참고자료/);
  assert.match(instructions, /원본 재료 목록을 복제하지/);
  assert.match(instructions, /물이 실제 조리에 필요할 때만/);
  assert.match(instructions, /육수.*우유.*기름.*재고/);
});

test('requested foods remain in the bounded catalog search when a guest owns thirty lots', () => {
  const inventorySearchTerms = Reflect.get(routing, 'inventorySearchTerms');
  const inventory = Array.from({ length: 28 }, (_, index) => ({ display_name: `품목${index}` }));
  inventory.push({ display_name: '무' }, { display_name: '양배추' });
  const terms = inventorySearchTerms(inventory, ['무', '양배추']);
  assert.equal(terms.length, 20);
  assert.deepEqual(terms.slice(0, 2), ['무', '양배추']);
});

test('explicit foods in the message survive a classifier that omits ingredientNames', () => {
  const mentionedInventoryNames = Reflect.get(routing, 'mentionedInventoryNames');
  const inventory = [{ display_name: '무' }, { display_name: '양배추' }, { display_name: '배' }];
  assert.deepEqual(mentionedInventoryNames('무랑 양배추로 요리해줘', inventory), ['무', '양배추']);
  assert.deepEqual(mentionedInventoryNames('무엇을 먹지?', inventory), []);
});
