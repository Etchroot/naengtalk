import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../mobile/src/features/NaengTalk.tsx', import.meta.url), 'utf8');
const themeSource = readFileSync(new URL('../mobile/src/features/theme.ts', import.meta.url), 'utf8');

test('app header removes environment banner and keeps a visual divider', () => {
  assert.doesNotMatch(appSource, /게스트 원격 재고 연결됨/);
  assert.match(themeSource, /borderBottomWidth:\s*1/);
});

test('recipe UI hides difficulty and external source cards', () => {
  assert.doesNotMatch(appSource, /activeRecipe\.difficulty/);
  assert.doesNotMatch(appSource, /참고한 레시피/);
});

test('AI waits use a visible native activity indicator', () => {
  assert.match(appSource, /ActivityIndicator/);
  assert.match(appSource, /loading=\{aiBusy\}/);
  assert.match(appSource, /loading=\{purchaseBusy\}/);
});
