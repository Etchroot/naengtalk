import assert from 'node:assert/strict';
import test from 'node:test';

const contract = await import('../supabase/functions/_shared/inventory-parse-contract.ts').catch(() => ({}));

test('direct inventory text is bounded and normalized before AI parsing', () => {
  const sanitizeInventoryParseRequest = Reflect.get(contract, 'sanitizeInventoryParseRequest');
  assert.equal(typeof sanitizeInventoryParseRequest, 'function');
  assert.deepEqual(
    sanitizeInventoryParseRequest({ text: '  두부 300g, 계란 10개  ' }),
    { text: '두부 300g, 계란 10개' },
  );
  assert.throws(() => sanitizeInventoryParseRequest({ text: '' }), /INVALID_TEXT/);
  assert.throws(() => sanitizeInventoryParseRequest({ text: '가'.repeat(2001) }), /INVALID_TEXT/);
});

test('direct inventory AI request uses the fast private structured-output path', () => {
  const buildInventoryParseOpenAiRequest = Reflect.get(contract, 'buildInventoryParseOpenAiRequest');
  assert.equal(typeof buildInventoryParseOpenAiRequest, 'function');
  const request = buildInventoryParseOpenAiRequest('두부 300g, 계란 10개');
  assert.equal(request.model, 'gpt-5.6-luna');
  assert.equal(request.store, false);
  assert.deepEqual(request.reasoning, { effort: 'none' });
  assert.equal(request.text.format.strict, true);
  assert.match(request.input, /두부 300g/);
});

test('explicit ISO and Korean dates survive missing or incorrect model dates', () => {
  const applyProvidedDates = Reflect.get(contract, 'applyProvidedDates');
  assert.equal(typeof applyProvidedDates, 'function');
  for (const text of ['계란 6개, 냉장 보관, 소비기한 2026-10-10', '계란 6개 냉장보관 2026년 10월 10일']) {
    for (const providedUseBy of [null, '2026-11-02']) {
      const result = applyProvidedDates({ items: [{ foodName: '계란', productName: '계란 6개', quantity: 6, unit: '개', providedUseBy, recommendedUseBy: '2026-11-02' }] }, text, '2026-10-03');
      assert.equal(result.items[0].recommendedUseBy, '2026-10-10');
    }
  }
});

test('explicit dates stay with their food even when model items are reordered', () => {
  const applyProvidedDates = Reflect.get(contract, 'applyProvidedDates');
  assert.equal(typeof applyProvidedDates, 'function');
  const result = applyProvidedDates({ items: [
    { foodName: '두부', quantity: 300, unit: 'g', providedUseBy: '2026-10-10', recommendedUseBy: '2026-10-20' },
    { foodName: '계란', quantity: 6, unit: '개', providedUseBy: null, recommendedUseBy: '2026-11-02' },
  ] }, '계란 6개, 소비기한 2026-10-10; 두부 300g 냉장보관', '2026-10-03');
  assert.equal(result.items[0].recommendedUseBy, '2026-10-20');
  assert.equal(result.items[1].recommendedUseBy, '2026-10-10');
});

test('purchase dates, impossible dates and ambiguous duplicate foods are not used as expiry dates', () => {
  const applyProvidedDates = Reflect.get(contract, 'applyProvidedDates');
  assert.equal(typeof applyProvidedDates, 'function');
  const item = { foodName: '계란', quantity: 6, unit: '개', providedUseBy: '2026-10-10', recommendedUseBy: '2026-11-02' };
  for (const text of ['계란 6개 구매일 2026-10-10', '계란 6개 소비기한 2026-02-30', '계란 6개 2026-10-10, 계란 3개 2026-10-12']) {
    const result = applyProvidedDates({ items: [item] }, text, '2026-10-03');
    assert.equal(result.items[0].recommendedUseBy, '2026-11-02');
  }
});

test('relative dates and normalized names retain model date handling without an explicit full date', () => {
  const applyProvidedDates = Reflect.get(contract, 'applyProvidedDates');
  for (const text of ['닭가슴살 300g 내일까지', '계란 6개 내일까지']) {
    const result = applyProvidedDates({ items: [{ foodName: '닭고기', quantity: 300, unit: 'g', providedUseBy: '2026-10-04', recommendedUseBy: '2026-11-02' }] }, text, '2026-10-03');
    assert.equal(result.items[0].recommendedUseBy, '2026-10-04');
  }
});

test('a single item preserves an explicit date before its name or a normalized model name', () => {
  const applyProvidedDates = Reflect.get(contract, 'applyProvidedDates');
  for (const text of ['소비기한 2026-10-10 닭가슴살 300g', '닭가슴살 300g 소비기한 2026-10-10']) {
    const result = applyProvidedDates({ items: [{ foodName: '닭고기', quantity: 300, unit: 'g', providedUseBy: null, recommendedUseBy: '2026-11-02' }] }, text, '2026-10-03');
    assert.equal(result.items[0].recommendedUseBy, '2026-10-10');
  }
});
