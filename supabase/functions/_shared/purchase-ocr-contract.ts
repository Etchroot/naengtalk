export type PurchaseOcrRequest = { imageDataUrl: string; sampleId: string };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageDataUrlPattern = /^data:image\/(jpeg|jpg|png|webp);base64,([a-z0-9+/]+=*)$/i;

export function sanitizePurchaseOcrRequest(input: unknown): PurchaseOcrRequest {
  if (!input || typeof input !== 'object') throw new Error('INVALID_IMAGE');
  const raw = input as Record<string, unknown>;
  if (typeof raw.imageDataUrl !== 'string' || typeof raw.sampleId !== 'string') {
    throw new Error('INVALID_IMAGE');
  }
  const match = raw.imageDataUrl.match(imageDataUrlPattern);
  if (!match) throw new Error('INVALID_IMAGE');
  const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0;
  const decodedBytes = Math.floor(match[2].length * 3 / 4) - padding;
  if (decodedBytes > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');
  const sampleId = raw.sampleId.trim().toUpperCase();
  if (!/^(R[1-5]|UPLOAD)$/.test(sampleId)) throw new Error('INVALID_IMAGE');
  return { imageDataUrl: raw.imageDataUrl, sampleId };
}

const nullableUnit = { type: ['string', 'null'], enum: ['g', 'ml', '개', '대', null] };

export const purchaseOcrResponseSchema = {
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
        },
        required: ['productName', 'foodName', 'quantity', 'unit', 'category', 'confidence', 'needsReview', 'note', 'isFood'],
      },
    },
  },
  required: ['rawText', 'items'],
} as const;

export function buildPurchaseOcrOpenAiRequest(imageDataUrl: string) {
  return {
    model: 'gpt-5.6-luna',
    reasoning: { effort: 'none' },
    max_output_tokens: 2000,
    store: false,
    instructions: `당신은 한국 온라인 장보기 구매내역과 전자영수증을 읽는 OCR 구조화기다.
화면에 실제로 보이는 텍스트만 전사하고 상품 썸네일의 외형으로 제품을 추측하지 않는다.
식품과 조미료만 isFood=true로 표시하고 생활용품은 false로 표시한다.
foodName은 브랜드와 마케팅 문구를 제거한 재고용 식재료 이름으로 쓴다.
수량과 중량이 모두 있으면 총 재고량으로 환산한다. 예: 300g 2개는 600g이다.
지원 단위는 g, ml, 개, 대뿐이다. 환산할 수 없거나 용량이 보이지 않으면 quantity와 unit을 null로 두고 needsReview=true로 표시한다.
confidence가 0.8 미만이거나 중복 행·잘린 행·묶음 구성이 모호하면 needsReview=true로 표시한다.
category는 두부 tofu, 잎채소 leafy, 버섯 mushroom, 일반 채소 vegetable, 생고기 fresh_meat, 장기보관 뿌리채소 storage_vegetable, 냉동 frozen, 상온 조미료 pantry, 가공·조리식품 prepared 중 하나를 선택한다.
주소, 이름, 연락처, 주문번호, 결제정보는 rawText와 items에서 제외한다. 한국어로 반환한다.`,
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: '이 구매내역 캡처에서 식품 구매 항목을 전사하고 구조화해주세요.' },
        { type: 'input_image', image_url: imageDataUrl, detail: 'original' },
      ],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'naengtalk_purchase_ocr',
        strict: true,
        schema: purchaseOcrResponseSchema,
      },
      verbosity: 'low',
    },
  } as const;
}
