import { test } from 'node:test';
import assert from 'node:assert/strict';

const shelfLife = await import('../supabase/functions/_shared/shelf-life-contract.ts').catch(() => ({}));

const potatoLookup = {
  canonicalKey: '감자',
  canonicalName: '감자',
  category: 'storage_vegetable',
  storageMethod: 'refrigerated',
  packageState: 'unpackaged',
};

test('canonical shelf-life keys reuse one cache entry for equivalent normalized names', () => {
  const canonicalShelfLifeKey = Reflect.get(shelfLife, 'canonicalShelfLifeKey');
  assert.equal(typeof canonicalShelfLifeKey, 'function');

  assert.equal(
    canonicalShelfLifeKey('  감자 ', 'refrigerated', 'unpackaged'),
    canonicalShelfLifeKey('감자', 'refrigerated', 'unpackaged'),
  );
  assert.notEqual(
    canonicalShelfLifeKey('감자', 'refrigerated', 'unpackaged'),
    canonicalShelfLifeKey('감자', 'room_temperature', 'unpackaged'),
  );
});

test('fresh cache hits are reused while missing and year-old rules are searched', () => {
  const partitionShelfLifeLookups = Reflect.get(shelfLife, 'partitionShelfLifeLookups');
  assert.equal(typeof partitionShelfLifeLookups, 'function');

  const instantRice = {
    canonicalKey: '즉석밥', canonicalName: '즉석밥', category: 'prepared',
    storageMethod: 'room_temperature', packageState: 'unopened',
  };
  const rules = [
    {
      ...potatoLookup, durationDays: 14, sourceTitle: '보관 안내', sourceUrl: 'https://example.org/potato',
      sourceCheckedAt: '2026-08-01T00:00:00.000Z', confidence: 0.9,
    },
    {
      ...instantRice, durationDays: 270, sourceTitle: '즉석밥 안내', sourceUrl: 'https://example.org/rice',
      sourceCheckedAt: '2025-08-01T00:00:00.000Z', confidence: 0.9,
    },
  ];

  const result = partitionShelfLifeLookups(
    [potatoLookup, instantRice],
    rules,
    new Date('2026-09-10T00:00:00.000Z'),
  );
  assert.deepEqual(result.hits.map((entry: { lookup: { canonicalName: string } }) => entry.lookup.canonicalName), ['감자']);
  assert.deepEqual(result.misses.map((entry: { canonicalName: string }) => entry.canonicalName), ['즉석밥']);
});

test('curated rules do not require URLs or expire into web searches; AI estimates are short-lived', () => {
  const partition = Reflect.get(shelfLife, 'partitionShelfLifeLookups');
  const old = '2024-01-01T00:00:00.000Z';
  const curated = { ...potatoLookup, durationDays: 21, sourceTitle: '미국 농무부',
    sourceUrl: null, sourceCheckedAt: old, evidenceType: 'curated', confidence: 0.85 };
  const estimated = { ...potatoLookup, durationDays: 14, sourceTitle: 'AI추정',
    sourceUrl: null, sourceCheckedAt: old, evidenceType: 'ai_estimated', confidence: 0.3 };
  assert.equal(partition([potatoLookup], [curated], new Date('2026-09-21')).hits.length, 1);
  assert.equal(partition([potatoLookup], [estimated], new Date('2026-09-21')).misses.length, 1);
});

test('AI-only last resort has no web tool, accepts no URL, and rejects invented durations', () => {
  const build = Reflect.get(shelfLife, 'buildShelfLifeEstimateRequest');
  const parse = Reflect.get(shelfLife, 'parseShelfLifeEstimateResponse');
  const request = build([potatoLookup]);
  assert.equal(request.model, 'gpt-5.6-terra');
  assert.equal(request.tools, undefined);
  assert.equal(request.store, false);
  const good = { ...potatoLookup, durationDays: 21, confidence: 0.8 };
  assert.deepEqual(parse({ rules: [good, { ...good, durationDays: 99999 }] }), [{
    ...good, confidence: 0.4, sourceTitle: 'AI추정', sourceUrl: null,
    evidenceType: 'ai_estimated',
  }]);
});

