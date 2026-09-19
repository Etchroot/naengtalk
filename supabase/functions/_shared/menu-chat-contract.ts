export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type MenuChatRequest = {
  message: string;
  history: ChatMessage[];
  cookingTools: string[];
  allergens: string[];
};

export { buildRecipeInstructions } from './recipe-guidelines.ts';

function labels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 20);
}

export function sanitizeRequest(input: unknown): MenuChatRequest {
  if (!input || typeof input !== 'object') throw new Error('INVALID_REQUEST');
  const raw = input as Record<string, unknown>;
  if (typeof raw.message !== 'string') throw new Error('INVALID_REQUEST');
  const message = raw.message.trim();
  if (!message || message.length > 500) throw new Error('INVALID_REQUEST');
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .filter((item) => item.role === 'user' || item.role === 'assistant')
        .filter((item) => typeof item.content === 'string' && item.content.trim().length > 0)
        .slice(-6)
        .map((item) => ({
          role: item.role as ChatMessage['role'],
          content: (item.content as string).trim().slice(0, 500),
        }))
    : [];
  return { message, history, cookingTools: labels(raw.cookingTools), allergens: labels(raw.allergens) };
}

export const classifierSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: ['reply_only', 'recipe', 'recipe_revision', 'inventory_change'] },
    reply: { type: 'string' },
    dishName: { type: ['string', 'null'] },
    ingredientNames: { type: 'array', maxItems: 10, items: { type: 'string' } },
    inventoryChanges: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['add', 'consume', 'set'] },
          name: { type: 'string' },
          ingredientKey: { type: ['string', 'null'] },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'], enum: ['g', 'ml', '개', '대', null] },
          all: { type: 'boolean' },
        },
        required: ['action', 'name', 'ingredientKey', 'quantity', 'unit', 'all'],
      },
    },
  },
  required: ['intent', 'reply', 'dishName', 'ingredientNames', 'inventoryChanges'],
};

export type InventoryChangeIntent = {
  action: 'add' | 'consume' | 'set';
  name: string;
  ingredientKey: string | null;
  quantity: number | null;
  unit: 'g' | 'ml' | '개' | '대' | null;
  all: boolean;
};

export function sanitizeInventoryChangeIntent(
  message: string,
  rawChanges: unknown,
  inventory: Array<{ ingredient_key: string; display_name: string; quantity: number; unit: string }>,
): { reply: string; changes: InventoryChangeIntent[] } {
  const evidence = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  const messageEvidence = evidence(message);
  const changes: InventoryChangeIntent[] = [];
  const ignored: string[] = [];
  for (const value of Array.isArray(rawChanges) ? rawChanges.slice(0, 20) : []) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 100) : '';
    if (!name || !messageEvidence.includes(evidence(name))) continue;
    if (row.action !== 'add' && row.action !== 'consume' && row.action !== 'set') continue;
    const quantity = typeof row.quantity === 'number' && Number.isFinite(row.quantity)
      && (row.action === 'set' ? row.quantity >= 0 : row.quantity > 0)
      && row.quantity <= 1_000_000 ? row.quantity : null;
    const unit = ['g', 'ml', '개', '대'].includes(String(row.unit))
      ? row.unit as InventoryChangeIntent['unit'] : null;
    const all = row.action === 'consume' && row.all === true;
    let ingredientKey: string | null = null;
    if (row.action !== 'add') {
      const requestedKey = typeof row.ingredientKey === 'string' ? row.ingredientKey : '';
      const matching = inventory.find((item) => evidence(item.display_name) === evidence(name)
          && (!unit || item.unit === unit))
        ?? inventory.find((item) => item.ingredient_key === requestedKey
          && evidence(item.display_name).includes(evidence(name))
          && (!unit || item.unit === unit));
      if (!matching) {
        const addedInMessage = changes.some((change) => change.action === 'add' && evidence(change.name) === evidence(name));
        if (row.action === 'consume' && !addedInMessage) { ignored.push(name); continue; }
      } else {
        ingredientKey = matching.ingredient_key;
      }
    }
    changes.push({ action: row.action, name, ingredientKey, quantity, unit, all });
  }
  const skipped = ignored.length ? `${[...new Set(ignored)].join(', ')}은(는) 등록된 재고가 없어 차감하지 않았어요. ` : '';
  return {
    reply: changes.length ? `${skipped}재고 변경안을 확인해주세요. 승인 전에는 재고를 변경하지 않았어요.`
      : skipped || '변경할 재고를 확인하지 못했어요. 재료명과 수량을 다시 알려주세요.',
    changes,
  };
}

const ingredientSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ingredientKey: { type: ['string', 'null'] },
    name: { type: 'string' },
    quantity: { type: ['number', 'null'] },
    unit: { type: ['string', 'null'], enum: ['g', 'ml', 'T', 't', '개', '대', null] },
    inInventory: { type: 'boolean' },
    requiredPurchase: { type: 'boolean' },
  },
  required: ['ingredientKey', 'name', 'quantity', 'unit', 'inInventory', 'requiredPurchase'],
};

export const recipeResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    recipe: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        reason: { type: 'string' },
        servings: { type: 'number' },
        minutes: { type: 'number' },
        difficulty: { type: 'string', enum: ['쉬움', '보통', '어려움'] },
        ingredients: { type: 'array', minItems: 1, maxItems: 30, items: ingredientSchema },
        steps: {
          type: 'array', minItems: 1, maxItems: 20,
          items: {
            type: 'object', additionalProperties: false,
            properties: { text: { type: 'string' }, minutes: { type: 'number' } },
            required: ['text', 'minutes'],
          },
        },
        sources: {
          type: 'array', minItems: 0, maxItems: 0,
          items: {
            type: 'object', additionalProperties: false,
            properties: { title: { type: 'string' }, url: { type: 'string' } },
            required: ['title', 'url'],
          },
        },
      },
      required: ['title', 'reason', 'servings', 'minutes', 'difficulty', 'ingredients', 'steps', 'sources'],
    },
  },
  required: ['reply', 'recipe'],
};

export function assertAllergenSafe(result: Record<string, unknown>, allergens: string[]): void {
  const searchableRecipe = JSON.stringify(result.recipe ?? {}).toLowerCase();
  const aliases = allergens.flatMap((item) =>
    item.includes('새우') ? [item, '새우', '새우젓', '건새우', '쉬림프', 'shrimp', 'prawn'] : [item],
  ).map((item) => item.toLowerCase());
  if (aliases.some((allergen) => searchableRecipe.includes(allergen))) {
    throw new Error('ALLERGEN_REJECTED');
  }
}
