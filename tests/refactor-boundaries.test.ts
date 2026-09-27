import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const packagePath = new URL('../mobile/package.json', import.meta.url);
const appJsonPath = new URL('../mobile/app.json', import.meta.url);
const deadWebBadgePath = new URL('../mobile/src/components/web-badge.tsx', import.meta.url);
const deadR2Path = new URL('../mobile/assets/demo/purchases/r2.jpg', import.meta.url);

test('android foundations remain while expo demo files are absent', () => {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  const app = JSON.parse(readFileSync(appJsonPath, 'utf8')).expo;

  assert.equal(pkg.dependencies['expo-secure-store'], '^55.0.18');
  assert.equal(pkg.dependencies['expo-image-picker'], '~55.0.24');
  assert.equal(pkg.dependencies['expo-updates'], '~55.0.31');
  assert.equal(app.android.runtimeVersion.policy, 'appVersion');
  assert.ok(app.android.adaptiveIcon.foregroundImage);
  assert.equal(existsSync(deadWebBadgePath), false);
  assert.equal(existsSync(deadR2Path), false);
});
