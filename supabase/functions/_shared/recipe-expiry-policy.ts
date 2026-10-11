export type RecipeExpiryTier = 'expired' | 'critical' | 'soon' | 'normal';

export type RecipeExpiryPriority = {
  tier: RecipeExpiryTier;
  weight: -1 | 0 | 30 | 100;
  daysRemaining: number | null;
};

const dayMs = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifyRecipeExpiry(baseDate: string, useByDate: string): RecipeExpiryPriority {
  const base = parseDateOnly(baseDate);
  const useBy = parseDateOnly(useByDate);
  if (base === null || useBy === null) return { tier: 'normal', weight: 0, daysRemaining: null };
  const daysRemaining = Math.round((useBy - base) / dayMs);
  if (daysRemaining < 0) return { tier: 'expired', weight: -1, daysRemaining };
  if (daysRemaining <= 3) return { tier: 'critical', weight: 100, daysRemaining };
  if (daysRemaining <= 7) return { tier: 'soon', weight: 30, daysRemaining };
  return { tier: 'normal', weight: 0, daysRemaining };
}

export function todayInSeoul(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function prioritizeRecipeInventory<T extends { use_by_at?: unknown }>(
  inventory: T[],
  baseDate = todayInSeoul(),
): Array<T & { expiryTier: Exclude<RecipeExpiryTier, 'expired'>; expiryWeight: 0 | 30 | 100; daysRemaining: number | null }> {
  return inventory.flatMap((item) => {
    const priority = classifyRecipeExpiry(baseDate, typeof item.use_by_at === 'string' ? item.use_by_at : '');
    if (priority.tier === 'expired') return [];
    return [{
      ...item,
      expiryTier: priority.tier,
      expiryWeight: priority.weight,
      daysRemaining: priority.daysRemaining,
    }];
  }).sort((a, b) => b.expiryWeight - a.expiryWeight);
}

export function recipeExpiryRules(): string {
  return `소비기한 가중치는 D-0~3=100, D-4~7=30, D-8 이상=0이다. expired 재료는 사용하지 않는다. expiryWeight가 0인 재료끼리는 소비기한이 몇 일 빠르다는 이유로 우선하지 않고, 요리 완성도와 재료 궁합을 우선한다.`;
}
