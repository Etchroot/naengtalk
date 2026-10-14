import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAiRequestTrace,
  finishAiRequestTrace,
  measureAiStage,
  recordAiAttemptFailure,
  recordAiFinalFailure,
  recordOpenAiFailure,
  recordOpenAiUsage,
} from '../supabase/functions/_shared/ai-request-observability.ts';

test('stage timings, model calls, token totals and request ids become one bounded summary', async () => {
  let now = 100;
  const trace = createAiRequestTrace('11111111-1111-4111-8111-111111111111', () => now);
  trace.ownerId = '22222222-2222-4222-8222-222222222222';
  trace.intent = 'recipe';
  trace.candidateOrigin = 'MFDS';
  trace.initialCandidateOrigin = 'MFDS';
  trace.generationPath = 'public_technique';
  trace.candidateScoreBand = 'high';

  await measureAiStage(trace, 'inventory', async () => { now += 12; return 'ok'; });
  await measureAiStage(trace, 'inventory', async () => { now += 8; });
  recordOpenAiUsage(trace, 'luna', {
    id: 'resp_luna', usage: { input_tokens: 120, output_tokens: 30 },
  });
  recordOpenAiUsage(trace, 'terra', {
    id: 'resp_terra', usage: { input_tokens: 500, output_tokens: 210 },
  });
  now += 80;

  const payload = finishAiRequestTrace(trace, 200, undefined, () => now);
  assert.equal(payload.total_ms, 100);
  assert.equal(payload.inventory_ms, 20);
  assert.equal(payload.luna_call_count, 1);
  assert.equal(payload.terra_call_count, 1);
  assert.equal(payload.luna_input_tokens, 120);
  assert.equal(payload.terra_output_tokens, 210);
  assert.deepEqual(payload.openai_request_ids, ['resp_luna', 'resp_terra']);
  assert.equal(payload.intent, 'recipe');
  assert.equal(payload.candidate_origin, 'MFDS');
  assert.equal(payload.initial_candidate_origin, 'MFDS');
  assert.equal(payload.generation_path, 'public_technique');
  assert.equal(payload.candidate_score_band, 'high');
  assert.equal(JSON.stringify(payload).includes('삼겹살'), false);
});

test('trace payload never contains user content fields and clamps untrusted usage values', () => {
  let now = 0;
  const trace = createAiRequestTrace('33333333-3333-4333-8333-333333333333', () => now);
  trace.repairReason = 'PURCHASE_LIMIT_EXCEEDED';
  recordOpenAiUsage(trace, 'terra', {
    id: 'x'.repeat(300), usage: { input_tokens: -5, output_tokens: 99_999_999 },
  });
  recordOpenAiUsage(trace, 'terra', { id: 'second', usage: { input_tokens: 1, output_tokens: 2 } });
  recordOpenAiUsage(trace, 'terra', { id: 'third', usage: { input_tokens: 1, output_tokens: 2 } });
  now = 200_000;

  const payload = finishAiRequestTrace(trace, 502, 'OPENAI_500', () => now);
  assert.equal(payload.total_ms, 120_000);
  assert.equal(payload.terra_call_count, 2);
  assert.equal(payload.terra_input_tokens, 2);
  assert.equal(payload.terra_output_tokens, 10_000_000);
  assert.equal((payload.openai_request_ids as string[]).length, 3);
  assert.equal((payload.openai_request_ids as string[])[0].length, 128);
  for (const forbidden of ['message', 'history', 'inventory', 'recipe', 'prompt', 'input', 'output']) {
    assert.equal(Object.hasOwn(payload, forbidden), false);
  }
});

test('a failed measured operation still records its elapsed stage time', async () => {
  let now = 10;
  const trace = createAiRequestTrace('44444444-4444-4444-8444-444444444444', () => now);
  await assert.rejects(measureAiStage(trace, 'terraInitial', async () => {
    now += 27;
    throw new Error('OPENAI_500');
  }), /OPENAI_500/);
  const payload = finishAiRequestTrace(trace, 502, 'OPENAI_500', () => now);
  assert.equal(payload.terra_initial_ms, 27);
});

test('a failed OpenAI attempt still records its model call and provider request id', () => {
  const trace = createAiRequestTrace('55555555-5555-4555-8555-555555555555', () => 0);
  recordOpenAiFailure(trace, 'terra', Object.assign(new Error('OPENAI_500'), {
    openAiRequestId: 'req_failed_terra',
  }));
  const payload = finishAiRequestTrace(trace, 502, 'OPENAI_500', () => 5);
  assert.equal(payload.terra_call_count, 1);
  assert.deepEqual(payload.openai_request_ids, ['req_failed_terra']);
});

test('trace summary publishes only bounded machine failure diagnostics', () => {
  const trace = createAiRequestTrace('66666666-6666-4666-8666-666666666666', () => 0);
  recordAiAttemptFailure(trace, 'initial', `INITIAL_${'X'.repeat(80)}`);
  recordAiAttemptFailure(trace, 'repair', 'user@example.com');
  recordAiFinalFailure(trace, 'validation_repair', 'REQUESTED_INGREDIENT_MISSING');

  const payload = finishAiRequestTrace(trace, 422, 'REQUESTED_INGREDIENT_MISSING', () => 5);
  assert.equal(String(payload.initial_failure_code).length, 64);
  assert.equal(payload.repair_failure_code, null);
  assert.equal(payload.final_failure_code, 'REQUESTED_INGREDIENT_MISSING');
  assert.equal(payload.failure_stage, 'validation_repair');
  assert.equal(JSON.stringify(payload).includes('user@example.com'), false);
});

test('failure helpers map attempts correctly and unknown stages fall back safely', () => {
  const trace = createAiRequestTrace('77777777-7777-4777-8777-777777777777', () => 0);
  recordAiAttemptFailure(trace, 'repair', 'OPENAI_500');
  recordAiFinalFailure(trace, 'not_a_stage' as never, 'CATALOG_READ');

  const payload = finishAiRequestTrace(trace, 502, 'CATALOG_READ', () => 1);
  assert.equal(payload.initial_failure_code, null);
  assert.equal(payload.repair_failure_code, 'OPENAI_500');
  assert.equal(payload.final_failure_code, 'CATALOG_READ');
  assert.equal(payload.failure_stage, 'unknown');
});

test('technique path fields use exact allowlists and unknown values serialize as null', () => {
  const trace = createAiRequestTrace('88888888-8888-4888-8888-888888888888', () => 0);
  trace.initialCandidateOrigin = 'UNTRUSTED' as never;
  trace.generationPath = 'web_search' as never;
  trace.candidateScoreBand = 'excellent' as never;

  const payload = finishAiRequestTrace(trace, 200, undefined, () => 1);
  assert.equal(payload.initial_candidate_origin, null);
  assert.equal(payload.generation_path, null);
  assert.equal(payload.candidate_score_band, null);
});
