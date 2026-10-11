import React from 'react';
import { TextInput } from 'react-native';
import { s } from '../../theme.ts';

export type UseByDateFieldProps = {
  value: string;
  label: string;
  disabled?: boolean;
  allowPast?: boolean;
  onChange: (value: string) => void;
};

export function UseByDateField({ value, label, disabled, onChange }: UseByDateFieldProps) {
  return <TextInput accessibilityLabel={label} inputMode="text" autoCorrect={false} placeholder="YYYY-MM-DD 또는 숫자 8자리" value={value} onChangeText={onChange} editable={!disabled} style={s.input} />;
}
