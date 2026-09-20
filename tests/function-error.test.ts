import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageFromFunctionError } from '../mobile/src/domain/function-error.ts';

test('the client displays a safe server JSON error instead of calling a 422 an AI outage', async () => {
  const error = { context: new Response(JSON.stringify({
    error: '현재 재고로 만들 수 있는 레시피를 찾지 못했습니다.',
  }), { status: 422, headers: { 'Content-Type': 'application/json' } }) };
  assert.equal(await messageFromFunctionError(error, 'AI 응답을 받지 못했습니다.'),
    '현재 재고로 만들 수 있는 레시피를 찾지 못했습니다.');
});

test('malformed and unrelated errors retain a generic message', async () => {
  assert.equal(await messageFromFunctionError({ context: new Response('<html>bad</html>', { status: 502 }) }, '다시 시도해주세요.'),
    '다시 시도해주세요.');
  assert.equal(await messageFromFunctionError(new Error('secret'), '다시 시도해주세요.'), '다시 시도해주세요.');
});
