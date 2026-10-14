import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageFromFunctionError } from '../mobile/src/domain/function-error.ts';

test('the client displays a safe server JSON error instead of calling a 422 an AI outage', async () => {
  const requestId = '123e4567-e89b-42d3-a456-426614174000';
  const error = { context: new Response(JSON.stringify({
    error: '현재 재고로 만들 수 있는 레시피를 찾지 못했습니다.',
    failure_stage: 'validation_repair',
    final_failure_code: 'REQUESTED_INGREDIENT_MISSING',
  }), { status: 422, headers: {
    'Content-Type': 'application/json',
    'x-request-id': requestId,
  } }) };
  assert.equal(await messageFromFunctionError(error, 'AI 응답을 받지 못했습니다.'),
    `현재 재고로 만들 수 있는 레시피를 찾지 못했습니다.\n오류 추적 번호: ${requestId}`);
});

test('malformed JSON retains the fallback and appends a valid request ID', async () => {
  const requestId = '765e4321-e89b-42d3-a456-426614174000';
  const error = { context: new Response('<html>bad</html>', {
    status: 502,
    headers: { 'x-request-id': requestId },
  }) };
  assert.equal(await messageFromFunctionError(error, '다시 시도해주세요.'),
    `다시 시도해주세요.\n오류 추적 번호: ${requestId}`);
});

test('missing or malformed request IDs are never displayed', async () => {
  const safeBody = JSON.stringify({ error: '요청을 처리하지 못했습니다.' });
  const missingIdError = { context: new Response(safeBody, {
    status: 422,
    headers: { 'Content-Type': 'application/json' },
  }) };
  const malformedIdError = { context: new Response(safeBody, {
    status: 422,
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': 'validation_repair:REQUESTED_INGREDIENT_MISSING',
    },
  }) };

  assert.equal(await messageFromFunctionError(missingIdError, '다시 시도해주세요.'),
    '요청을 처리하지 못했습니다.');
  assert.equal(await messageFromFunctionError(malformedIdError, '다시 시도해주세요.'),
    '요청을 처리하지 못했습니다.');
  assert.equal(await messageFromFunctionError(new Error('secret'), '다시 시도해주세요.'), '다시 시도해주세요.');
});

test('server error text longer than 200 characters remains hidden while a valid request ID is shown', async () => {
  const requestId = 'abcdef12-3456-4789-abcd-ef1234567890';
  const error = { context: new Response(JSON.stringify({ error: '가'.repeat(201) }), {
    status: 422,
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
    },
  }) };

  assert.equal(await messageFromFunctionError(error, '다시 시도해주세요.'),
    `다시 시도해주세요.\n오류 추적 번호: ${requestId}`);
});
