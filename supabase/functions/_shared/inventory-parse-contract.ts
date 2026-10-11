export type InventoryParseRequest = { text: string };

export function sanitizeInventoryParseRequest(input: unknown): InventoryParseRequest {
  if (!input || typeof input !== 'object') throw new Error('INVALID_TEXT');
  const text = typeof (input as Record<string, unknown>).text === 'string'
    ? ((input as Record<string, unknown>).text as string).trim()
    : '';
  if (!text || text.length > 2000) throw new Error('INVALID_TEXT');
  return { text };
}

const nullableUnit = { type: ['string', 'null'], enum: ['g', 'ml', '개', '대', null] };

export const inventoryParseResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rawText: { type: 'string' },
    items: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          productName: { type: 'string' },
          foodName: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: nullableUnit,
          category: {
            type: 'string',
            enum: ['tofu', 'leafy', 'mushroom', 'vegetable', 'fresh_meat', 'storage_vegetable', 'frozen', 'pantry', 'prepared'],
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          needsReview: { type: 'boolean' },
          note: { type: ['string', 'null'] },
          isFood: { type: 'boolean' },
          providedUseBy: { type: ['string', 'null'] },
        },
        required: ['productName', 'foodName', 'quantity', 'unit', 'category', 'confidence', 'needsReview', 'note', 'isFood', 'providedUseBy'],
      },
    },
  },
  required: ['rawText', 'items'],
} as const;

export function buildInventoryParseOpenAiRequest(text: string) {
  return {
    model: 'gpt-5.6-luna',
    reasoning: { effort: 'none' },
    max_output_tokens: 1600,
    store: false,
    instructions: `당신은 사용자가 한국어로 입력한 식품 재고를 구조화한다.
입력에 실제로 적힌 식품만 반환하며 없는 식품을 절대 추가하지 않는다.
rawText는 사용자 입력 원문을 그대로 반환한다. productName에는 해당 식품을 설명한 원문 구절을, foodName에는 브랜드와 수식어를 제거한 재고명을 쓴다.
productName에는 각 식품에 대해 사용자가 적은 냉동·냉장 표시를 반드시 보존한다. 다른 식품의 보관 표시는 섞지 않는다.
수량과 단위는 g, ml, 개, 대 중 하나로 정규화한다. 불명확하면 quantity와 unit을 null로 두고 needsReview=true로 표시한다.
사용자가 소비기한 또는 유통기한을 YYYY-MM-DD나 해석 가능한 날짜로 적었다면 providedUseBy를 YYYY-MM-DD로 반환하고, 없으면 null로 둔다.
식품과 조미료만 isFood=true로 표시한다. 한국어로 반환한다.`,
    input: text,
    text: {
      format: {
        type: 'json_schema',
        name: 'naengtalk_inventory_parse',
        strict: true,
        schema: inventoryParseResponseSchema,
      },
      verbosity: 'low',
    },
  } as const;
}

export function applyProvidedDates(result: Record<string, unknown>, text: string, baseDate: string): Record<string, unknown> {
  const items = Array.isArray(result.items) ? result.items : [];
  const fullDatePattern = /(?<!\d)(\d{4})(?:\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})|\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일)(?!\d)/g;
  const hasExplicitDate = [...text.matchAll(fullDatePattern)].length > 0;
  // Scope dates using food occurrences in the original input, never model order.
  const occurrences = items.map((value) => {
    const name = value && typeof value === 'object'
      ? (value as Record<string, unknown>).foodName
      : null;
    if (typeof name !== 'string' || !name.trim()) return [] as number[];
    const positions: number[] = [];
    let position = text.indexOf(name);
    while (position !== -1) {
      positions.push(position);
      position = text.indexOf(name, position + name.length);
    }
    return positions;
  });
  const starts = occurrences.flat().sort((a, b) => a - b);
  return {
    ...result,
    items: items.map((value, index) => {
      if (!value || typeof value !== 'object') return value;
      const item = value as Record<string, unknown>;
      let providedUseBy = typeof item.providedUseBy === 'string' ? item.providedUseBy : '';
      if (hasExplicitDate) {
        const positions = occurrences[index];
        if (positions.length > 1 || (items.length > 1 && (positions.length !== 1
          || starts.filter((start) => start === positions[0]).length !== 1))) return item;
        const start = items.length === 1 ? 0 : positions[0];
        const end = items.length === 1 ? text.length : starts.find((position) => position > start) ?? text.length;
        const phrase = text.slice(start, end);
        const dates = [...phrase.matchAll(fullDatePattern)]
          .filter((match) => !/(?:구매|구입|제조|생산)\s*일\s*[:：]?\s*$/.test(phrase.slice(0, match.index)))
          .map((match) => `${match[1]}-${(match[2] ?? match[4]).padStart(2, '0')}-${(match[3] ?? match[5]).padStart(2, '0')}`)
          .filter((date) => {
            const parsed = new Date(`${date}T00:00:00.000Z`);
            return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
          });
        const uniqueDates = [...new Set(dates)];
        if (uniqueDates.length !== 1) return item;
        providedUseBy = uniqueDates[0];
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(providedUseBy) || providedUseBy < baseDate) return item;
      return {
        ...item,
        providedUseBy,
        recommendedUseBy: providedUseBy,
        shelfLifeStatus: 'cached',
        needsReview: !item.quantity || !item.unit,
        internalNote: '사용자가 직접 입력한 소비기한을 적용했습니다.',
      };
    }),
  };
}
