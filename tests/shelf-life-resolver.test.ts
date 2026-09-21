import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShelfLifeForOcr } from '../supabase/functions/_shared/shelf-life-resolver.ts';

const names = ['배추', '무', '양파', '감자', '당근', '대파'];
const config = {
  supabaseUrl: 'https://example.supabase.co',
  serviceRoleKey: 'test-service-role',
  openAiKey: 'test-openai-key',
  baseDate: '2026-09-20',
};

function food(name: string) {
  return { foodName: name, productName: name, category: 'vegetable',
    needsReview: false, note: null, isFood: true };
}

function searchResponse(lookups: Array<{ canonicalKey: string; canonicalName: string;
  category: string; storageMethod: string; packageState: string }>) {
  const rules = lookups.map((lookup) => ({ ...lookup, durationDays: 28, rangeEndDays: 56,
    sourceTitle: `${lookup.canonicalName} 보관 안내`,
    sourceUrl: `https://foods.example.org/${encodeURIComponent(lookup.canonicalName)}`,
    confidence: 0.9 }));
  return {
    output_text: JSON.stringify({ rules }),
    output: [{ type: 'web_search_call', action: { sources: rules.map((rule) => ({ url: rule.sourceUrl })) } }],
  };
}

test('uncached foods are searched in small batches and all sourced dates are cached', async () => {
  const originalFetch = globalThis.fetch;
  const searched: string[][] = [];
  const written: Array<{ canonical_name: string; duration_days: number }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/rest/v1/shelf_life_rules') && (!init?.method || init.method === 'GET')) {
      return Response.json([]);
    }
    if (url.endsWith('/v1/responses')) {
      const body = JSON.parse(String(init?.body));
      const lookups = JSON.parse(body.input.split('\n').at(-1));
      searched.push(lookups.map((lookup: { canonicalName: string }) => lookup.canonicalName));
      return Response.json(searchResponse(lookups));
    }
    if (url.includes('/rest/v1/shelf_life_rules') && init?.method === 'POST') {
      written.push(...JSON.parse(String(init.body)));
      return new Response(null, { status: 201 });
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  try {
    const result = await resolveShelfLifeForOcr({ items: names.map(food) }, config);
    const items = result.items as Array<{ recommendedUseBy: string | null }>;
    assert.deepEqual(items.map((item) => item.recommendedUseBy), names.map(() => '2026-10-18'));
    assert.equal(searched.flat().length, names.length);
    assert.ok(searched.every((batch) => batch.length <= 3));
    assert.equal(written.length, names.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('one failed web-search batch does not erase dates found for other foods', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/rest/v1/shelf_life_rules') && (!init?.method || init.method === 'GET')) {
      return Response.json([]);
    }
    if (url.endsWith('/v1/responses')) {
      const body = JSON.parse(String(init?.body));
      const lookups = JSON.parse(body.input.split('\n').at(-1));
      return lookups.some((lookup: { canonicalName: string }) => lookup.canonicalName === '배추')
        ? new Response(null, { status: 503 })
        : Response.json(searchResponse(lookups));
    }
    if (url.includes('/rest/v1/shelf_life_rules') && init?.method === 'POST') {
      return new Response(null, { status: 201 });
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  try {
    const result = await resolveShelfLifeForOcr({ items: names.slice(0, 4).map(food) }, config);
    const items = result.items as Array<{ recommendedUseBy: string | null }>;
    assert.deepEqual(items.map((item) => item.recommendedUseBy), [null, null, null, '2026-10-18']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('workbook curated storage and institution source beat default category and skip AI calls', async () => {
  const originalFetch = globalThis.fetch;
  let openAiCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/rest/v1/shelf_life_rules')) return Response.json([{
      canonical_key: '감자', canonical_name: '감자', category: 'storage_vegetable',
      storage_method: 'room_temperature', package_state: 'unpackaged', duration_days: 21,
      source_title: '미국 농무부', source_url: null, source_checked_at: '2024-01-01',
      evidence_type: 'curated', confidence: 0.85,
    }]);
    if (url.endsWith('/v1/responses')) openAiCalls++;
    throw new Error(`unexpected URL: ${url}`);
  };
  try {
    const result = await resolveShelfLifeForOcr({ items: [{ ...food('감자'), category: 'storage_vegetable' }] }, config);
    assert.equal((result.items as Array<{ recommendedUseBy: string }>)[0].recommendedUseBy, '2026-10-11');
    assert.equal((result.items as Array<{ storageMethod: string }>)[0].storageMethod, 'room_temperature');
    assert.equal(openAiCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('only after web has no verifiable result Terra estimates and stores AI provenance', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const written: Array<{ evidence_type: string; source_title: string; source_url: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/rest/v1/shelf_life_rules') && (!init?.method || init.method === 'GET'))
      return Response.json([]);
    if (url.endsWith('/v1/responses')) {
      const body = JSON.parse(String(init?.body));
      calls.push(body.tools ? 'web' : 'estimate');
      return Response.json({ output_text: JSON.stringify({ rules: body.tools ? [] : [{
        canonicalKey: '감자', canonicalName: '감자', category: 'storage_vegetable',
        storageMethod: 'refrigerated', packageState: 'unpackaged', durationDays: 14,
        confidence: 0.5,
      }] }), output: [] });
    }
    if (url.includes('/rest/v1/shelf_life_rules') && init?.method === 'POST') {
      written.push(...JSON.parse(String(init.body)));
      return new Response(null, { status: 201 });
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  try {
    const result = await resolveShelfLifeForOcr({ items: [{ ...food('감자'), category: 'storage_vegetable' }] }, config);
    assert.deepEqual(calls, ['web', 'estimate']);
    assert.equal((result.items as Array<{ recommendedUseBy: string }>)[0].recommendedUseBy, '2026-10-04');
    assert.equal(written[0].evidence_type, 'ai_estimated');
    assert.equal(written[0].source_title, 'AI추정');
    assert.equal(written[0].source_url, null);
  } finally { globalThis.fetch = originalFetch; }
});
