import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import configureApp from '../mobile/app.config.ts';

const appConfig = JSON.parse(
  readFileSync(new URL('../mobile/app.json', import.meta.url), 'utf8'),
);
const easConfig = JSON.parse(
  readFileSync(new URL('../mobile/eas.json', import.meta.url), 'utf8'),
);

test('Android has a stable Play package and separate device and store artifacts', () => {
  assert.equal(appConfig.expo.android.package, 'com.naengtalk.app');
  assert.equal(easConfig.build.preview.distribution, 'internal');
  assert.equal(easConfig.build.preview.android.buildType, 'apk');
  assert.equal(easConfig.build.production.android.buildType, 'app-bundle');
});

test('image picker does not request unused Android microphone permission', () => {
  const imagePickerPlugin = appConfig.expo.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
  );

  assert.ok(imagePickerPlugin, 'expo-image-picker plugin must be configured');
  assert.equal(imagePickerPlugin[1].microphonePermission, false);
});

test('preview uses Google sample ads and delays measurement until consent', () => {
  const previousProfile = process.env.EAS_BUILD_PROFILE;
  try {
    process.env.EAS_BUILD_PROFILE = 'preview';
    const config = configureApp({ config: appConfig.expo });
    const plugin = config.plugins?.find(
      (item: unknown) => Array.isArray(item) && item[0] === 'react-native-google-mobile-ads',
    ) as [string, { androidAppId: string; delayAppMeasurementInit: boolean }];
    assert.equal(plugin[1].androidAppId, 'ca-app-pub-3940256099942544~3347511713');
    assert.equal(plugin[1].delayAppMeasurementInit, true);
    assert.equal(config.extra?.admobTestMode, true);
  } finally {
    if (previousProfile === undefined) delete process.env.EAS_BUILD_PROFILE;
    else process.env.EAS_BUILD_PROFILE = previousProfile;
  }
});

test('production rejects missing or sample AdMob identifiers', () => {
  const previous = {
    profile: process.env.EAS_BUILD_PROFILE,
    appId: process.env.ADMOB_ANDROID_APP_ID,
    unitId: process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID,
  };
  try {
    process.env.EAS_BUILD_PROFILE = 'production';
    delete process.env.ADMOB_ANDROID_APP_ID;
    delete process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID;
    assert.throws(() => configureApp({ config: appConfig.expo }), /require real/);
    process.env.ADMOB_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
    process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';
    assert.throws(() => configureApp({ config: appConfig.expo }), /require real/);
    process.env.ADMOB_ANDROID_APP_ID = 'ca-app-pub-1111111111111111~2222222222';
    process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID = 'ca-app-pub-1111111111111111/3333333333';
    assert.equal(configureApp({ config: appConfig.expo }).extra?.admobTestMode, false);
  } finally {
    for (const [key, value] of [
      ['EAS_BUILD_PROFILE', previous.profile],
      ['ADMOB_ANDROID_APP_ID', previous.appId],
      ['EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID', previous.unitId],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
