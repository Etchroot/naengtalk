import type { MenuRecipe } from './menu-chat.ts';

export function recipeDisplayReason(recipe: Pick<MenuRecipe, 'origin' | 'ingredients' | 'reason'>): string {
  const names = recipe.ingredients.filter((item) => item.inInventory)
    .map((item) => item.name.trim()).filter(Boolean).slice(0, 3);
  const stock = names.length ? `${names.join('·')}를 활용해 ` : '현재 재고에 맞춰 ';
  if (recipe.origin === 'MFDS') return `식품의약품안전처 공공 레시피를 ${stock}조정했어요.`;
  if (recipe.origin === 'MAFRA') return `농림축산식품부 공공 레시피를 ${stock}조정했어요.`;
  return `${stock}구성한 레시피예요.`;
}