test('web search results are accepted only when their HTTPS source was retrieved', () => {
  const parseShelfLifeSearchResponse = Reflect.get(shelfLife, 'parseShelfLifeSearchResponse');
  assert.equal(typeof parseShelfLifeSearchResponse, 'function');

  const response = {
    rules: [
      {
        ...potatoLookup,
        durationDays: 14,
        sourceTitle: '공식 보관 안내',
        sourceUrl: 'https://foods.example.org/potato',
        confidence: 0.91,
      },
      {
        canonicalKey: '즉석밥', canonicalName: '즉석밥', category: 'prepared',
        storageMethod: 'room_temperature', packageState: 'unopened', durationDays: 270,
        sourceTitle: '출처 없는 값', sourceUrl: 'https://invented.example/rice', confidence: 0.99,
      },
    ],
  };

  assert.deepEqual(
    parseShelfLifeSearchResponse(response, new Set(['https://foods.example.org/potato'])),
    [response.rules[0]],
  );
});

test('retrieved source URL query and trailing slash do not invalidate the same cited page', () => {
  const parse = Reflect.get(shelfLife, 'parseShelfLifeSearchResponse');
  const response = { rules: [{ ...potatoLookup, durationDays: 14,
    sourceTitle: '공식 보관 안내', sourceUrl: 'https://foods.example.org/potato/', confidence: 0.91 }] };
  const rules = parse(response, new Set(['https://foods.example.org/potato?utm_source=search']));
  assert.equal(rules.length, 1);
  assert.equal(rules[0].sourceUrl, 'https://foods.example.org/potato/');
});

test('a sourced four-to-eight-week range caches the conservative four-week duration', () => {
  const parse = Reflect.get(shelfLife, 'parseShelfLifeSearchResponse');
  const response = { rules: [{ ...potatoLookup, durationDays: 56, rangeEndDays: 28,
    sourceTitle: '감자 보관 안내', sourceUrl: 'https://foods.example.org/potato', confidence: 0.91 }] };
  const [rule] = parse(response, new Set(['https://foods.example.org/potato']));
  assert.equal(rule.durationDays, 28);
});

test('shelf-life search request uses bounded web search and privacy controls', () => {
  const buildShelfLifeSearchRequest = Reflect.get(shelfLife, 'buildShelfLifeSearchRequest');
  assert.equal(typeof buildShelfLifeSearchRequest, 'function');

  const request = buildShelfLifeSearchRequest([potatoLookup]);
  assert.equal(request.model, 'gpt-5.6-terra');
  assert.equal(request.store, false);
  assert.deepEqual(request.tools, [{ type: 'web_search' }]);
  assert.deepEqual(request.include, ['web_search_call.action.sources']);
  assert.equal(request.max_tool_calls, 3);
  assert.equal(request.text.format.strict, true);
});

test('fallback date is conservative and always requires user review', () => {
  const buildShelfLifeFallback = Reflect.get(shelfLife, 'buildShelfLifeFallback');
  assert.equal(typeof buildShelfLifeFallback, 'function');

  assert.deepEqual(buildShelfLifeFallback(potatoLookup, '2026-09-10'), {
    recommendedUseBy: null,
    shelfLifeStatus: 'fallback',
    needsReview: true,
    internalNote: '검증된 공용 권장 소진일 기준을 찾지 못했습니다. 제품 표시일을 직접 입력해주세요.',
  });
});

test('cached shelf-life rule enriches a food item without forcing review', () => {
  const enrichItemsWithShelfLife = Reflect.get(shelfLife, 'enrichItemsWithShelfLife');
  assert.equal(typeof enrichItemsWithShelfLife, 'function');

  const items = [{ foodName: '즉석밥', category: 'prepared', needsReview: false, note: null, isFood: true }];
  const rules = [{
    canonicalKey: '즉석밥', canonicalName: '즉석밥', category: 'prepared',
    storageMethod: 'room_temperature', packageState: 'unopened', durationDays: 270,
    sourceTitle: '즉석밥 보관 안내', sourceUrl: 'https://foods.example.org/rice',
    sourceCheckedAt: '2026-09-10T00:00:00.000Z', confidence: 0.94,
  }];

  assert.deepEqual(enrichItemsWithShelfLife(items, rules, '2026-09-10'), [{
    ...items[0],
    recommendedUseBy: '2027-06-07',
    shelfLifeStatus: 'cached',
    storageMethod: 'room_temperature',
    packageState: 'unopened',
    internalNote: null,
  }]);
});

