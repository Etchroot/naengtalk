import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const raw=JSON.parse(readFileSync(new URL('./results.json',import.meta.url)));
const summary=JSON.parse(readFileSync(new URL('./summary.json',import.meta.url)));
assert.equal(raw.errors.length,0);
assert.equal(raw.cold.length,4);
assert.equal(raw.warmups.length,12);
assert.equal(raw.measurements.length,360);
assert.equal(raw.concurrent.length,48);
const counts={single:1,ocr4:4,menu8:8};
const bytes=new Map();
for(const row of [...raw.cold,...raw.warmups,...raw.measurements,...raw.concurrent]){
  assert.equal(row.status,200);
  assert.equal(row.observedRegion,row.requestedRegion);
  assert.equal(row.edgeHeader,row.requestedRegion);
  assert.equal(row.samples.length,counts[row.profile]);
  assert.ok(row.totalMs>0 && row.clientMs>0);
  for(const stage of row.samples){
    assert.equal(stage.status,200);
    assert.ok(stage.ms>0 && stage.bytes>0);
    if(bytes.has(stage.operation)) assert.equal(stage.bytes,bytes.get(stage.operation),'Response size differs between samples');
    bytes.set(stage.operation,stage.bytes);
  }
}
for(const cell of summary.mixed) assert.equal(cell.serverMs.n,30);
for(const cell of summary.concurrent) assert.equal(cell.serverMs.n,12);
assert.equal(summary.mixed.length,12);
assert.equal(summary.concurrent.length,4);
console.log(JSON.stringify({validatedFunctionRequests:424,validatedMixedSamples:360,errors:0,
  operationResponseBytes:Object.fromEntries(bytes)},null,2));
