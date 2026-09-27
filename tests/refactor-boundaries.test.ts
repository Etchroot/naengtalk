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
const screenPaths = [
  'login-screen.tsx',
  'home-screen.tsx',
  'chat-screen.tsx',
  'inventory-screen.tsx',
  'recipes-screen.tsx',
  'tools-screen.tsx',
  'settings-screen.tsx',
].map((name) => new URL(`../mobile/src/features/naengtalk/screens/${name}`, import.meta.url));
const modalPaths = [
  'chat-inventory-review-modal.tsx',
  'recipe-detail-modal.tsx',
  'overdraw-confirm-modal.tsx',
  'share-consent-modal.tsx',
  'inventory-sort-modal.tsx',
  'purchase-registration-modal.tsx',
].map((name) => new URL(`../mobile/src/features/naengtalk/modals/${name}`, import.meta.url));

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

test('screens are presentational and never import services', () => {
  const containerSource = readFileSync(containerPath, 'utf8');
  for (const path of screenPaths) {
    assert.equal(existsSync(path), true);
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /from ["'].*\/services\//);
    assert.doesNotMatch(source, /supabase/i);
  }
  assert.match(containerSource, /<HomeScreen/);
  assert.match(containerSource, /<ChatScreen/);
  assert.match(containerSource, /<SettingsScreen/);
});

test('modal modules do not call remote services and expose explicit actions', () => {
  for (const path of modalPaths) {
    assert.equal(existsSync(path), true);
    assert.doesNotMatch(readFileSync(path, 'utf8'), /from ["'].*\/services\//);
  }
  const purchaseModalSource = readFileSync(modalPaths[5], 'utf8');
  const recipeModalSource = readFileSync(modalPaths[1], 'utf8');
  assert.match(purchaseModalSource, /onClose/);
  assert.match(purchaseModalSource, /onAnalyze/);
  assert.match(purchaseModalSource, /onRegister/);
  assert.match(recipeModalSource, /onFinishCooking/);
  assert.match(recipeModalSource, /onConfirmShare/);
});