test('unopened room-temperature instant rice uses a conservative six-month curated rule', () => {
  const defaultShelfLifeLookup = Reflect.get(shelfLife, 'defaultShelfLifeLookup');
  const curatedShelfLifeRules = Reflect.get(shelfLife, 'curatedShelfLifeRules');
  const enrichItemsWithShelfLife = Reflect.get(shelfLife, 'enrichItemsWithShelfLife');
  assert.equal(typeof curatedShelfLifeRules, 'function');

  const lookup = defaultShelfLifeLookup('즉석밥', 'prepared');
  const rules = curatedShelfLifeRules([lookup], '2026-09-11T00:00:00.000Z');
  assert.equal(rules.length, 1);
  assert.equal(rules[0].durationDays, 180);
  assert.equal(rules[0].sourceUrl, 'https://www.cj.co.kr/kr/support/faq/1939');

  const [item] = enrichItemsWithShelfLife([
    { foodName: '즉석밥', category: 'prepared', needsReview: false, note: null, isFood: true },
  ], rules, '2026-09-11');
  assert.equal(item.recommendedUseBy, '2027-03-10');
  assert.equal(item.shelfLifeStatus, 'cached');
});

test('missing shelf-life rule keeps the food editable and review-required', () => {
  const enrichItemsWithShelfLife = Reflect.get(shelfLife, 'enrichItemsWithShelfLife');
  assert.equal(typeof enrichItemsWithShelfLife, 'function');

  const items = [{ foodName: '감자', category: 'storage_vegetable', needsReview: false, note: null, isFood: true }];
  const [result] = enrichItemsWithShelfLife(items, [], '2026-09-10');
  assert.equal(result.recommendedUseBy, null);
  assert.equal(result.shelfLifeStatus, 'fallback');
  assert.equal(result.needsReview, true);
  assert.match(result.internalNote, /공용 권장 소진일 기준/);
});

test('explicit frozen or refrigerated wording selects a separate cache key for every food', () => {
  const lookupForItem = Reflect.get(shelfLife, 'shelfLifeLookupForItem');
  assert.equal(typeof lookupForItem, 'function');
  const frozen = lookupForItem({ productName: '냉동 브로콜리 300g', foodName: '브로콜리', category: 'vegetable' });
  const chilled = lookupForItem({ productName: '냉장 브로콜리 300g', foodName: '브로콜리', category: 'vegetable' });
  const plain = lookupForItem({ productName: '브로콜리 300g', foodName: '브로콜리', category: 'vegetable' });
  assert.equal(frozen.storageMethod, 'frozen');
  assert.equal(chilled.storageMethod, 'refrigerated');
  assert.equal(plain.storageMethod, 'refrigerated');
  assert.notEqual(shelfLife.canonicalShelfLifeKey(frozen.canonicalKey, frozen.storageMethod, frozen.packageState),
    shelfLife.canonicalShelfLifeKey(chilled.canonicalKey, chilled.storageMethod, chilled.packageState));
});

test('frozen cache rule enriches frozen fish but not fresh fish', () => {
  const enrich = Reflect.get(shelfLife, 'enrichItemsWithShelfLife');
  const rules = [{ canonicalKey: '고등어', canonicalName: '고등어', category: 'fresh_meat',
    storageMethod: 'frozen', packageState: 'unopened', durationDays: 90,
    sourceTitle: '시험 근거', sourceUrl: 'https://example.org/fish', sourceCheckedAt: '2026-09-10', confidence: 0.9 }];
  const items = [
    { productName: '냉동 고등어', foodName: '고등어', category: 'fresh_meat', needsReview: false, note: null, isFood: true },
    { productName: '냉장 고등어', foodName: '고등어', category: 'fresh_meat', needsReview: false, note: null, isFood: true },
  ];
  const result = enrich(items, rules, '2026-09-10');
  assert.equal(result[0].recommendedUseBy, '2026-12-09');
  assert.equal(result[1].recommendedUseBy, null);
});

test('conflicting storage wording requires manual review instead of guessing frozen', () => {
  const enrich = Reflect.get(shelfLife, 'enrichItemsWithShelfLife');
  const [item] = enrich([
    { productName: '냉동 보관 후 냉장 고등어', foodName: '고등어', category: 'fresh_meat', needsReview: false, note: null, isFood: true },
  ], [], '2026-09-10');
  assert.equal(item.recommendedUseBy, null);
  assert.equal(item.storageMethod, null);
  assert.equal(item.needsReview, true);
});

test('retrieved web source URLs are extracted from tool sources and citations', () => {
  const extractWebSourceUrls = Reflect.get(shelfLife, 'extractWebSourceUrls');
  assert.equal(typeof extractWebSourceUrls, 'function');

  const result = extractWebSourceUrls({
    output: [
      { type: 'web_search_call', action: { sources: [{ url: 'https://foods.example.org/a' }] } },
      { type: 'message', content: [{ annotations: [{ type: 'url_citation', url: 'https://foods.example.org/b' }] }] },
    ],
  });
  assert.deepEqual([...result].sort(), ['https://foods.example.org/a', 'https://foods.example.org/b']);
});
