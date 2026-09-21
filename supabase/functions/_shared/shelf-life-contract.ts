export const SHELF_LIFE_STORAGE_METHODS = ['room_temperature', 'refrigerated', 'frozen'] as const;
export const SHELF_LIFE_PACKAGE_STATES = ['unopened', 'opened', 'unpackaged'] as const;
export const SHELF_LIFE_CATEGORIES = [
  'tofu', 'leafy', 'mushroom', 'vegetable', 'fresh_meat',
  'storage_vegetable', 'frozen', 'pantry', 'prepared',
] as const;

export type ShelfLifeStorageMethod = typeof SHELF_LIFE_STORAGE_METHODS[number];
export type ShelfLifePackageState = typeof SHELF_LIFE_PACKAGE_STATES[number];
export type ShelfLifeCategory = typeof SHELF_LIFE_CATEGORIES[number];

export type ShelfLifeLookup = {
  canonicalKey: string;
  canonicalName: string;
  category: ShelfLifeCategory;
  storageMethod: ShelfLifeStorageMethod;
  packageState: ShelfLifePackageState;
};

export type ShelfLifeRule = ShelfLifeLookup & {
  durationDays: number;
  sourceTitle: string;
  sourceUrl: string | null;
  sourceCheckedAt?: string;
  evidenceType?: 'curated' | 'ai_sourced' | 'ai_estimated' | 'ai_estimated_approved';
  confidence: number;
};

function normalizedName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isStorageMethod(value: unknown): value is ShelfLifeStorageMethod {
  return typeof value === 'string' && SHELF_LIFE_STORAGE_METHODS.includes(value as ShelfLifeStorageMethod);
}

function isPackageState(value: unknown): value is ShelfLifePackageState {
  return typeof value === 'string' && SHELF_LIFE_PACKAGE_STATES.includes(value as ShelfLifePackageState);
}

