export type RecipeCandidate = {
  id: string;
  title: string;
  origin: 'MFDS' | 'MAFRA' | 'SHARED_AI';
  name_score: number;
  matched_count: number;
  ingredient_count: number;
};

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
  _requested: string[],
): string[] {
  const normalized = inventory.map((item) => item.display_name)
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(normalized)].slice(0, 20);
}
