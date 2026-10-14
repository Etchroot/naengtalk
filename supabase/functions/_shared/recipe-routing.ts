export type RecipeCandidate = {
  id: string;
  title: string;
  origin: 'MFDS' | 'MAFRA' | 'SHARED_AI';
  name_score: number;
  matched_count: number;
  ingredient_count: number;
};

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

type TechniqueSearchInput = {
  dishName: string;
  requiredIngredientCount: number;
};

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.max(0, numerator) / denominator : 0;
}

function eligibleTechniqueCandidate(
  input: TechniqueSearchInput,
  candidate: RecipeTechniqueCandidate,
): boolean {
  if (!candidate.id || !candidate.title || candidate.step_count < 2 || candidate.ingredient_count <= 0) return false;
  const requiredCount = Math.max(0, input.requiredIngredientCount);
  const requiredMatched = Math.max(0, candidate.required_matched_count);
  if (input.dishName.trim()) {
    if (Math.max(candidate.name_score, candidate.method_score) < 70) return false;
    return requiredCount === 0 || requiredMatched >= 1;
  }
  if (requiredCount > 0) {
    if (requiredCount <= 2) return requiredMatched >= requiredCount;
    return requiredMatched >= 2 && ratio(requiredMatched, requiredCount) >= 0.6;
  }
  return candidate.inventory_matched_count >= 2
    && ratio(candidate.inventory_matched_count, candidate.ingredient_count) >= 0.3;
}

export function scoreTechniqueCandidate(
  input: TechniqueSearchInput,
  candidate: RecipeTechniqueCandidate,
): number {
  const requiredCoverage = ratio(candidate.required_matched_count, input.requiredIngredientCount);
  const nameOrMethod = Math.max(0, Math.min(100, Math.max(candidate.name_score, candidate.method_score))) / 100;
  const pantryCoverage = ratio(candidate.inventory_matched_count, candidate.ingredient_count);
  const stepCompleteness = Math.max(0, Math.min(1, candidate.step_count / 4));
  return Math.min(100, requiredCoverage * 50 + nameOrMethod * 25 + pantryCoverage * 20 + stepCompleteness * 5);
}

export function candidateScoreBand(score: number): 'high' | 'medium' | 'low' {
  if (score >= 75) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

export function selectTechniqueCandidate(
  input: TechniqueSearchInput,
  candidates: RecipeTechniqueCandidate[],
): RecipeTechniqueCandidate | null {
  return candidates.filter((candidate) => eligibleTechniqueCandidate(input, candidate))
    .sort((a, b) => scoreTechniqueCandidate(input, b) - scoreTechniqueCandidate(input, a)
      || b.required_matched_count - a.required_matched_count
      || b.inventory_matched_count - a.inventory_matched_count
      || a.id.localeCompare(b.id))[0] ?? null;
}

export function chooseRecipeCandidate(
  dishName: string,
  requestedIngredientCount: number,
  candidates: RecipeCandidate[],
): RecipeCandidate | null {
  return rankRecipeCandidates(dishName, requestedIngredientCount, candidates)[0] ?? null;
}

export function rankRecipeCandidates(
  _dishName: string,
  _pantryCount: number,
  candidates: RecipeCandidate[],
): RecipeCandidate[] {
  return candidates.filter((item) => item.id && item.title
    && Number.isFinite(item.matched_count) && Number.isFinite(item.ingredient_count)
    && item.matched_count >= 1
    && item.ingredient_count - item.matched_count <= 1)
    .sort((a, b) =>
      (a.ingredient_count - a.matched_count) - (b.ingredient_count - b.matched_count)
      || b.matched_count - a.matched_count
      || b.name_score - a.name_score);
}

export function inventorySearchTerms(
  inventory: Array<{ display_name?: unknown }>,
  requested: string[],
): string[] {
  const normalized = inventory.map((item) => item.display_name)
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  const unique = [...new Set(normalized)];
  const prioritized = requested.flatMap((name) => {
    const exact = unique.find((stock) => stock === name.trim());
    return exact ? [exact] : unique.filter((stock) => stock.includes(name.trim()) && name.trim().length >= 2);
  });
  return [...new Set([...prioritized, ...unique])].slice(0, 20);
}

export function mentionedInventoryNames(
  message: string,
  inventory: Array<{ display_name?: unknown }>,
): string[] {
  return inventory.map((lot) => lot.display_name)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .filter((name) => name.length >= 2 ? message.includes(name)
      : new RegExp(`(?:^|[\\s,.])${name}(?=$|[\\s,.]|랑|와|과|을|를|로|가|는|도)`).test(message));
}
