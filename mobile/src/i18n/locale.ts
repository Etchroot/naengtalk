export type AppLocale = 'ko' | 'en';

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'ko' || value === 'en';
}

export function resolvePreferredLocale(preferences: readonly string[]): AppLocale {
  const first = preferences.find((value) => typeof value === 'string' && value.trim());
  return first && /^ko(?:[-_]|$)/i.test(first.trim()) ? 'ko' : 'en';
}

export function getDeviceLocale(): AppLocale {
  const browserLanguages = globalThis.navigator?.languages;
  if (browserLanguages?.length) return resolvePreferredLocale(browserLanguages);

  try {
    return resolvePreferredLocale([Intl.DateTimeFormat().resolvedOptions().locale]);
  } catch {
    return 'en';
  }
}
