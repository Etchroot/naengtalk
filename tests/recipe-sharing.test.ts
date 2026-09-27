import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function readTree(path: string): string {
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory()
      ? [readTree(join(path, entry.name))]
      : /\.(ts|tsx)$/.test(entry.name)
        ? [readFileSync(join(path, entry.name), 'utf8')]
        : [])
    .join('\n');
}

const featureSources = readTree(fileURLToPath(new URL('../mobile/src/features', import.meta.url)));

const sharing = await import('../mobile/src/domain/recipe-sharing.ts').catch(() => ({}));
const cooking = await import('../mobile/src/domain/remote-cooking.ts');

test('only AI-generated recipes can be shared', () => {
  assert.equal(sharing.canShareRecipe?.({ origin: 'AI_GENERATED' }), true);
  assert.equal(sharing.canShareRecipe?.({ origin: 'MFDS' }), false);
  assert.equal(sharing.canShareRecipe?.({ origin: 'SHARED_AI' }), false);
  assert.equal(sharing.canShareRecipe?.({}), false);
});

test('confirmed like before cooking remains local intent, completion carries it atomically', () => {
  assert.equal(typeof sharing.shareAfterCompletion, 'function');
  assert.equal(sharing.shareAfterCompletion({ origin: 'AI_GENERATED' }, true, false), true);
  assert.equal(sharing.shareAfterCompletion({ origin: 'AI_GENERATED' }, false, false), false);
  assert.equal(sharing.shareAfterCompletion({ origin: 'MFDS' }, true, false), false);
  const payload = cooking.buildRemoteCookingRequest({
    title: '달걀밥', content: { origin: 'AI_GENERATED' }, requestKey: 'cooking-12345678',
    usage: [{ ingredientId: 'egg', quantity: 1, unit: '개' }], shareAfterCompletion: true,
  });
  assert.equal(payload.share_after_completion, true);
});

test('new proposal clears pending like and saved recipe identity', () => {
  assert.deepEqual(sharing.newProposalSharingState?.(), {
    sharePending: false, shared: false, savedRecipeId: null,
  });
});

test('recipe detail exposes the exact sharing consent copy and an empty-to-yellow thumb', () => {
  assert.match(featureSources, /좋아요 표시를 하면 이 레시피가 다른 사용자도 이용할 수 있도록 공유됩니다\./);
  assert.match(featureSources, /<ThumbsUp/);
  assert.match(featureSources, /state\.sharePending \|\| state\.shared \? "#FFD64D" : "transparent"/);
  assert.match(featureSources, /<Button onPress=\{startUsageReview\}>요리 완료<\/Button>/);
});
