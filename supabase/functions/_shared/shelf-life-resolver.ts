import {
  buildShelfLifeSearchRequest,
  buildShelfLifeEstimateRequest,
  curatedShelfLifeRules,
  shelfLifeLookupForItem,
  enrichItemsWithShelfLife,
  extractWebSourceUrls,
  hasConflictingStorage,
  parseShelfLifeSearchResponse,
  parseShelfLifeEstimateResponse,
  partitionShelfLifeLookups,
  type ShelfLifeCategory,
  type ShelfLifeLookup,
  type ShelfLifeRule,
} from './shelf-life-contract.ts';

type OcrItem = {
  foodName: string;
  productName?: string;
  category: ShelfLifeCategory;
  needsReview: boolean;
  note: string | null;
  isFood: boolean;
  [key: string]: unknown;
};

type CacheRow = {
  canonical_key: string;
  canonical_name: string;
  category: ShelfLifeCategory;
  storage_method: ShelfLifeRule['storageMethod'];
  package_state: ShelfLifeRule['packageState'];
  duration_days: number;
  source_title: string;
  source_url: string | null;
  source_checked_at: string;
  evidence_type: 'curated' | 'ai_sourced' | 'ai_estimated' | 'ai_estimated_approved';
  confidence: number;
};

type ResolverConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  openAiKey: string;
  baseDate: string;
};

function outputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === 'string' && response.output_text) return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];
    for (const part of content) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  throw new Error('OPENAI_EMPTY');
}

function uniqueLookups(items: OcrItem[], knownRules: ShelfLifeRule[] = []): ShelfLifeLookup[] {
  const byKey = new Map<string, ShelfLifeLookup>();
  for (const item of items) {
    if (!item.isFood || hasConflictingStorage(item.productName)) continue;
    const lookup = shelfLifeLookupForItem(item, knownRules);
    byKey.set(`${lookup.canonicalKey}|${lookup.storageMethod}|${lookup.packageState}`, lookup);
  }
  return [...byKey.values()];
}

function cacheHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
}

async function readCachedRules(lookups: ShelfLifeLookup[], config: ResolverConfig): Promise<ShelfLifeRule[]> {
  if (!lookups.length) return [];
  const keys = [...new Set(lookups.map((lookup) => lookup.canonicalKey))];
  const filter = `in.(${keys.map((key) => `"${key.replaceAll('"', '')}"`).join(',')})`;
  const params = new URLSearchParams({
    select: 'canonical_key,canonical_name,category,storage_method,package_state,duration_days,source_title,source_url,source_checked_at,evidence_type,confidence',
    status: 'eq.active',
    canonical_key: filter,
  });
  const response = await fetch(`${config.supabaseUrl}/rest/v1/shelf_life_rules?${params}`, {
    headers: cacheHeaders(config.serviceRoleKey),
  });
  if (!response.ok) throw new Error('SHELF_LIFE_CACHE_READ');
  const rows = await response.json() as CacheRow[];
  return rows.map((row) => ({
    canonicalKey: row.canonical_key,
    canonicalName: row.canonical_name,
    category: row.category,
    storageMethod: row.storage_method,
    packageState: row.package_state,
    durationDays: row.duration_days,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    sourceCheckedAt: row.source_checked_at,
    evidenceType: row.evidence_type,
    confidence: Number(row.confidence),
  }));
}

