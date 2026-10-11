import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../components/app-text.tsx';
import { color, s } from '../features/theme.ts';
import type { AppLocale } from './locale.ts';
import { translate } from './translate.ts';

export type LanguageSelectorProps = {
  locale: AppLocale;
  onChange: (locale: AppLocale) => void;
  disabled?: boolean;
};

export function LanguageSelector({ locale, onChange, disabled = false }: LanguageSelectorProps) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup">
      <Text style={s.title}>{translate(locale, 'language.title')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['ko', 'en'] as const).map((option) => {
          const selected = locale === option;
          const label = translate(locale, option === 'ko' ? 'language.korean' : 'language.english');
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: selected ? color.green : color.line,
                backgroundColor: selected ? color.soft : 'white',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <Text style={[s.text, { color: selected ? color.green : color.ink, fontWeight: selected ? '700' : '400' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
