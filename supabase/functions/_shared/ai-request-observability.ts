export type AiTraceStage =
  | 'auth'
  | 'rateLimit'
  | 'inventory'
  | 'luna'
  | 'catalog'
  | 'terraInitial'
  | 'validation'
  | 'terraRepair';

export type AiFailureStage =
  | 'auth'
  | 'request_parse'
  | 'rate_limit'
  | 'inventory_query'
  | 'intent_model'
  | 'intent_parse'
  | 'catalog_search'
  | 'terra_initial'
  | 'validation_initial'
  | 'terra_repair'
  | 'validation_repair'
  | 'response'
  | 'unknown';

type AiFailureAttempt = 'initial' | 'repair';

type AiModelKind = 'luna' | 'terra';
type Clock = () => number;
export type GenerationPath = 'public_technique' | 'shared_technique' | 'ai_only' | 'ai_repair';
export type CandidateScoreBand = 'high' | 'medium' | 'low';
export type InitialCandidateOrigin = 'MFDS' | 'MAFRA' | 'SHARED_AI' | 'AI_GENERATED';

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
  initialCandidateOrigin: InitialCandidateOrigin | null;
  generationPath: GenerationPath | null;
  candidateScoreBand: CandidateScoreBand | null;
  repairReason: string | null;
  initialFailureCode: string | null;
  repairFailureCode: string | null;
  finalFailureCode: string | null;
  failureStage: AiFailureStage | null;
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

function boundedFailureCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, 64);
  return /^[A-Z][A-Z0-9_]*$/.test(normalized) ? normalized : null;
}

const FAILURE_STAGES = new Set<AiFailureStage>([
  'auth', 'request_parse', 'rate_limit', 'inventory_query', 'intent_model',
  'intent_parse', 'catalog_search', 'terra_initial', 'validation_initial',
  'terra_repair', 'validation_repair', 'response', 'unknown',
]);
const INITIAL_CANDIDATE_ORIGINS = new Set<InitialCandidateOrigin>([
  'MFDS', 'MAFRA', 'SHARED_AI', 'AI_GENERATED',
]);
const GENERATION_PATHS = new Set<GenerationPath>([
  'public_technique', 'shared_technique', 'ai_only', 'ai_repair',
]);
const CANDIDATE_SCORE_BANDS = new Set<CandidateScoreBand>(['high', 'medium', 'low']);

function boundedEnum<T extends string>(value: unknown, values: Set<T>): T | null {
  return typeof value === 'string' && values.has(value as T) ? value as T : null;
}

function boundedFailureStage(value: unknown): AiFailureStage | null {
  return typeof value === 'string' && FAILURE_STAGES.has(value as AiFailureStage)
    ? value as AiFailureStage
    : null;
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
    initialCandidateOrigin: null,
    generationPath: null,
    candidateScoreBand: null,
    repairReason: null,
    initialFailureCode: null,
    repairFailureCode: null,
    finalFailureCode: null,
    failureStage: null,
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

export function recordAiAttemptFailure(
  trace: AiRequestTrace,
  attempt: AiFailureAttempt,
  code: unknown,
): void {
  const boundedCode = boundedFailureCode(code);
  if (attempt === 'initial') trace.initialFailureCode = boundedCode;
  else trace.repairFailureCode = boundedCode;
}

export function recordAiFinalFailure(
  trace: AiRequestTrace,
  stage: AiFailureStage,
  code: unknown,
): void {
  trace.finalFailureCode = boundedFailureCode(code);
  trace.failureStage = boundedFailureStage(stage) ?? 'unknown';
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
    initial_candidate_origin: boundedEnum(trace.initialCandidateOrigin, INITIAL_CANDIDATE_ORIGINS),
    generation_path: boundedEnum(trace.generationPath, GENERATION_PATHS),
    candidate_score_band: boundedEnum(trace.candidateScoreBand, CANDIDATE_SCORE_BANDS),
    status: boundedInteger(status, 599),
    error_code: boundedFailureCode(errorCode),
    repair_reason: boundedLabel(trace.repairReason, 64),
    initial_failure_code: boundedFailureCode(trace.initialFailureCode),
    repair_failure_code: boundedFailureCode(trace.repairFailureCode),
    final_failure_code: boundedFailureCode(trace.finalFailureCode),
    failure_stage: boundedFailureStage(trace.failureStage),
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
