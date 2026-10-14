// Temporary benchmark: bounded requests, synthetic rows, no OpenAI calls.
const profiles: Record<string, [string, string][]> = {
  single: [['inventory', 'inventory']],
  ocr4: [['auth-shape', 'ping'], ['rate-limit-shape', 'write'], ['cache-read-shape', 'inventory'], ['cache-write-shape', 'write']],
  menu8: [['auth-shape', 'ping'], ['rate-limit-shape', 'write'], ['inventory', 'inventory'],
    ['catalog', 'candidates'], ['shared', 'candidates'], ['detail', 'detail'],
    ['repair-detail', 'detail'], ['trace-write-shape', 'write']],
};
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('POST only', { status: 405 });
  const input = await request.json().catch(() => ({}));
  const stages = profiles[input.profile];
  if (!stages) return new Response('invalid profile', { status: 400 });
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const samples = [];
  const start = performance.now();
  for (const [stage, operation] of stages) {
    const before = performance.now();
    const response = await fetch(`${url}/rest/v1/rpc/bench_region_20261013`, {
      method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation }), signal: AbortSignal.timeout(15000),
    });
    const bytes = (await response.arrayBuffer()).byteLength;
    samples.push({ stage, operation, ms: performance.now()-before, status: response.status, bytes });
    if (!response.ok) return Response.json({ error: 'benchmark RPC failed', samples }, { status: 502 });
  }
  return Response.json({ profile: input.profile, region: Deno.env.get('SB_REGION'),
    totalMs: performance.now()-start, samples });
});
