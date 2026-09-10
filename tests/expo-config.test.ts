import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appConfig = JSON.parse(
  readFileSync(new URL('../mobile/app.json', import.meta.url), 'utf8'),
);

test('image picker does not request unused Android microphone permission', () => {
  const imagePickerPlugin = appConfig.expo.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
  );

  assert.ok(imagePickerPlugin, 'expo-image-picker plugin must be configured');
  assert.equal(imagePickerPlugin[1].microphonePermission, false);
});
