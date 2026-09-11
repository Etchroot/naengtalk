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
