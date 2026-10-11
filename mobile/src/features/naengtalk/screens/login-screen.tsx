import React from "react";
import { View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import { AppButton } from "../components/app-button.tsx";
import { LanguageSelector } from "../../../i18n/language-selector.tsx";
import { translate } from "../../../i18n/translate.ts";
import type { AppLocale } from "../../../i18n/locale.ts";
import { s } from "../../theme.ts";

export type LoginScreenProps = {
  busy: boolean;
  error: string;
  statusText: string;
  showGuest: boolean;
  locale: AppLocale;
  languageBusy: boolean;
  onChangeLocale: (locale: AppLocale) => void;
  onGuestLogin: () => void;
  onGoogleLogin: () => void;
};

export function LoginScreen({ busy, error, statusText, showGuest, locale, languageBusy, onChangeLocale, onGuestLogin, onGoogleLogin }: LoginScreenProps) {
  return (
    <View style={{ flex: 1, padding: 32, justifyContent: "center", gap: 20 }}>
      <Text style={[s.title, { fontSize: 38 }]}>{translate(locale, 'login.appName')}</Text>
      <Text style={s.text}>{translate(locale, 'login.subtitle')}</Text>
      <LanguageSelector locale={locale} disabled={languageBusy || busy} onChange={onChangeLocale} />
      {showGuest && <AppButton loading={busy} onPress={onGuestLogin}>{translate(locale, 'login.guest')}</AppButton>}
      <AppButton loading={!showGuest && busy} secondary={showGuest} onPress={onGoogleLogin}>{translate(locale, 'login.google')}</AppButton>
      <Text style={s.muted}>{statusText}</Text>
      <Text style={{ color: "#a94232" }}>{error}</Text>
    </View>
  );
}
