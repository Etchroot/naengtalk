import type { AppLocale } from './locale.ts';

type Message = string | { one: string; other: string };

const ko = {
  'app.preparing': '냉톡을 준비하고 있어요.',
  'language.title': '언어',
  'language.korean': '한국어',
  'language.english': 'English',
  'language.saveFailed': '언어 설정을 저장하지 못했습니다. 다시 시도해주세요.',
  'login.appName': '냉톡',
  'login.subtitle': '대화로 관리하는 냉장고와 레시피',
  'login.guest': '게스트 로그인(심사)',
  'login.google': '구글 로그인',
  'login.status.localWeb': '개발 검증 모드입니다. 현재 게스트 버튼은 기기 내 샘플을 열며 실제 익명 인증·AI는 아직 연결되지 않았습니다.',
  'login.status.localNative': '앱 로그인을 사용하려면 Supabase 연결 설정이 필요합니다.',
  'login.status.remoteWeb': '게스트마다 독립된 원격 재고를 생성하고 로그인 상태를 안전하게 복원합니다.',
  'login.status.remoteNative': 'Google 계정으로 로그인해 내 재고를 관리합니다.',
  'common.cancel': '취소',
  'common.confirm': '확인',
  'common.retry': '다시 시도',
  'errors.generic': '작업을 완료하지 못했습니다. 다시 시도해주세요.',
  'errors.named': '{name}을(를) 저장하지 못했습니다.',
  'inventory.itemCount': { one: '{count}개 항목', other: '{count}개 항목' },
} satisfies Record<string, Message>;

export type TranslationKey = keyof typeof ko;

const en: Record<TranslationKey, Message> = {
  'app.preparing': 'Getting NaengTalk ready.',
  'language.title': 'Language',
  'language.korean': '한국어',
  'language.english': 'English',
  'language.saveFailed': 'Could not save your language choice. Please try again.',
  'login.appName': 'NaengTalk',
  'login.subtitle': 'Your fridge and recipes, managed by conversation',
  'login.guest': 'Guest sign-in (review)',
  'login.google': 'Sign in with Google',
  'login.status.localWeb': 'Development preview: guest sign-in opens an on-device sample. Anonymous sign-in and AI are not connected yet.',
  'login.status.localNative': 'A Supabase connection is required to sign in to the app.',
  'login.status.remoteWeb': 'Each guest gets separate cloud inventory, and their sign-in is restored securely.',
  'login.status.remoteNative': 'Sign in with Google to manage your inventory.',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.retry': 'Try again',
  'errors.generic': 'Could not complete this action. Please try again.',
  'errors.named': 'Could not save {name}.',
  'inventory.itemCount': { one: '{count} item', other: '{count} items' },
};

export type TranslationVariables = Readonly<Record<string, string | number>>;

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  variables: TranslationVariables = {},
): string {
  const message = locale === 'ko' ? ko[key] : en[key];
  const template = typeof message === 'string'
    ? message
    : variables.count === 1 ? message.one : message.other;

  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, variable: string) => {
    const value = variables[variable];
    if (typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error(`Missing translation variable: ${variable}`);
    }
    return String(value);
  });
}
