import { test } from 'node:test';
import assert from 'node:assert/strict';

const guestDemoModule = await import('../mobile/src/domain/guest-demo.ts').catch(() => ({}));

test('remote guest reset replaces the server inventory instead of showing a local-only sample', async () => {
  const resetGuestDemoInventory = Reflect.get(guestDemoModule, 'resetGuestDemoInventory');
  assert.equal(typeof resetGuestDemoInventory, 'function');

  let serverInventory = [
    { id: 'unexpected-rice', name: '추가한 적 없는 즉석밥', quantity: 1, unit: '개', useBy: '2027-01-01', estimated: true },
  ];
  const canonicalSeed = [
    { id: 'egg-lot', name: '계란', quantity: 10, unit: '개', useBy: '2026-09-19', estimated: true },
  ];

  const result = await resetGuestDemoInventory({
    mode: 'supabase',
    date: '2026-09-12',
    resetRemote: async () => {
      serverInventory = structuredClone(canonicalSeed);
    },
    loadRemote: async () => structuredClone(serverInventory),
  });

  assert.deepEqual(result, canonicalSeed);
});

test('local guest reset builds the sample without touching remote data', async () => {
  const resetGuestDemoInventory = Reflect.get(guestDemoModule, 'resetGuestDemoInventory');
  assert.equal(typeof resetGuestDemoInventory, 'function');

  let remoteTouched = false;
  const result = await resetGuestDemoInventory({
    mode: 'local',
    date: '2026-09-12',
    resetRemote: async () => {
      remoteTouched = true;
    },
    loadRemote: async () => {
      remoteTouched = true;
      return [];
    },
  });

  assert.equal(remoteTouched, false);
  assert.equal(result.length, 10);
  assert.equal(result.some((item: { name: string }) => item.name === '계란'), true);
});
