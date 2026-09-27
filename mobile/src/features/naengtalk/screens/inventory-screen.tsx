import React from "react";
import { Pressable, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import type { InventoryItem } from "../../../domain/cooking.ts";
import type { InventorySortMode } from "../../../domain/inventory-presentation.ts";
import { isPastUseBy } from "../../../domain/date-presentation.ts";
import { AppButton } from "../components/app-button.tsx";
import { color, s } from "../../theme.ts";

export type InventoryScreenProps = {
  inventory: InventoryItem[];
  sortMode: InventorySortMode;
  todayKey: string;
  onOpenSort: () => void;
  onOpenRegistration: () => void;
};

export function InventoryScreen({ inventory, sortMode, todayKey, onOpenSort, onOpenRegistration }: InventoryScreenProps) {
  return (
    <>
      <AppButton onPress={onOpenRegistration}>재고 등록</AppButton>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Text style={s.muted}>{inventory.length}종 보관 중</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="재고 정렬 방식 선택" style={s.sortButton} onPress={onOpenSort}>
          <Text style={s.muted}>{sortMode === "expiry" ? "남은 소비기한 순" : "이름순"}</Text>
          <ChevronDown size={16} color={color.muted} />
        </Pressable>
      </View>
      {inventory.map((item) => (
        <View key={item.id} style={s.card}>
          <View style={s.row}>
            <Text style={[s.title, { fontSize: 17, flex: 1 }]}>
              {item.name}{item.storageMethod === "frozen" ? " · 냉동" : item.storageMethod === "refrigerated" ? " · 냉장" : item.storageMethod === "room_temperature" ? " · 실온" : ""}
            </Text>
            <Text style={s.text}>{item.quantity}{item.unit}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.muted}>권장 소진일(샘플 추정)</Text>
            <Text style={[s.muted, isPastUseBy(item.useBy, todayKey) && s.overdueDate]}>{item.useBy}</Text>
          </View>
        </View>
      ))}
    </>
  );
}
