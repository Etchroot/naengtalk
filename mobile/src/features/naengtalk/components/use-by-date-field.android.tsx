import React from 'react';
import { Keyboard, Pressable } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { Text } from '../../../components/app-text.tsx';
import { calendarInitialDate, confirmedCalendarDate } from '../../../domain/calendar-date.ts';
import type { UseByDateFieldProps } from './use-by-date-field.tsx';
import { color, s } from '../../theme.ts';

export function UseByDateField({ value, label, disabled, allowPast = false, onChange }: UseByDateFieldProps) {
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value.slice(0, 4)}년 ${Number(value.slice(5, 7))}월 ${Number(value.slice(8, 10))}일`
    : '날짜 선택';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${dateLabel}, 달력 열기`}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={[s.input, { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
      onPress={() => {
        Keyboard.dismiss();
        const now = new Date();
        DateTimePickerAndroid.open({
          value: calendarInitialDate(value, now, allowPast),
          minimumDate: allowPast ? undefined : new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          mode: 'date',
          display: 'calendar',
          onChange: (event, selected) => {
            const confirmed = confirmedCalendarDate(event.type, selected, new Date(), allowPast);
            if (confirmed !== null) onChange(confirmed);
          },
        });
      }}
    >
      <Text style={s.text}>{dateLabel}</Text>
      <CalendarDays size={20} color={color.green} />
    </Pressable>
  );
}
