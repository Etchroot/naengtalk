import {
  buildShelfLifeSearchRequest,
  defaultShelfLifeLookup,
  enrichItemsWithShelfLife,
  extractWebSourceUrls,
  parseShelfLifeSearchResponse,
  partitionShelfLifeLookups,
  type ShelfLifeCategory,
  type ShelfLifeLookup,
  type ShelfLifeRule,
} from './shelf-life-contract.ts';

type OcrItem = {
  foodName: string;
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
  source_url: string;
  source_checked_at: string;
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

function uniqueLookups(items: OcrItem[]): ShelfLifeLookup[] {
  const byKey = new Map<string, ShelfLifeLookup>();
  for (const item of items) {
    if (!item.isFood) continue;
    const lookup = defaultShelfLifeLookup(item.foodName, item.category);
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
    select: 'canonical_key,canonical_name,category,storage_method,package_state,duration_days,source_title,source_url,source_checked_at,confidence',
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
    confidence: Number(row.confidence),
  }));
}

async function searchMissingRules(misses: ShelfLifeLookup[], config: ResolverConfig): Promise<ShelfLifeRule[]> {
  if (!misses.length) return [];
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
    evidence_type: 'ai_sourced',
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
  if (!response.ok) throw new Error('SHELF_LIFE_CACHE_WRITE');
}

export async function resolveShelfLifeForOcr(
  result: Record<string, unknown>,
  config: ResolverConfig,
): Promise<Record<string, unknown>> {
  const items = Array.isArray(result.items) ? result.items as OcrItem[] : [];
  const lookups = uniqueLookups(items);
  let cached: ShelfLifeRule[] = [];
  try {
    cached = await readCachedRules(lookups, config);
  } catch {
    cached = [];
  }
  const { hits, misses } = partitionShelfLifeLookups(lookups, cached, new Date(`${config.baseDate}T00:00:00.000Z`));
  let searched: ShelfLifeRule[] = [];
  try {
    searched = await searchMissingRules(misses, config);
    await upsertRules(searched, config);
  } catch {
    searched = [];
  }
  const freshRules = [...hits.map(({ rule }) => rule), ...searched.map((rule) => ({
    ...rule,
    sourceCheckedAt: new Date().toISOString(),
  }))];
  return {
    ...result,
    items: enrichItemsWithShelfLife(items, freshRules, config.baseDate),
  };
}
