export type AiTraceStage =
  | 'auth'
  | 'rateLimit'
  | 'inventory'
  | 'luna'
  | 'catalog'
  | 'terraInitial'
  | 'validation'
  | 'terraRepair';

type AiModelKind = 'luna' | 'terra';
type Clock = () => number;

const STAGE_KEYS: Record<AiTraceStage, string> = {
  auth: 'auth_ms',
  rateLimit: 'rate_limit_ms',
  inventory: 'inventory_ms',
  luna: 'luna_ms',
  catalog: 'catalog_ms',
  terraInitial: 'terra_initial_ms',
  validation: 'validation_ms',
  terraRepair: 'terra_repair_ms',
};

export type AiRequestTrace = {
  requestId: string;
  ownerId: string | null;
  intent: string | null;
  candidateOrigin: string | null;
  repairReason: string | null;
  startedAt: number;
  clock: Clock;
  stages: Record<AiTraceStage, number>;
  calls: Record<AiModelKind, number>;
  inputTokens: Record<AiModelKind, number>;
  outputTokens: Record<AiModelKind, number>;
  openAiRequestIds: string[];
};

function boundedInteger(value: unknown, max: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(0, Math.min(max, parsed));
}

function boundedLabel(value: string | null | undefined, max: number): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function recordOpenAiCall(trace: AiRequestTrace, model: AiModelKind): void {
  const callLimit = model === 'luna' ? 1 : 2;
  trace.calls[model] = boundedInteger(trace.calls[model] + 1, callLimit);
}

function recordOpenAiRequestId(trace: AiRequestTrace, value: unknown): void {
  if (typeof value === 'string' && value && trace.openAiRequestIds.length < 3) {
    trace.openAiRequestIds.push(value.slice(0, 128));
  }
}

export function createAiRequestTrace(
  requestId = crypto.randomUUID(),
  clock: Clock = () => performance.now(),
): AiRequestTrace {
  return {
    requestId,
    ownerId: null,
    intent: null,
    candidateOrigin: null,
    repairReason: null,
    startedAt: clock(),
    clock,
    stages: {
      auth: 0,
      rateLimit: 0,
      inventory: 0,
      luna: 0,
      catalog: 0,
      terraInitial: 0,
      validation: 0,
      terraRepair: 0,
    },
    calls: { luna: 0, terra: 0 },
    inputTokens: { luna: 0, terra: 0 },
    outputTokens: { luna: 0, terra: 0 },
    openAiRequestIds: [],
  };
}

export async function measureAiStage<T>(
  trace: AiRequestTrace,
  stage: AiTraceStage,
  operation: () => Promise<T> | T,
): Promise<T> {
  const startedAt = trace.clock();
  try {
    return await operation();
  } finally {
    const elapsed = boundedInteger(trace.clock() - startedAt, 120_000);
    trace.stages[stage] = boundedInteger(trace.stages[stage] + elapsed, 120_000);
  }
}

export function recordOpenAiUsage(
  trace: AiRequestTrace,
  model: AiModelKind,
  response: Record<string, unknown>,
): void {
  const usage = response.usage && typeof response.usage === 'object'
    ? response.usage as Record<string, unknown>
    : {};
  recordOpenAiCall(trace, model);
  trace.inputTokens[model] = boundedInteger(
    trace.inputTokens[model] + boundedInteger(usage.input_tokens, 10_000_000),
    10_000_000,
  );
  trace.outputTokens[model] = boundedInteger(
    trace.outputTokens[model] + boundedInteger(usage.output_tokens, 10_000_000),
    10_000_000,
  );
  recordOpenAiRequestId(trace, response.id);
}

export function recordOpenAiFailure(
  trace: AiRequestTrace,
  model: AiModelKind,
  error: unknown,
): void {
  recordOpenAiCall(trace, model);
  const requestId = error && typeof error === 'object'
    ? (error as { openAiRequestId?: unknown }).openAiRequestId
    : undefined;
  recordOpenAiRequestId(trace, requestId);
}

export function finishAiRequestTrace(
  trace: AiRequestTrace,
  status: number,
  errorCode?: string,
  clock: Clock = trace.clock,
): Record<string, unknown> {
  const stagePayload = Object.fromEntries(
    Object.entries(STAGE_KEYS).map(([stage, key]) => [
      key,
      boundedInteger(trace.stages[stage as AiTraceStage], 120_000),
    ]),
  );
  return {
    request_id: trace.requestId,
    owner_id: trace.ownerId,
    intent: boundedLabel(trace.intent, 32),
    candidate_origin: boundedLabel(trace.candidateOrigin, 32),
    status: boundedInteger(status, 599),
    error_code: boundedLabel(errorCode, 64),
    repair_reason: boundedLabel(trace.repairReason, 64),
    total_ms: boundedInteger(clock() - trace.startedAt, 120_000),
    ...stagePayload,
    luna_call_count: boundedInteger(trace.calls.luna, 1),
    terra_call_count: boundedInteger(trace.calls.terra, 2),
    luna_input_tokens: boundedInteger(trace.inputTokens.luna, 10_000_000),
    luna_output_tokens: boundedInteger(trace.outputTokens.luna, 10_000_000),
    terra_input_tokens: boundedInteger(trace.inputTokens.terra, 10_000_000),
    terra_output_tokens: boundedInteger(trace.outputTokens.terra, 10_000_000),
    openai_request_ids: trace.openAiRequestIds.slice(0, 3),
  };
}
