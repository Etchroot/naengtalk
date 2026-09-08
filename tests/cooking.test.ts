import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeCooking, remainingSeconds } from '../mobile/src/domain/cooking.ts';
import { createGuestInventory } from '../mobile/src/domain/seed.ts';

const inventory = [{ id: 'tofu', name: '두부', quantity: 300, unit: 'g', useBy: '2026-09-11', estimated: true }];
const initial = () => ({ inventory: structuredClone(inventory), completedSessionIds: [] as string[] });
const usage = [{ ingredientId: 'tofu', quantity: 100, unit: 'g' }];
test('cooking deducts inventory without changing the previous state', () => {
  const before = initial();
  const result = completeCooking(before, 'session-1', usage);
  assert.equal(result.inventory[0].quantity, 200);
  assert.equal(before.inventory[0].quantity, 300);
});
test('same completion is idempotent but cooking again deducts again', () => {
  const once = completeCooking(initial(), 'session-1', usage);
  const duplicate = completeCooking(once, 'session-1', usage);
  assert.equal(duplicate.inventory[0].quantity, 200);
  const twice = completeCooking(duplicate, 'session-2', usage);
  assert.equal(twice.inventory[0].quantity, 100);
});
test('shortage leaves all inventory unchanged', () => {
  const before = initial();
  assert.throws(() => completeCooking(before, 'session-1', [...usage, { ingredientId: 'egg', quantity: 1, unit: '개' }]), /부족/);
  assert.deepEqual(before, initial());
});
test('duplicate ingredient lines cannot bypass available stock', () => {
  assert.throws(() => completeCooking(initial(), 'session', [usage[0], { ...usage[0], quantity: 250 }]), /부족/);
});
test('rejects negative, zero, nonfinite and mismatched unit usage', () => {
  for (const quantity of [-1, 0, NaN, Infinity]) {
    assert.throws(() => completeCooking(initial(), 's', [{ ...usage[0], quantity }]), /수량/);
  }
  assert.throws(() => completeCooking(initial(), 's', [{ ...usage[0], unit: '개' }]), /단위/);
  assert.throws(() => completeCooking(initial(), '', usage), /세션/);
  assert.throws(() => completeCooking(initial(), 's', []), /사용 재료/);
});
test('timer catches up from wall clock after tab suspension and never becomes negative', () => {
  assert.equal(remainingSeconds(61000, 1000), 60);
  assert.equal(remainingSeconds(61000, 60500), 1);
  assert.equal(remainingSeconds(61000, 90000), 0);
});
test('guest seed contains usable independent inventory including essentials', () => {
  const a = createGuestInventory('2026-09-08');
  const b = createGuestInventory('2026-09-08');
  assert.ok(a.length >= 10);
  for (const name of ['계란', '간장', '된장']) assert.ok(a.some(item => item.name === name && item.quantity > 0));
  a[0].quantity = 0;
  assert.equal(b[0].quantity, 300);
  assert.equal(b[0].useBy, '2026-09-11');
});
