import React from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import type { MenuRecipe } from "../../../domain/menu-chat.ts";
import { AppButton } from "../components/app-button.tsx";
import { color, s } from "../../theme.ts";

export type RecipesScreenProps = {
  savedRecipe: MenuRecipe | null;
  providedAt: string;
  onOpenRecipe: () => void;
  onOpenChat: () => void;
};

export function RecipesScreen({ savedRecipe, providedAt, onOpenRecipe, onOpenChat }: RecipesScreenProps) {
  if (!savedRecipe) {
    return (
      <View style={s.card}>
        <Text style={s.text}>아직 완료한 요리가 없어요.</Text>
        <Text style={s.muted}>채팅에서 레시피를 열고 요리 완료하면 여기에 저장돼요.</Text>
        <AppButton secondary onPress={onOpenChat}>채팅으로 이동</AppButton>
      </View>
    );
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${savedRecipe.title} 상세 열기`} onPress={onOpenRecipe} style={s.card}>
      <View style={s.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[s.title, { fontSize: 17 }]}>{savedRecipe.title}</Text>
          <Text style={s.muted}>제공일 {providedAt.replaceAll("-", ". ")}</Text>
        </View>
        <ChevronRight color={color.ink} size={22} />
      </View>
      <View style={s.row}>
        <Text style={s.badge}>{savedRecipe.minutes}분</Text>
        <Text style={s.badge}>{savedRecipe.servings}인분</Text>
      </View>
    </Pressable>
  );
}