function isCategory(value: unknown): value is ShelfLifeCategory {
  return typeof value === 'string' && SHELF_LIFE_CATEGORIES.includes(value as ShelfLifeCategory);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function safeText(value: unknown, length: number): string {
  return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

export function canonicalShelfLifeKey(
  name: string,
  storageMethod: ShelfLifeStorageMethod,
  packageState: ShelfLifePackageState,
): string {
  return `${normalizedName(name)}|${storageMethod}|${packageState}`;
}

export function defaultShelfLifeLookup(foodName: string, category: ShelfLifeCategory): ShelfLifeLookup {
  const canonicalKey = normalizedName(foodName);
  const storageMethod: ShelfLifeStorageMethod = category === 'frozen'
    ? 'frozen'
    : category === 'pantry' || category === 'prepared'
      ? 'room_temperature'
      : 'refrigerated';
  const packageState: ShelfLifePackageState = [
    'leafy', 'mushroom', 'vegetable', 'storage_vegetable',
  ].includes(category)
    ? 'unpackaged'
    : 'unopened';
  return { canonicalKey, canonicalName: foodName.trim(), category, storageMethod, packageState };
}

export function shelfLifeLookupForItem(item: {
  foodName: string;
  productName?: string;
  category: ShelfLifeCategory;
}, knownRules: ShelfLifeRule[] = []): ShelfLifeLookup {
  const lookup = defaultShelfLifeLookup(item.foodName, item.category);
  const original = item.productName ?? '';
  if (/냉동/.test(original)) return { ...lookup, storageMethod: 'frozen' };
  if (/냉장/.test(original)) return { ...lookup, storageMethod: 'refrigerated' };
  const curated = knownRules.filter((rule) => ['curated', 'ai_estimated_approved'].includes(rule.evidenceType ?? '')
    && rule.canonicalKey === lookup.canonicalKey);
  if (curated.length === 1) {
    return { ...lookup, storageMethod: curated[0].storageMethod,
      packageState: curated[0].packageState };
  }
  return lookup;
}

export function hasConflictingStorage(productName: string | undefined): boolean {
  return /냉동/.test(productName ?? '') && /냉장/.test(productName ?? '');
}

export function curatedShelfLifeRules(
  lookups: ShelfLifeLookup[],
  sourceCheckedAt: string,
): ShelfLifeRule[] {
  return lookups.flatMap((lookup): ShelfLifeRule[] => {
    if (
      lookup.canonicalKey !== '즉석밥'
      || lookup.storageMethod !== 'room_temperature'
      || lookup.packageState !== 'unopened'
    ) return [];

    return [{
      ...lookup,
      durationDays: 180,
      sourceTitle: 'CJ제일제당 햇반 미개봉 상온 9개월 보관 안내',
      sourceUrl: 'https://www.cj.co.kr/kr/support/faq/1939',
      sourceCheckedAt,
      confidence: 0.95,
    }];
  });
}

export function partitionShelfLifeLookups(
  lookups: ShelfLifeLookup[],
  rules: ShelfLifeRule[],
  now: Date,
): { hits: Array<{ lookup: ShelfLifeLookup; rule: ShelfLifeRule }>; misses: ShelfLifeLookup[] } {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - 365);
  const byKey = new Map(rules.map((rule) => [
    canonicalShelfLifeKey(rule.canonicalKey, rule.storageMethod, rule.packageState),
    rule,
  ]));
  const hits: Array<{ lookup: ShelfLifeLookup; rule: ShelfLifeRule }> = [];
  const misses: ShelfLifeLookup[] = [];
  for (const lookup of lookups) {
    const rule = byKey.get(canonicalShelfLifeKey(lookup.canonicalKey, lookup.storageMethod, lookup.packageState));
    const checkedAt = rule?.sourceCheckedAt ? new Date(rule.sourceCheckedAt) : null;
    const estimatedCutoff = new Date(now);
    estimatedCutoff.setUTCDate(estimatedCutoff.getUTCDate() - 30);
    const freshUntil = rule?.evidenceType === 'ai_estimated' ? estimatedCutoff : cutoff;
    if (rule && (rule.evidenceType === 'curated' || rule.evidenceType === 'ai_estimated_approved'
      || (checkedAt && !Number.isNaN(checkedAt.getTime()) && checkedAt >= freshUntil))) {
      hits.push({ lookup, rule });
    } else {
      misses.push(lookup);
    }
  }
  return { hits, misses };
}

const shelfLifeSearchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rules: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          canonicalKey: { type: 'string' },
          canonicalName: { type: 'string' },
          category: { type: 'string', enum: SHELF_LIFE_CATEGORIES },
          storageMethod: { type: 'string', enum: SHELF_LIFE_STORAGE_METHODS },
          packageState: { type: 'string', enum: SHELF_LIFE_PACKAGE_STATES },
          durationDays: { type: 'integer', minimum: 1, maximum: 3650 },
          rangeEndDays: { type: ['integer', 'null'], minimum: 1, maximum: 3650 },
          sourceTitle: { type: 'string' },
          sourceUrl: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: [
          'canonicalKey', 'canonicalName', 'category', 'storageMethod', 'packageState',
          'durationDays', 'rangeEndDays', 'sourceTitle', 'sourceUrl', 'confidence',
        ],
      },
    },
  },
  required: ['rules'],
} as const;

export function buildShelfLifeSearchRequest(misses: ShelfLifeLookup[]) {
  return {
    model: 'gpt-5.6-terra',
    reasoning: { effort: 'low' },
    tools: [{ type: 'web_search' }],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    max_tool_calls: 3,
    max_output_tokens: 1800,
    store: false,
    instructions: `한국 식품의 보수적인 권장 보관기간을 조사한다.
정부·공공 식품안전 자료와 제조사 안내를 우선한다. 제품 포장의 공식 소비기한을 추측하지 않는다.
기간이 범위라면 양 끝값을 일수로 환산해 durationDays와 rangeEndDays에 기록한다. 단일 기간이면 rangeEndDays는 null이다. 서버가 짧은 값을 적용한다.
각 값은 실제로 검색한 HTTPS 출처 URL과 제목을 포함해야 한다.
충분한 근거가 없는 항목은 rules에서 제외한다. 입력과 같은 canonicalKey, category, storageMethod, packageState를 반환한다.`,
    input: `다음 식품의 구매일 기준 권장 보관일수를 조사해주세요:\n${JSON.stringify(misses)}`,
    text: {
      format: {
        type: 'json_schema',
        name: 'naengtalk_shelf_life_rules',
        strict: true,
        schema: shelfLifeSearchSchema,
      },
      verbosity: 'low',
    },
  } as const;
}

