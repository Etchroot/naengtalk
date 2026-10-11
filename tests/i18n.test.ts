import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreferredLocale } from '../mobile/src/i18n/locale.ts';
import { createLocalePreferenceStore } from '../mobile/src/i18n/preference.ts';
import { translate } from '../mobile/src/i18n/translate.ts';

test('preferred device language selects Korean only for Korean preferences', () => {
  assert.equal(resolvePreferredLocale(['ko-KR', 'en-US']), 'ko');
  assert.equal(resolvePreferredLocale(['en-CA', 'ko-KR']), 'en');
  assert.equal(resolvePreferredLocale(['fr-CA']), 'en');
  assert.equal(resolvePreferredLocale([]), 'en');
});

test('a saved language overrides device language across store instances and reset follows device again', async () => {
  const data = new Map<string, string>();
  const driver = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); },
    removeItem: async (key: string) => { data.delete(key); },
  };
  let deviceLocale: 'ko' | 'en' = 'en';
  const first = createLocalePreferenceStore(driver, () => deviceLocale);
  assert.equal(await first.load(), 'en');
  await first.save('ko');
  deviceLocale = 'en';
  const second = createLocalePreferenceStore(driver, () => deviceLocale);
  assert.equal(await second.load(), 'ko');
  await second.reset();
  assert.equal(await first.load(), 'en');
});

test('malformed saved language falls back to the current device language', async () => {
  const driver = {
    getItem: async () => 'fr-CA',
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
  assert.equal(await createLocalePreferenceStore(driver, () => 'ko').load(), 'ko');
});

test('translation uses the selected language and substitutes text literally', () => {
  assert.equal(translate('ko', 'common.cancel'), '취소');
  assert.equal(translate('en', 'common.cancel'), 'Cancel');
  assert.equal(translate('en', 'inventory.itemCount', { count: 2 }), '2 items');
  assert.equal(translate('en', 'inventory.itemCount', { count: 1 }), '1 item');
  assert.equal(translate('en', 'errors.named', { name: '<script>' }), 'Could not save <script>.');
});

test('translation rejects missing variables instead of leaking template tokens', () => {
  assert.throws(() => translate('en', 'errors.named'), /name/);
});

test('login and language controls have complete English and Korean copy', () => {
  assert.equal(translate('en', 'language.title'), 'Language');
  assert.equal(translate('ko', 'language.title'), '언어');
  assert.equal(translate('en', 'language.korean'), '한국어');
  assert.equal(translate('en', 'language.english'), 'English');
  assert.equal(translate('en', 'login.google'), 'Sign in with Google');
  assert.equal(translate('en', 'login.guest'), 'Guest sign-in (review)');
  assert.equal(translate('en', 'login.subtitle'), 'Your fridge and recipes, managed by conversation');
  assert.equal(translate('en', 'app.preparing'), 'Getting NaengTalk ready.');
});
