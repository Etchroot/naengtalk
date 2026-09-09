import type { Usage } from './cooking.ts';

export type RemoteCookingRequest = {
  recipe_title: string;
  recipe_content: Record<string, unknown>;
  usage_lines: Array<{ ingredient_key: string; quantity: number; unit: string }>;
  request_key: string;
};

export function buildRemoteCookingRequest(input: {
  title: string;
  content: Record<string, unknown>;
  usage: Usage[];
  requestKey: string;
}): RemoteCookingRequest {
  const title = input.title.trim();
  const requestKey = input.requestKey.trim();
  if (!title) throw new Error('레시피 이름이 필요합니다.');
  if (requestKey.length < 8) throw new Error('유효한 요리 완료 요청 키가 필요합니다.');
  if (!input.usage.length) throw new Error('사용 재료를 확인해주세요.');

  const consolidated = new Map<string, RemoteCookingRequest['usage_lines'][number]>();
  for (const line of input.usage) {
    if (!line.ingredientId.trim() || !line.unit.trim()) {
      throw new Error('재료와 단위를 확인해주세요.');
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error('수량은 양수여야 합니다.');
    }
    const key = `${line.ingredientId}\u0000${line.unit}`;
    const previous = consolidated.get(key);
    consolidated.set(key, {
      ingredient_key: line.ingredientId,
      quantity: Math.round(((previous?.quantity ?? 0) + line.quantity) * 1000) / 1000,
      unit: line.unit,
    });
  }

  return {
    recipe_title: title,
    recipe_content: input.content,
    usage_lines: [...consolidated.values()],
    request_key: requestKey,
  };
}
