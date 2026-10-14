import type { Usage } from './cooking.ts';
import type { RecipeOrigin } from './recipe-sharing.ts';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatInventoryChange = {
  action: 'add' | 'consume' | 'set';
  name: string;
  ingredientKey: string | null;
  quantity: number | null;
  unit: 'g' | 'ml' | '개' | '대' | null;
  all: boolean;
};
export type MenuChatRequest = {
  message: string;
  history: ChatMessage[];
  cookingTools: string[];
  allergens: string[];
  missingIngredientConfirmationTicket?: string;
};
export type RecipeIngredient = {
  ingredientKey: string | null;
  name: string;
  quantity: number | null;
  unit: 'g' | 'ml' | 'T' | 't' | '개' | '대' | null;
  inInventory: boolean;
  requiredPurchase: boolean;
};
export type OptionalIngredientTip = {
  ingredientName: string;
  stepNumber: number;
  message: string;
};
export type MenuRecipe = {
  origin?: RecipeOrigin;
  title: string;
  reason: string;
  servings: number;
  minutes: number;
  difficulty: '쉬움' | '보통' | '어려움';
  ingredients: RecipeIngredient[];
  steps: Array<{ text: string; minutes: number }>;
  optionalIngredientTip: OptionalIngredientTip | null;
  sources: Array<{ title: string; url: string }>;
};
export type MissingIngredientConfirmation = { ticket: string; ingredients: string[] };
export type MenuChatResponse = {
  reply: string;
  recipe: MenuRecipe | null;
  inventoryChanges: ChatInventoryChange[];
  missingIngredientConfirmation: MissingIngredientConfirmation | null;
};

function boundedLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 20);
}

export function sanitizeMenuChatRequest(input: unknown): MenuChatRequest {
  if (!input || typeof input !== 'object') throw new Error('채팅 요청을 확인해주세요.');
  const raw = input as Record<string, unknown>;
  if (typeof raw.message !== 'string') throw new Error('메시지를 입력해주세요.');
  const message = raw.message.trim();
  if (!message || message.length > 500) throw new Error('메시지는 1~500자로 입력해주세요.');
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
  const ticket = raw.missingIngredientConfirmationTicket;
  if (ticket !== undefined && (typeof ticket !== 'string' || !ticket.trim() || ticket.trim().length > 200)) {
    throw new Error('채팅 요청을 확인해주세요.');
  }
  return {
    message,
    history,
    cookingTools: boundedLabels(raw.cookingTools),
    allergens: boundedLabels(raw.allergens),
    ...(typeof ticket === 'string' ? { missingIngredientConfirmationTicket: ticket.trim() } : {}),
  };
}

function invalidAiResponse(): never {
  throw new Error('AI 응답 형식을 확인할 수 없습니다.');
}
function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalidAiResponse();
  return value.trim();
}
function positiveNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) invalidAiResponse();
  return value;
}
function nonnegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalidAiResponse();
  return value;
}

