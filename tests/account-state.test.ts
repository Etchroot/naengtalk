import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState } from '../mobile/src/features/naengtalk/model.ts';

test('a Google user starts without judge pantry, tools, or allergy defaults', () => {
  const state = createInitialState(new Date('2026-09-28T00:00:00Z'), false);
  assert.deepEqual(state.inventory, []);
  assert.deepEqual(state.tools, []);
  assert.deepEqual(state.allergens, []);
});

test('the web judge guest still receives its seeded experience', () => {
  const state = createInitialState(new Date('2026-09-28T00:00:00Z'), true);
  assert.equal(state.inventory.length, 30);
  assert.equal(state.tools.length, 16);
  assert.deepEqual(state.allergens, ['새우']);
});
