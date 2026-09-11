import { test } from 'node:test';
import assert from 'node:assert/strict';

const purchaseOcr = await import('../mobile/src/domain/purchase-ocr.ts').catch(() => ({}));
const edgeContract = await import('../supabase/functions/_shared/purchase-ocr-contract.ts').catch(() => ({}));

const modelResponse = {
  rawText: '풀무원 두부 300g 1개\n키친타올 4롤 1개\n닭가슴살 너겟 1개',
  items: [
    {
      productName: '풀무원 고농도 두부 300g', foodName: '두부', quantity: 300, unit: 'g',
      category: 'tofu', confidence: 0.98, needsReview: false, note: null, isFood: true,
    },
    {
      productName: '잘풀리는집 키친타올 4롤', foodName: '키친타올', quantity: 4, unit: '개',
      category: 'pantry', confidence: 0.99, needsReview: false, note: '비식품', isFood: false,
    },
    {
      productName: '닭가슴살 치킨너겟', foodName: '치킨너겟', quantity: null, unit: null,
      category: 'frozen', confidence: 0.7, needsReview: true, note: '용량 확인 필요', isFood: true,
    },
  ],
};

test('OCR response keeps valid and review items while excluding non-food from inventory candidates', () => {
  const parsePurchaseOcrResponse = Reflect.get(purchaseOcr, 'parsePurchaseOcrResponse');
  const buildInventoryCandidates = Reflect.get(purchaseOcr, 'buildInventoryCandidates');
  assert.equal(typeof parsePurchaseOcrResponse, 'function');
  assert.equal(typeof buildInventoryCandidates, 'function');

  const parsed = parsePurchaseOcrResponse(modelResponse);
  assert.equal(parsed.items.length, 3);
  assert.deepEqual(buildInventoryCandidates(parsed, '2026-09-09', 'R1'), [
    {
      ingredient_key: 'ocr-두부', display_name: '두부', quantity: 300, unit: 'g',
      use_by_at: '2026-09-12', date_source: 'estimated',
    },
  ]);
});

test('OCR response turns an unsupported unit into a review item instead of unsafe auto-registration', () => {
  const parsePurchaseOcrResponse = Reflect.get(purchaseOcr, 'parsePurchaseOcrResponse');
  const buildInventoryCandidates = Reflect.get(purchaseOcr, 'buildInventoryCandidates');
  assert.equal(typeof parsePurchaseOcrResponse, 'function');

  const parsed = parsePurchaseOcrResponse({
    rawText: '양파 1망',
    items: [{
      productName: '양파 1망', foodName: '양파', quantity: 1, unit: '망', category: 'storage_vegetable',
      confidence: 0.9, needsReview: false, note: null, isFood: true,
    }],
  });

  assert.equal(parsed.items[0].needsReview, true);
  assert.equal(parsed.items[0].unit, null);
  assert.deepEqual(buildInventoryCandidates(parsed, '2026-09-09', 'R2'), []);
});

test('use-by estimation is deterministic for every supported food category', () => {
  const estimatedUseByDate = Reflect.get(purchaseOcr, 'estimatedUseByDate');
  assert.equal(typeof estimatedUseByDate, 'function');

  const expected = {
    tofu: '2026-09-12', leafy: '2026-09-14', mushroom: '2026-09-14', vegetable: '2026-09-16',
    fresh_meat: '2026-09-11', storage_vegetable: '2026-09-23', frozen: '2026-10-09',
    pantry: '2026-10-09', prepared: '2026-10-09',
  };
  for (const [category, date] of Object.entries(expected)) {
    assert.equal(estimatedUseByDate('2026-09-09', category), date);
  }
});

test('edge OCR request accepts JPEG data URLs and rejects invalid or over-5MB payloads', () => {
  const sanitizePurchaseOcrRequest = Reflect.get(edgeContract, 'sanitizePurchaseOcrRequest');
  assert.equal(typeof sanitizePurchaseOcrRequest, 'function');

  assert.deepEqual(
    sanitizePurchaseOcrRequest({ imageDataUrl: 'data:image/jpeg;base64,QUJD', sampleId: 'R1' }),
    { imageDataUrl: 'data:image/jpeg;base64,QUJD', sampleId: 'R1' },
  );
  assert.deepEqual(
    sanitizePurchaseOcrRequest({ imageDataUrl: 'data:image/png;base64,QUJD', sampleId: 'UPLOAD' }),
    { imageDataUrl: 'data:image/png;base64,QUJD', sampleId: 'UPLOAD' },
  );
  assert.throws(
    () => sanitizePurchaseOcrRequest({ imageDataUrl: 'data:text/plain;base64,QUJD', sampleId: 'R1' }),
    /INVALID_IMAGE/,
  );
  assert.throws(
    () => sanitizePurchaseOcrRequest({
      imageDataUrl: `data:image/jpeg;base64,${'A'.repeat(7_000_000)}`, sampleId: 'R1',
    }),
    /IMAGE_TOO_LARGE/,
  );
});

test('OpenAI OCR request uses the approved vision-only privacy and cost controls', () => {
  const buildPurchaseOcrOpenAiRequest = Reflect.get(edgeContract, 'buildPurchaseOcrOpenAiRequest');
  assert.equal(typeof buildPurchaseOcrOpenAiRequest, 'function');

  const request = buildPurchaseOcrOpenAiRequest('data:image/jpeg;base64,QUJD');
  assert.equal(request.model, 'gpt-5.6-luna');
  assert.deepEqual(request.reasoning, { effort: 'none' });
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 2000);
  assert.equal(request.input[0].content[1].detail, 'original');
  assert.equal(request.input[0].content[1].image_url, 'data:image/jpeg;base64,QUJD');
  assert.equal('tools' in request, false);
  assert.equal(request.text.format.strict, true);
});

test('OCR response drops hallucinated items without text evidence and deduplicates one source row', () => {
  const parsePurchaseOcrResponse = Reflect.get(purchaseOcr, 'parsePurchaseOcrResponse');
  assert.equal(typeof parsePurchaseOcrResponse, 'function');

  const parsed = parsePurchaseOcrResponse({
    rawText: '친환경 대파 300g 1개\n국산 감자 1kg 1개',
    items: [
      {
        productName: '친환경 대파 300g', foodName: '대파', quantity: 300, unit: 'g',
        category: 'vegetable', confidence: 0.97, needsReview: false, note: null, isFood: true,
      },
      {
        productName: '친환경 대파 300g', foodName: '대파', quantity: 300, unit: 'g',
        category: 'vegetable', confidence: 0.91, needsReview: false, note: null, isFood: true,
      },
      {
        productName: '풀무원 두부 300g', foodName: '두부', quantity: 300, unit: 'g',
        category: 'tofu', confidence: 0.99, needsReview: false, note: null, isFood: true,
      },
    ],
  });

  assert.deepEqual(parsed.items.map((item: { foodName: string }) => item.foodName), ['대파']);
});
