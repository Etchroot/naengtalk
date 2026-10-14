import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cli = process.env.BENCH_SUPABASE_CLI;
if (!cli) throw new Error('BENCH_SUPABASE_CLI required');
const targets = [
  { db: 'Singapore', ref: 'ygdbvbjvnnoxyjeidnnj', dbRegion: 'ap-southeast-1' },
  { db: 'Seoul', ref: 'oeghpjqtjnqhaxqeuimk', dbRegion: 'ap-northeast-2' },
];
// Credentials remain in memory and are never included in saved results or logs.
for (const target of targets) {
  const keys = JSON.parse(execFileSync(cli, ['projects', 'api-keys', '--project-ref', target.ref, '--output', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  target.key = keys.find(key => key.name === 'anon')?.api_key;
  if (!target.key) throw new Error(`Missing legacy anon key for ${target.db}`);
}
const cells = targets.flatMap(target => ['ap-northeast-2', 'ap-southeast-1'].map(region => ({ ...target, region })));
const output = { timestamp: new Date().toISOString(), source: 'local Windows runner; server-side DB timings measured inside specified Supabase Edge region',
  methodology: 'Identical synthetic fixture/RPC. Profiles represent sequential request counts and response sizes, not production SQL, Auth, or AI latency.',
  cold: [], warmups: [], measurements: [], concurrent: [], errors: [] };
async function sample(cell, profile, bucket, round) {
  const before = performance.now();
  try {
    const response = await fetch(`https://${cell.ref}.supabase.co/functions/v1/region-bench-20261013`, {
      method: 'POST', headers: { apikey: cell.key, authorization: `Bearer ${cell.key}`,
        'Content-Type': 'application/json', 'x-region': cell.region },
      body: JSON.stringify({ profile }), signal: AbortSignal.timeout(45000),
    });
    const payload = await response.json();
    const row = { db: cell.db, requestedRegion: cell.region, observedRegion: payload.region,
      edgeHeader: response.headers.get('x-sb-edge-region'), profile, round,
      clientMs: performance.now()-before, status: response.status, ...payload };
    if (!response.ok || payload.region !== cell.region || payload.samples?.some(s => s.status !== 200)) {
      output.errors.push(row);
      throw new Error(`Invalid ${cell.db}/${cell.region}/${profile}: HTTP ${response.status}, region ${payload.region}`);
    }
    bucket.push(row);
    return row;
  } catch (error) {
    throw new Error(`Benchmark failed for ${cell.db}/${cell.region}/${profile}: ${error.message}`);
  }
}
const save = () => writeFileSync(fileURLToPath(new URL('./results.json', import.meta.url)), JSON.stringify(output, null, 2));
try {
  for (const cell of cells) await sample(cell, 'single', output.cold, 0);
  for (let i=0;i<3;i++) for (const cell of cells) await sample(cell, 'menu8', output.warmups, i);
  // Alternate database/region order and profile order to reduce time-order bias.
  for (let round=0;round<30;round++) {
    const profiles = ['single','ocr4','menu8'];
    for (let index=0;index<4;index++) {
      const cell = cells[(index+round)%4];
      for (let p=0;p<3;p++) await sample(cell, profiles[(p+round)%3], output.measurements, round);
    }
    save();
    if ((round+1)%5===0) console.log(`Warm mixed rounds ${round+1}/30 complete`);
  }
  for (const cell of cells) {
    for (let round=0;round<3;round++) await Promise.all(Array.from({length:4}, () => sample(cell, 'menu8', output.concurrent, round)));
    console.log(`4-concurrent menu8 complete: ${cell.db}/${cell.region}`);
    save();
  }
} finally { save(); }
function stats(rows, field) {
  const values=rows.map(r=>r[field]).sort((a,b)=>a-b);
  return { n:values.length, p50:values[Math.ceil(values.length*.5)-1], p95:values[Math.ceil(values.length*.95)-1],
    mean:values.reduce((a,b)=>a+b,0)/values.length, max:values.at(-1) };
}
const summary = { timestamp:output.timestamp, errors:output.errors.length,
  mixed:cells.flatMap(cell=>['single','ocr4','menu8'].map(profile=>({ db:cell.db, region:cell.region, profile,
    serverMs:stats(output.measurements.filter(r=>r.db===cell.db&&r.requestedRegion===cell.region&&r.profile===profile),'totalMs'),
    clientMs:stats(output.measurements.filter(r=>r.db===cell.db&&r.requestedRegion===cell.region&&r.profile===profile),'clientMs') }))),
  concurrent:cells.map(cell=>({db:cell.db,region:cell.region,
    serverMs:stats(output.concurrent.filter(r=>r.db===cell.db&&r.requestedRegion===cell.region),'totalMs')})) };
writeFileSync(fileURLToPath(new URL('./summary.json',import.meta.url)),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
