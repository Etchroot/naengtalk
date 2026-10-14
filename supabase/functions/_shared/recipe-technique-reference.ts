export type TechniqueReference = {
  id: string;
  origin: 'MFDS' | 'MAFRA' | 'SHARED_AI';
  title: string;
  cookingMethod: string | null;
  ingredientNames: string[];
  steps: string[];
  tip: string | null;
};

function object(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function strings(
  value: unknown,
  maxItems: number,
  maxLength: number,
  field: string,
): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    const record = object(item);
    const normalized = text(typeof item === 'string' ? item : record?.[field], maxLength);
    if (normalized && !result.includes(normalized)) result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function toTechniqueReference(value: unknown): TechniqueReference | null {
  const raw = object(value);
  if (!raw || !['MFDS', 'MAFRA', 'SHARED_AI'].includes(String(raw.origin))) return null;
  const content = object(raw.content) ?? raw;
  const id = text(raw.id, 100);
  const title = text(raw.title ?? content.title, 100);
  if (!id || !title) return null;
  const ingredientNames = strings(content.ingredients, 12, 60, 'name');
  const steps = strings(content.steps, 12, 500, 'text');
  if (steps.length < 2) return null;
  const cookingMethod = text(content.cookingMethod, 60) || null;
  const tip = text(content.tip, 300) || null;
  return {
    id,
    origin: raw.origin as TechniqueReference['origin'],
    title,
    cookingMethod,
    ingredientNames,
    steps,
    tip,
  };
}
