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
