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
  onEdit: (item: InventoryItem) => void;
  error?: string;
};

export function InventoryScreen({ inventory, sortMode, todayKey, onOpenSort, onOpenRegistration, onEdit, error }: InventoryScreenProps) {
  return (
    <>
      <AppButton onPress={onOpenRegistration}>재고 등록</AppButton>
      {error ? <Text accessibilityLiveRegion="polite" style={{color:'#a94232'}}>{error}</Text> : null}
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Text style={s.muted}>{inventory.length}종 보관 중</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="재고 정렬 방식 선택" style={s.sortButton} onPress={onOpenSort}>
          <Text style={s.muted}>{sortMode === "expiry" ? "남은 소비기한 순" : "이름순"}</Text>
          <ChevronDown size={16} color={color.muted} />
        </Pressable>
      </View>
      {inventory.map((item) => (
        <View key={item.lotId ?? item.id} style={[s.card, { paddingHorizontal: 14, paddingVertical: 10, gap: 2 }]}>
          <View style={s.row}>
            <Text style={[s.title, { fontSize: 17, flex: 1, minWidth: 0 }]}>
              {item.name}{item.storageMethod === "frozen" ? " · 냉동" : item.storageMethod === "refrigerated" ? " · 냉장" : item.storageMethod === "room_temperature" ? " · 실온" : ""}
            </Text>
            <Text style={[s.text, { flexShrink: 1 }]}>{item.quantity}{item.unit}</Text>
          </View>
          <View style={s.row}>
            <Text style={[s.muted, { flex: 1, minWidth: 0 }]}>
              권장 소진일{item.estimated ? "(추정)" : ""}{" "}
              <Text style={[s.muted, isPastUseBy(item.useBy, todayKey) && s.overdueDate]}>{item.useBy}</Text>
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} ${item.quantity}${item.unit} 재고 수정·삭제`} onPress={() => onEdit(item)} style={{ minHeight: 44, minWidth: 76, flexShrink: 0, justifyContent: "center", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6 }}>
              <Text style={{ color: color.green, fontWeight: "700" }}>수정·삭제</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </>
  );
}
