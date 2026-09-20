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
