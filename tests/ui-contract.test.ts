import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

function readTree(path: string): string {
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory()
      ? [readTree(join(path, entry.name))]
      : /\.(ts|tsx)$/.test(entry.name)
        ? [readFileSync(join(path, entry.name), 'utf8')]
        : [])
    .join('\n');
}

const appSource = readTree(fileURLToPath(new URL('../mobile/src/features', import.meta.url)));
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
  assert.match(appSource, /accessibilityState=\{\{ disabled: aiBusy, busy: aiBusy \}\}/);
  assert.match(appSource, /aiBusy \? \(\s*<ActivityIndicator size="small" color="white" \/>/);
  assert.match(appSource, /loading=\{purchaseBusy\}/);
});
