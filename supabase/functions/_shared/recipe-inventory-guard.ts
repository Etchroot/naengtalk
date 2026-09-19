export type RecipeIngredient = {
  ingredientKey: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  inInventory: boolean;
  requiredPurchase: boolean;
};

export type RecipeLot = {
  ingredient_key: string;
  display_name: string;
  quantity: number | string;
  unit: string;
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function comparable(unit: string | null, quantity: number | null): { unit: string; quantity: number } | null {
  if (!Number.isFinite(quantity) || quantity === null || quantity <= 0 || !unit) return null;
  if (unit === 'T') return { unit: 'ml', quantity: quantity * 15 };
  if (unit === 't') return { unit: 'ml', quantity: quantity * 5 };
  if (!['g', 'ml', '개', '대'].includes(unit)) return null;
  return { unit, quantity };
}

export function checkRecipeInventory(
  recipe: { ingredients: RecipeIngredient[] },
  inventory: RecipeLot[],
): { missingNames: string[]; purchaseCount: number; correctedIngredients: RecipeIngredient[] } {
  const missingNames: string[] = [];
  const reserved = new Map<string, number>();
  const correctedIngredients = recipe.ingredients.map((ingredient) => {
    const name = normalize(ingredient.name);
    if (name === '물' || name === '식수') {
      return { ...ingredient, ingredientKey: null, inInventory: false, requiredPurchase: false };
    }
    const amount = comparable(ingredient.unit, ingredient.quantity);
    const matching = inventory.filter((lot) => {
      const lotName = normalize(lot.display_name);
      const key = normalize(lot.ingredient_key);
      return name.length > 0 && (name === lotName || name === key
        || (name.length >= 2 && lotName.includes(name))
        || (lotName.length >= 2 && name.includes(lotName)));
    });
    const matchingUnit = amount ? matching.filter((lot) => lot.unit === amount.unit) : [];
    const available = matchingUnit.reduce((sum, lot) => sum + Number(lot.quantity), 0);
    const reservationKey = `${matchingUnit.map((lot) => lot.ingredient_key).sort().join('|')}|${amount?.unit ?? ''}`;
    const remaining = available - (reserved.get(reservationKey) ?? 0);
    const inInventory = Boolean(amount && remaining >= amount.quantity);
    if (inInventory && amount) reserved.set(reservationKey, (reserved.get(reservationKey) ?? 0) + amount.quantity);
    if (!inInventory) missingNames.push(ingredient.name.trim());
    return {
      ...ingredient,
      ingredientKey: inInventory ? matching[0]?.ingredient_key ?? null : null,
      inInventory,
      requiredPurchase: !inInventory,
    };
  });
  return { missingNames: [...new Set(missingNames)], purchaseCount: new Set(missingNames.map(normalize)).size, correctedIngredients };
}
