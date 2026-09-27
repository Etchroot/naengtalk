import React from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import { AppButton } from "../components/app-button.tsx";
import { s } from "../../theme.ts";

export type SettingsScreenProps = {
  allergens: string[];
  allergenInput: string;
  busy: boolean;
  onChangeAllergenInput: (value: string) => void;
  onAddAllergen: () => void;
  onRemoveAllergen: (allergen: string) => void;
  onResetDemo: () => void;
  onLogout: () => void;
};

export function SettingsScreen({
  allergens,
  allergenInput,
  busy,
  onChangeAllergenInput,
  onAddAllergen,
  onRemoveAllergen,
  onResetDemo,
  onLogout,
}: SettingsScreenProps) {
  return (
    <>
      <View style={s.card}>
        <Text style={s.title}>알레르기 항목</Text>
        <Text style={s.muted}>등록된 항목은 레시피를 만들기 전에 AI와 안전 검사에서 확인합니다.</Text>
        <TextInput style={s.input} accessibilityLabel="알레르기 항목" placeholder="예: 새우" value={allergenInput} onChangeText={onChangeAllergenInput} />
        <AppButton onPress={onAddAllergen}>알레르기 등록</AppButton>
      </View>
      <View style={[s.card, s.allergyListCard]}>
        <Text style={s.title}>알레르기 목록</Text>
        {allergens.length ? allergens.map((allergen) => (
          <View key={allergen} style={s.allergyRow}>
            <View style={s.allergyLabel}>
              <Text style={s.allergyBullet}>•</Text>
              <Text style={[s.text, { flex: 1 }]}>{allergen}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${allergen} 알레르기 삭제`}
              style={({ pressed }) => [s.allergyDeleteButton, pressed && s.toolDeleteButtonPressed]}
              onPress={() => onRemoveAllergen(allergen)}
            >
              <Text style={s.toolDeleteText}>삭제</Text>
            </Pressable>
          </View>
        )) : <Text style={s.muted}>등록된 알레르기 없음</Text>}
      </View>
      <AppButton secondary onPress={onResetDemo}>{busy ? "초기화 중…" : "샘플 데이터 초기화"}</AppButton>
      <AppButton secondary onPress={onLogout}>{busy ? "로그아웃 중…" : "로그아웃"}</AppButton>
    </>
  );
}
