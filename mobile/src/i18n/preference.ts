import { getDeviceLocale, isAppLocale, type AppLocale } from './locale.ts';

export type LocaleStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const LOCALE_KEY = 'naengtalk-ui-locale-v1';

export function createLocalePreferenceStore(
  storage: LocaleStorage,
  deviceLocale: () => AppLocale = getDeviceLocale,
) {
  return {
    async load(): Promise<AppLocale> {
      try {
        const saved = await storage.getItem(LOCALE_KEY);
        return isAppLocale(saved) ? saved : deviceLocale();
      } catch {
        return deviceLocale();
      }
    },
    async save(locale: AppLocale): Promise<void> {
      if (!isAppLocale(locale)) throw new RangeError('Unsupported app locale');
      await storage.setItem(LOCALE_KEY, locale);
    },
    async reset(): Promise<void> {
      await storage.removeItem(LOCALE_KEY);
    },
  };
}
