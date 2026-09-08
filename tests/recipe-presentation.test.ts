import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCookingStepTitle } from '../mobile/src/domain/recipe-presentation.ts';

test('cooking step titles describe sequence without repeating 조리 순서', () => {
  assert.equal(formatCookingStepTitle(0), '조리 단계 1');
  assert.equal(formatCookingStepTitle(3), '조리 단계 4');
});

test('cooking step title rejects an invalid index', () => {
  assert.throws(() => formatCookingStepTitle(-1), /단계/);
  assert.throws(() => formatCookingStepTitle(1.5), /단계/);
});