export function parseShelfLifeSearchResponse(input: unknown, allowedSources: Set<string>): ShelfLifeRule[] {
  if (!isRecord(input) || !Array.isArray(input.rules)) return [];
  const normalizedSources = new Set([...allowedSources].map((url) => {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch { return ''; }
  }));
  return input.rules.slice(0, 20).flatMap((value): ShelfLifeRule[] => {
    if (!isRecord(value)) return [];
    const canonicalKey = normalizedName(safeText(value.canonicalKey, 80));
    const canonicalName = safeText(value.canonicalName, 100);
    const sourceTitle = safeText(value.sourceTitle, 200);
    const sourceUrl = safeText(value.sourceUrl, 500);
    let normalizedSource = '';
    try {
      const parsed = new URL(sourceUrl);
      normalizedSource = `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch { /* rejected below */ }
    const firstDurationDays = typeof value.durationDays === 'number' && Number.isInteger(value.durationDays)
      ? value.durationDays
      : 0;
    const rangeEndDays = value.rangeEndDays === null || value.rangeEndDays === undefined
      ? null
      : typeof value.rangeEndDays === 'number' && Number.isInteger(value.rangeEndDays)
        ? value.rangeEndDays
        : 0;
    const durationDays = rangeEndDays === null ? firstDurationDays : Math.min(firstDurationDays, rangeEndDays);
    const confidence = typeof value.confidence === 'number' && Number.isFinite(value.confidence)
      ? Math.max(0, Math.min(1, value.confidence))
      : 0;
    if (
      !canonicalKey || !canonicalName || !sourceTitle || !sourceUrl.startsWith('https://')
      || !normalizedSources.has(normalizedSource) || durationDays < 1 || durationDays > 3650
      || (rangeEndDays !== null && (rangeEndDays < 1 || rangeEndDays > 3650))
      || !isCategory(value.category) || !isStorageMethod(value.storageMethod)
      || !isPackageState(value.packageState)
    ) return [];
    return [{
      canonicalKey,
      canonicalName,
      category: value.category,
      storageMethod: value.storageMethod,
      packageState: value.packageState,
      durationDays,
      sourceTitle,
      sourceUrl,
      confidence,
    }];
  });
}

const shelfLifeEstimateSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    rules: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          canonicalKey: { type: 'string' },
          canonicalName: { type: 'string' },
          category: { type: 'string', enum: SHELF_LIFE_CATEGORIES },
          storageMethod: { type: 'string', enum: SHELF_LIFE_STORAGE_METHODS },
          packageState: { type: 'string', enum: SHELF_LIFE_PACKAGE_STATES },
          durationDays: { type: 'integer', minimum: 1, maximum: 3650 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['canonicalKey', 'canonicalName', 'category', 'storageMethod',
          'packageState', 'durationDays', 'confidence'],
      },
    },
  },
  required: ['rules'],
} as const;

export function buildShelfLifeEstimateRequest(misses: ShelfLifeLookup[]) {
  return {
    model: 'gpt-5.6-terra', reasoning: { effort: 'low' },
    max_output_tokens: 1200, store: false,
    instructions: `공용 DB에도 없고 웹 검색으로도 근거를 확인하지 못한 식품만 보수적으로 추정한다.
포장에 표시된 공식 소비기한이라고 주장하지 않는다. 보관 상태와 미개봉 여부가 불명확하거나 안전상 추정이 위험한 경우 rules에서 제외한다.
기간 범위가 떠오르면 짧은 값만 일수로 반환한다. 확신할 수 없는 값을 억지로 채우지 않는다.
입력의 canonicalKey, category, storageMethod, packageState를 그대로 반환한다.`,
    input: `다음 식품의 구매일 기준 권장 보관일수를 최후 수단으로 추정해주세요:\n${JSON.stringify(misses)}`,
    text: { format: { type: 'json_schema', name: 'naengtalk_shelf_life_estimates',
      strict: true, schema: shelfLifeEstimateSchema }, verbosity: 'low' },
  } as const;
}

export function parseShelfLifeEstimateResponse(input: unknown): ShelfLifeRule[] {
  if (!isRecord(input) || !Array.isArray(input.rules)) return [];
  return input.rules.slice(0, 20).flatMap((value): ShelfLifeRule[] => {
    if (!isRecord(value)) return [];
    const canonicalKey = normalizedName(safeText(value.canonicalKey, 80));
    const canonicalName = safeText(value.canonicalName, 100);
    const durationDays = value.durationDays;
    const confidence = value.confidence;
    if (!canonicalKey || !canonicalName || !isCategory(value.category)
      || !isStorageMethod(value.storageMethod) || !isPackageState(value.packageState)
      || typeof durationDays !== 'number' || !Number.isInteger(durationDays)
      || durationDays < 1 || durationDays > 3650
      || typeof confidence !== 'number' || !Number.isFinite(confidence)
      || confidence < 0 || confidence > 1) return [];
    return [{ canonicalKey, canonicalName, category: value.category,
      storageMethod: value.storageMethod, packageState: value.packageState,
      durationDays, sourceTitle: 'AI추정', sourceUrl: null,
      evidenceType: 'ai_estimated', confidence: Math.min(confidence, 0.4) }];
  });
}

export function addDays(baseDate: string, durationDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate) || !Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error('INVALID_SHELF_LIFE_DATE');
  }
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_SHELF_LIFE_DATE');
  date.setUTCDate(date.getUTCDate() + durationDays);
  return date.toISOString().slice(0, 10);
}

export function buildShelfLifeFallback(_lookup: ShelfLifeLookup, _baseDate: string) {
  return {
    recommendedUseBy: null,
    shelfLifeStatus: 'fallback' as const,
    needsReview: true,
    internalNote: '검증된 공용 권장 소진일 기준을 찾지 못했습니다. 제품 표시일을 직접 입력해주세요.',
  };
}

export type ShelfLifeResolvableItem = {
  foodName: string;
  productName?: string;
  category: ShelfLifeCategory;
  needsReview: boolean;
  note: string | null;
  isFood: boolean;
};

export function enrichItemsWithShelfLife<T extends ShelfLifeResolvableItem>(
  items: T[],
  rules: ShelfLifeRule[],
  baseDate: string,
): Array<T & {
  recommendedUseBy: string | null;
  shelfLifeStatus: 'cached' | 'fallback' | 'not_food';
  storageMethod: ShelfLifeStorageMethod | null;
  packageState: ShelfLifePackageState | null;
  internalNote: string | null;
}> {
  const byKey = new Map(rules.map((rule) => [
    canonicalShelfLifeKey(rule.canonicalKey, rule.storageMethod, rule.packageState),
    rule,
  ]));
  return items.map((item) => {
    if (!item.isFood) {
      return {
        ...item,
        recommendedUseBy: null,
        shelfLifeStatus: 'not_food' as const,
        storageMethod: null,
        packageState: null,
        internalNote: item.note,
      };
    }
    if (hasConflictingStorage(item.productName)) {
      return {
        ...item,
        recommendedUseBy: null,
        shelfLifeStatus: 'fallback' as const,
        needsReview: true,
        storageMethod: null,
        packageState: null,
        internalNote: '냉장·냉동 상태가 함께 표시되어 있습니다. 실제 보관 상태와 제품 표시일을 확인해주세요.',
      };
    }
    const lookup = shelfLifeLookupForItem(item, rules);
    const rule = byKey.get(canonicalShelfLifeKey(lookup.canonicalKey, lookup.storageMethod, lookup.packageState));
    if (!rule) {
      const fallback = buildShelfLifeFallback(lookup, baseDate);
      return {
        ...item,
        ...fallback,
        needsReview: true,
        storageMethod: lookup.storageMethod,
        packageState: lookup.packageState,
        internalNote: [item.note, fallback.internalNote].filter(Boolean).join(' · '),
      };
    }
    return {
      ...item,
      recommendedUseBy: addDays(baseDate, rule.durationDays),
      shelfLifeStatus: 'cached' as const,
      storageMethod: lookup.storageMethod,
      packageState: lookup.packageState,
      internalNote: item.note,
    };
  });
}

export function extractWebSourceUrls(response: unknown): Set<string> {
  const urls = new Set<string>();
  if (!isRecord(response) || !Array.isArray(response.output)) return urls;
  for (const outputItem of response.output) {
    if (!isRecord(outputItem)) continue;
    if (isRecord(outputItem.action) && Array.isArray(outputItem.action.sources)) {
      for (const source of outputItem.action.sources) {
        if (isRecord(source) && typeof source.url === 'string' && source.url.startsWith('https://')) {
          urls.add(source.url);
        }
      }
    }
    if (!Array.isArray(outputItem.content)) continue;
    for (const content of outputItem.content) {
      if (!isRecord(content) || !Array.isArray(content.annotations)) continue;
      for (const annotation of content.annotations) {
        if (!isRecord(annotation)) continue;
        const directUrl = typeof annotation.url === 'string' ? annotation.url : null;
        const nestedUrl = isRecord(annotation.url_citation) && typeof annotation.url_citation.url === 'string'
          ? annotation.url_citation.url
          : null;
        const url = directUrl ?? nestedUrl;
        if (url?.startsWith('https://')) urls.add(url);
      }
    }
  }
  return urls;
}
