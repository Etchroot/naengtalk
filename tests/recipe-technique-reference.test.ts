import { test } from 'node:test';
import assert from 'node:assert/strict';

const referenceModule = await import('../supabase/functions/_shared/recipe-technique-reference.ts').catch(() => ({}));

test('public detail becomes bounded technique evidence without amounts', () => {
  const toReference = Reflect.get(referenceModule, 'toTechniqueReference');
  assert.equal(typeof toReference, 'function');
  const reference = toReference({
    id: 'MFDS_1', origin: 'MFDS', title: '된장찌개', cookingMethod: '끓이기',
    ingredients: [{ name: '된장', amount: '30g' }, { name: '애호박', amount: '50g' }],
    steps: ['된장을 물에 푼다.', '재료를 순서대로 익힌다.'], tip: '충분히 끓인다.',
  });
  assert.deepEqual(reference, {
    id: 'MFDS_1', origin: 'MFDS', title: '된장찌개', cookingMethod: '끓이기',
    ingredientNames: ['된장', '애호박'],
    steps: ['된장을 물에 푼다.', '재료를 순서대로 익힌다.'], tip: '충분히 끓인다.',
  });
  assert.equal(JSON.stringify(reference).includes('30g'), false);
});

test('shared recipe content normalizes into the same technique shape', () => {
  const toReference = Reflect.get(referenceModule, 'toTechniqueReference');
  const reference = toReference({
    id: 'shared-1', origin: 'SHARED_AI', title: '두부국',
    content: {
      ingredients: [{ name: '두부', quantity: 100, unit: 'g' }],
      steps: [{ text: '두부를 썬다.', minutes: 0 }, { text: '국물이 끓으면 두부를 익힌다.', minutes: 5 }],
    },
  });
  assert.deepEqual(reference?.ingredientNames, ['두부']);
  assert.deepEqual(reference?.steps, ['두부를 썬다.', '국물이 끓으면 두부를 익힌다.']);
  assert.equal(reference?.cookingMethod, null);
});

test('technique reference rejects malformed origins and incomplete steps', () => {
  const toReference = Reflect.get(referenceModule, 'toTechniqueReference');
  assert.equal(toReference({
    id: 'x', origin: 'WEB', title: '요리', ingredients: [{ name: '두부' }], steps: ['하나', '둘'],
  }), null);
  assert.equal(toReference({
    id: 'x', origin: 'MFDS', title: '요리', ingredients: [{ name: '두부' }], steps: ['한 단계뿐'],
  }), null);
});

test('technique reference clamps untrusted strings and list sizes', () => {
  const toReference = Reflect.get(referenceModule, 'toTechniqueReference');
  const reference = toReference({
    id: 'x'.repeat(150), origin: 'MAFRA', title: '제목'.repeat(100),
    cookingMethod: '방식'.repeat(100), tip: '팁'.repeat(400),
    ingredients: Array.from({ length: 20 }, (_, index) => ({ name: `재료${index}`.repeat(30) })),
    steps: Array.from({ length: 20 }, (_, index) => `단계${index}${'가'.repeat(600)}`),
  });
  assert.equal(reference?.id.length, 100);
  assert.equal(reference?.title.length, 100);
  assert.equal(reference?.cookingMethod?.length, 60);
  assert.equal(reference?.tip?.length, 300);
  assert.equal(reference?.ingredientNames.length, 12);
  assert.equal(reference?.ingredientNames.every((name: string) => name.length <= 60), true);
  assert.equal(reference?.steps.length, 12);
  assert.equal(reference?.steps.every((step: string) => step.length <= 500), true);
});
