import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const packagePath = new URL('../mobile/package.json', import.meta.url);
const appJsonPath = new URL('../mobile/app.json', import.meta.url);
const deadWebBadgePath = new URL('../mobile/src/components/web-badge.tsx', import.meta.url);
const deadR2Path = new URL('../mobile/assets/demo/purchases/r2.jpg', import.meta.url);
const modelPath = new URL('../mobile/src/features/naengtalk/model.ts', import.meta.url);
const buttonPath = new URL('../mobile/src/features/naengtalk/components/app-button.tsx', import.meta.url);
const headerPath = new URL('../mobile/src/features/naengtalk/components/app-header.tsx', import.meta.url);
const navigationPath = new URL('../mobile/src/features/naengtalk/components/bottom-navigation.tsx', import.meta.url);
const containerPath = new URL('../mobile/src/features/NaengTalk.tsx', import.meta.url);

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

test('shared naengtalk modules own model and navigation chrome', () => {
  const containerSource = readFileSync(containerPath, 'utf8');

  assert.equal(existsSync(modelPath), true);
  assert.equal(existsSync(buttonPath), true);
  assert.equal(existsSync(headerPath), true);
  assert.equal(existsSync(navigationPath), true);
  assert.match(containerSource, /createInitialState/);
  assert.match(containerSource, /<BottomNavigation/);
});
