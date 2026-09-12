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
    intent: { type: 'string', enum: ['reply_only', 'recipe', 'recipe_revision'] },
    reply: { type: 'string' },
  },
  required: ['intent', 'reply'],
};

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
          type: 'array', minItems: 1, maxItems: 3,
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