async function searchBatch(misses: ShelfLifeLookup[], config: ResolverConfig): Promise<ShelfLifeRule[]> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: { authorization: `Bearer ${config.openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildShelfLifeSearchRequest(misses)),
  });
  if (!response.ok) throw new Error(`OPENAI_SEARCH_${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  const sources = extractWebSourceUrls(payload);
  const parsed = JSON.parse(outputText(payload));
  const expected = new Set(misses.map((lookup) => (
    `${lookup.canonicalKey}|${lookup.storageMethod}|${lookup.packageState}`
  )));
  return parseShelfLifeSearchResponse(parsed, sources).filter((rule) => expected.has(
    `${rule.canonicalKey}|${rule.storageMethod}|${rule.packageState}`,
  ));
}

async function searchMissingRules(misses: ShelfLifeLookup[], config: ResolverConfig): Promise<ShelfLifeRule[]> {
  const batches: ShelfLifeLookup[][] = [];
  for (let index = 0; index < misses.length; index += 3) batches.push(misses.slice(index, index + 3));
  const found: ShelfLifeRule[] = [];
  for (let index = 0; index < batches.length; index += 3) {
    const results = await Promise.allSettled(batches.slice(index, index + 3)
      .map((batch) => searchBatch(batch, config)));
    for (const result of results) {
      if (result.status === 'fulfilled') found.push(...result.value);
    }
  }
  return found;
}

async function estimateBatch(misses: ShelfLifeLookup[], config: ResolverConfig): Promise<ShelfLifeRule[]> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', signal: AbortSignal.timeout(30_000),
    headers: { authorization: `Bearer ${config.openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildShelfLifeEstimateRequest(misses)),
  });
  if (!response.ok) throw new Error(`OPENAI_ESTIMATE_${response.status}`);
  const payload = await response.json() as Record<string, unknown>;
  const expected = new Set(misses.map((lookup) =>
    `${lookup.canonicalKey}|${lookup.storageMethod}|${lookup.packageState}`));
  return parseShelfLifeEstimateResponse(JSON.parse(outputText(payload))).filter((rule) => expected.has(
    `${rule.canonicalKey}|${rule.storageMethod}|${rule.packageState}`));
}

async function estimateMissingRules(misses: ShelfLifeLookup[], config: ResolverConfig): Promise<ShelfLifeRule[]> {
  const batches: ShelfLifeLookup[][] = [];
  for (let index = 0; index < misses.length; index += 3) batches.push(misses.slice(index, index + 3));
  const found: ShelfLifeRule[] = [];
  for (let index = 0; index < batches.length; index += 3) {
    const results = await Promise.allSettled(batches.slice(index, index + 3)
      .map((batch) => estimateBatch(batch, config)));
    for (const result of results) {
      if (result.status === 'fulfilled') found.push(...result.value);
    }
  }
  return found;
}

async function upsertRules(rules: ShelfLifeRule[], config: ResolverConfig): Promise<void> {
  if (!rules.length) return;
  const now = new Date().toISOString();
  const rows = rules.map((rule) => ({
    canonical_key: rule.canonicalKey,
    canonical_name: rule.canonicalName,
    category: rule.category,
    storage_method: rule.storageMethod,
    package_state: rule.packageState,
    duration_days: rule.durationDays,
    source_title: rule.sourceTitle,
    source_url: rule.sourceUrl,
    source_checked_at: now,
    evidence_type: rule.evidenceType ?? 'ai_sourced',
    confidence: rule.confidence,
    status: 'active',
    updated_at: now,
  }));
  const params = new URLSearchParams({ on_conflict: 'canonical_key,storage_method,package_state' });
  const response = await fetch(`${config.supabaseUrl}/rest/v1/shelf_life_rules?${params}`, {
    method: 'POST',
    headers: { ...cacheHeaders(config.serviceRoleKey), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({})) as { code?: string };
    throw new Error(`SHELF_LIFE_CACHE_WRITE_${response.status}_${failure.code ?? 'unknown'}`);
  }
}

export async function resolveShelfLifeForOcr(
  result: Record<string, unknown>,
  config: ResolverConfig,
): Promise<Record<string, unknown>> {
  const items = Array.isArray(result.items) ? result.items as OcrItem[] : [];
  const initialLookups = uniqueLookups(items);
  let cached: ShelfLifeRule[] = [];
  try {
    cached = await readCachedRules(initialLookups, config);
  } catch {
    cached = [];
  }
  const lookups = uniqueLookups(items, cached);
  const checkedAt = new Date().toISOString();
  const curated = curatedShelfLifeRules(lookups, checkedAt);
  const { hits, misses } = partitionShelfLifeLookups(
    lookups,
    [...cached, ...curated],
    new Date(`${config.baseDate}T00:00:00.000Z`),
  );
  let searched: ShelfLifeRule[] = [];
  try {
    searched = await searchMissingRules(misses, config);
  } catch {
    searched = [];
  }
  const sourcedKeys = new Set(searched.map((rule) =>
    `${rule.canonicalKey}|${rule.storageMethod}|${rule.packageState}`));
  const unverified = misses.filter((lookup) => !sourcedKeys.has(
    `${lookup.canonicalKey}|${lookup.storageMethod}|${lookup.packageState}`));
  let estimated: ShelfLifeRule[] = [];
  try {
    estimated = await estimateMissingRules(unverified, config);
  } catch {
    estimated = [];
  }
  try {
    await upsertRules([...searched, ...estimated], config);
  } catch {
    // Search results remain usable for this request if the shared cache is temporarily unavailable.
  }
  const freshRules = [...hits.map(({ rule }) => rule), ...[...searched, ...estimated].map((rule) => ({
    ...rule,
    sourceCheckedAt: checkedAt,
  }))];
  return {
    ...result,
    items: enrichItemsWithShelfLife(items, freshRules, config.baseDate),
  };
}
