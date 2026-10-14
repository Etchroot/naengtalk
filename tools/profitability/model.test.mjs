import test from 'node:test';
import assert from 'node:assert/strict';
import './model.js';
const { calculate, defaults, expectedBatches } = globalThis.ProfitModel;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const quiet = { ...defaults, ocrPerUser: 0, textPerUser: 0, menuPerUser: 0, chatPerUser: 0, chatAddPerUser: 0, manualPerUser: 0, cookingPerUser: 0, sharePerUser: 0, readPerUser: 0, retryPct: 0, supabaseBase: 0, mau: 1000 };

test('ad revenue uses matched shown impressions, not visits or a per-second payout', () => {
  const r = calculate({ ...quiet, activeDays: 10, adSessions: 2, visibleSeconds: 45, requestAllowedPct: 80, matchPct: 50, showPct: 75, ecpm: 2 });
  close(r.adRequests, 16000); close(r.impressions, 6000); close(r.adRevenue, 12);
  close(calculate({ ...quiet, visibleSeconds: 0 }).adRevenue, 0);
  close(calculate({ ...quiet, androidPct: 0 }).adRevenue, 0);
});
test('refresh boundary and test mode', () => {
  const base = calculate({ ...quiet, visibleSeconds: 60, refreshSeconds: 60 });
  const next = calculate({ ...quiet, visibleSeconds: 61, refreshSeconds: 60 });
  close(next.impressions, base.impressions * 2);
  close(calculate({ ...quiet, visibleSeconds: 600, refreshEnabled: 0 }).impressions, base.impressions);
  close(calculate({ ...quiet, testAds: 1 }).adRevenue, 0);
  assert.equal(calculate({ ...quiet, testAds: 1 }).breakEvenEcpm, null);
});
test('each analysis batches its own cache misses; user requests are not pooled', () => {
  close(expectedBatches(3, 0.1), 1 - 0.9 ** 3);
  close(expectedBatches(4, 1), 2);
  close(expectedBatches(3, 0), 0);
  assert.ok(expectedBatches(50, 1 - 1e-8) > 16.99999);
  const r = calculate({ ...quiet, mau: 100, ocrPerUser: 1, uniqueItems: 1, shelfCachePct: 0, unverifiedPct: 100, searchTools: 3 });
  close(r.searchCalls, 300); close(r.aiCalls, 300); close(r.edgeInvocations, 100);
  const cached = calculate({ ...quiet, mau: 100, ocrPerUser: 1, shelfCachePct: 100 });
  close(cached.searchCalls, 0); close(cached.aiCalls, 100);
});
test('catalog hit remains one Terra; repair and chat-add call graph', () => {
  const menu = calculate({ ...quiet, mau: 1, menuPerUser: 1, catalogPct: 100, repairPct: 0 });
  close(menu.aiCalls, 2);
  close(menu.aiCost, (1800 * 0.2 + 200 * 1.2 + 3500 * 2 + 1000 * 12) / 1e6);
  close(calculate({ ...quiet, mau: 1, menuPerUser: 1, repairPct: 100 }).aiCalls, 3);
  const added = calculate({ ...quiet, mau: 1, chatAddPerUser: 1, shelfCachePct: 100 });
  close(added.aiCalls, 2); close(added.edgeInvocations, 2);
});
test('manual updates and cooking incur no AI; quotas still apply to server usage', () => {
  const r = calculate({ ...quiet, manualPerUser: 100, cookingPerUser: 10, egressKb: 1000, egressIncluded: 1, egressPrice: 0.09 });
  close(r.aiCost, 0); close(r.aiCalls, 0); close(r.edgeInvocations, 0);
  close(r.egressGb, 110); close(r.infraCost, 109 * 0.09);
});
test('Supabase overages bill only above included units', () => {
  const r = calculate({ ...quiet, supabaseBase: 25, mau: 110000, authIncluded: 100000, extraEdge: 3000000, edgeIncluded: 2000000 });
  close(r.infraCost, 25 + 10000 * 0.00325 + 2);
});
test('negative unit contribution has no growth break-even', () => {
  const r = calculate({ ...defaults, ecpm: 0.01 });
  assert.ok(r.contribution < 0); assert.equal(r.breakEvenUsers, null);
});
test('break-even solves quotas, including early positive interval before later overage slope', () => {
  const r = calculate({ ...quiet, ecpm: 100, supabaseBase: 25, authIncluded: 10, authPrice: 1 });
  assert.ok(r.breakEvenUsers !== null);
  assert.ok(calculate({ ...quiet, ecpm: 100, supabaseBase: 25, authIncluded: 10, authPrice: 1, mau: r.breakEvenUsers }).profit >= 0);
  const r2 = calculate({ ...quiet, ecpm: 1, supabaseBase: 25, authIncluded: 100, authPrice: 1 });
  assert.equal(r2.breakEvenUsers, null);
});
test('zero users, malformed numeric values, cached read and write costs are finite', () => {
  const zero = calculate({ ...defaults, mau: 0 });
  close(zero.aiCost, 0); close(zero.adRevenue, 0); assert.equal(zero.breakEvenEcpm, null);
  const bad = calculate({ ...defaults, mau: NaN, ecpm: -5, fx: Infinity });
  assert.ok(Number.isFinite(bad.profit));
  const read = calculate({ ...quiet, mau: 1, chatPerUser: 1, inputCachedPct: 100 });
  close(read.aiCost, (1800 * 0.02 + 200 * 1.2) / 1e6);
  const write = calculate({ ...quiet, mau: 1, chatPerUser: 1, inputCacheWritePct: 100 });
  close(write.aiCost, (1800 * 0.2 * 1.25 + 200 * 1.2) / 1e6);
});
test('component costs reconcile', () => {
  const r = calculate(defaults);
  close(r.rows.reduce((sum, x) => sum + x.cost, 0), r.totalCost);
  close(r.aiCost + r.infraCost, r.totalCost);
  close(r.adRevenue - r.totalCost, r.profit);
  close(r.featureCosts.reduce((sum, x) => sum + x.volume * x.unitCost, 0), r.aiCost);
});