export function parseMenuChatResponse(input: unknown): MenuChatResponse {
  if (!input || typeof input !== 'object') invalidAiResponse();
  const raw = input as Record<string, unknown>;
  const reply = text(raw.reply);
  const inventoryChanges = Array.isArray(raw.inventoryChanges)
    ? raw.inventoryChanges.slice(0, 20).map((value): ChatInventoryChange => {
        if (!value || typeof value !== 'object') invalidAiResponse();
        const item = value as Record<string, unknown>;
        if (item.action !== 'add' && item.action !== 'consume' && item.action !== 'set') invalidAiResponse();
        const quantity = item.quantity === null ? null
          : item.action === 'set' ? nonnegativeNumber(item.quantity) : positiveNumber(item.quantity);
        const unit = item.unit;
        if (unit !== null && unit !== 'g' && unit !== 'ml' && unit !== '개' && unit !== '대') invalidAiResponse();
        if (item.ingredientKey !== null && typeof item.ingredientKey !== 'string') invalidAiResponse();
        if (typeof item.all !== 'boolean') invalidAiResponse();
        return { action: item.action, name: text(item.name, 100),
          ingredientKey: item.ingredientKey as string | null, quantity,
          unit: unit as ChatInventoryChange['unit'], all: item.all };
      }) : [];
  const confirmation = raw.missingIngredientConfirmation;
  const missingIngredientConfirmation = confirmation && typeof confirmation === 'object'
    ? (() => {
        const value = confirmation as Record<string, unknown>;
        const ticket = text(value.ticket, 200);
        if (!Array.isArray(value.ingredients)) invalidAiResponse();
        const ingredients = [...new Set(value.ingredients
          .map((item) => typeof item === 'string' ? item.trim().slice(0, 100) : '')
          .filter(Boolean))].slice(0, 10);
        if (!ingredients.length) invalidAiResponse();
        return { ticket, ingredients };
      })()
    : null;
  if (raw.recipe === null) return { reply, recipe: null, inventoryChanges, missingIngredientConfirmation };
  if (!raw.recipe || typeof raw.recipe !== 'object') invalidAiResponse();
  const recipe = raw.recipe as Record<string, unknown>;
  if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length || recipe.ingredients.length > 30) invalidAiResponse();
  if (!Array.isArray(recipe.steps) || !recipe.steps.length || recipe.steps.length > 20) invalidAiResponse();
  if (!Array.isArray(recipe.sources) || recipe.sources.length > 3) invalidAiResponse();
  const difficulty = recipe.difficulty;
  if (difficulty !== '쉬움' && difficulty !== '보통' && difficulty !== '어려움') invalidAiResponse();

  const ingredients = recipe.ingredients.map((item) => {
    if (!item || typeof item !== 'object') invalidAiResponse();
    const ingredient = item as Record<string, unknown>;
    const ingredientKey = ingredient.ingredientKey === null ? null : text(ingredient.ingredientKey, 100);
    const quantity = ingredient.quantity === null ? null : positiveNumber(ingredient.quantity);
    const unit = ingredient.unit;
    if (unit !== null && unit !== 'g' && unit !== 'ml' && unit !== 'T' && unit !== 't' && unit !== '개' && unit !== '대') invalidAiResponse();
    if (typeof ingredient.inInventory !== 'boolean' || typeof ingredient.requiredPurchase !== 'boolean') invalidAiResponse();
    return {
      ingredientKey,
      name: text(ingredient.name, 100),
      quantity,
      unit,
      inInventory: ingredient.inInventory,
      requiredPurchase: ingredient.requiredPurchase,
    } as RecipeIngredient;
  });
  const steps = recipe.steps.map((item) => {
    if (!item || typeof item !== 'object') invalidAiResponse();
    const step = item as Record<string, unknown>;
    const minutes = nonnegativeNumber(step.minutes);
    return { text: text(step.text, 1000), minutes: minutes <= 1 ? 0 : minutes };
  });
  const rawTip = recipe.optionalIngredientTip;
  const optionalIngredientTip = rawTip && typeof rawTip === 'object'
    ? (() => {
        const tip = rawTip as Record<string, unknown>;
        const stepNumber = positiveNumber(tip.stepNumber);
        if (!Number.isInteger(stepNumber) || stepNumber > steps.length) invalidAiResponse();
        return {
          ingredientName: text(tip.ingredientName, 100),
          stepNumber,
          message: text(tip.message, 300),
        };
      })()
    : null;
  const sources = recipe.sources.map((item) => {
    if (!item || typeof item !== 'object') invalidAiResponse();
    const source = item as Record<string, unknown>;
    const url = text(source.url, 1000);
    if (!url.startsWith('https://')) invalidAiResponse();
    return { title: text(source.title, 200), url };
  });
  const allowedOrigins = ['MFDS', 'MAFRA', 'SHARED_AI', 'AI_GENERATED', 'DEMO'];
  const origin = allowedOrigins.includes(String(recipe.origin))
    ? recipe.origin as RecipeOrigin : 'UNKNOWN';
  return {
    reply,
    inventoryChanges,
    missingIngredientConfirmation,
    recipe: {
      origin,
      title: text(recipe.title, 200),
      reason: text(recipe.reason, 500),
      servings: positiveNumber(recipe.servings),
      minutes: positiveNumber(recipe.minutes),
      difficulty,
      ingredients,
      steps,
      optionalIngredientTip,
      sources,
    },
  };
}

export function recipeUsage(recipe: MenuRecipe): Usage[] {
  return recipe.ingredients
    .filter((item) => item.inInventory && !item.requiredPurchase)
    .filter((item): item is RecipeIngredient & { ingredientKey: string; quantity: number; unit: Usage['unit'] } =>
      Boolean(item.ingredientKey && item.quantity && item.unit),
    )
    .map((item) => item.unit === 'T'
      ? { ingredientId: item.ingredientKey, quantity: item.quantity * 15, unit: 'ml' }
      : item.unit === 't'
        ? { ingredientId: item.ingredientKey, quantity: item.quantity * 5, unit: 'ml' }
        : { ingredientId: item.ingredientKey, quantity: item.quantity, unit: item.unit });
}

export function recipeContextMessage(recipe: MenuRecipe): ChatMessage {
  const ingredients = recipe.ingredients
    .map((item) => `${item.name}${item.quantity !== null && item.unit ? ` ${item.quantity}${item.unit}` : ''}${item.requiredPurchase ? '(구매 필요)' : ''}`)
    .join(', ');
  const steps = recipe.steps.map((item, index) => `${index + 1}. ${item.text}`).join(' ');
  const optionalTip = recipe.optionalIngredientTip
    ? `\n선택 재료 팁: ${recipe.optionalIngredientTip.message}` : '';
  return {
    role: 'assistant',
    content: `현재 제안 레시피: ${recipe.title}\n재료: ${ingredients}\n단계: ${steps}${optionalTip}`.slice(0, 500),
  };
}
