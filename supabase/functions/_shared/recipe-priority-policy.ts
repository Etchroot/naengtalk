type RecipeQualityInput = {
  ingredients?: Array<{ name?: unknown }>;
  steps?: Array<{ text?: unknown }>;
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function ingredientMatches(required: string, actual: string): boolean {
  const expected = normalize(required);
  const candidate = normalize(actual);
  return expected.length > 0 && candidate.length > 0
    && (expected === candidate || expected.includes(candidate) || candidate.includes(expected));
}

const meaningfulPreparation = /(끓|볶|굽|찌|삶|데치|부치|튀기|조리|졸이|익히|데우|무치|버무리|절이|갈아|블렌딩|숙성|오븐|전자레인지)/;

export function assertRecipeQuality(recipe: RecipeQualityInput, requiredIngredients: string[]): void {
  const ingredientNames = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((item) => typeof item?.name === 'string' ? item.name.trim() : '').filter(Boolean)
    : [];
  const missingNames = [...new Set(requiredIngredients.map((item) => item.trim()).filter(Boolean))]
    .filter((required) => !ingredientNames.some((actual) => ingredientMatches(required, actual)));
  if (missingNames.length) {
    throw Object.assign(new Error('REQUESTED_INGREDIENT_MISSING'), { missingNames });
  }

  const stepText = Array.isArray(recipe.steps)
    ? recipe.steps.map((step) => typeof step?.text === 'string' ? step.text : '').join(' ')
    : '';
  if (!meaningfulPreparation.test(stepText)) throw new Error('RECIPE_NOT_MEANINGFUL');
}

export function recipePriorityRules(): string {
  return `우선순위는 1) 알레르기·식품 안전 2) 사용자가 직접 언급한 모든 재료를 필수 포함 3) 한 끼 요리로서의 완성도와 자연스러운 조리 궁합 4) 추가 구매 0개 5) 조리도구 실행 가능성 6) 실제로 임박한 재료 활용이다.
사용자가 직접 언급한 재료는 임의로 핵심·보조 재료로 나누지 말고 모두 완성 레시피에 필수로 넣는다. 별도로 주인공 재료를 지정한 경우에만 그 구분을 사용한다.
단순히 생재료를 자르고 소스를 찍어 먹거나 곁들이는 구성은 요리로 제안하지 않는다. 끓이기·볶기·굽기·찌기·무치기·절이기 등 맛이나 상태가 실질적으로 변하는 조리가 있어야 한다. 같은 재고로 만들 수 있는 널리 알려진 자연스러운 메뉴가 있으면 억지로 새 조합을 만들지 말고 그 메뉴를 우선한다.`;
}
