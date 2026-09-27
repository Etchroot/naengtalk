import React from "react";
import { Modal, Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import type { InventorySortMode } from "../../../domain/inventory-presentation.ts";
import { color, s } from "../../theme.ts";

export type InventorySortModalProps = {
  visible: boolean;
  sortMode: InventorySortMode;
  onClose: () => void;
  onSelect: (mode: InventorySortMode) => void;
};

export function InventorySortModal({ visible, sortMode, onClose, onSelect }: InventorySortModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0007" }} onPress={onClose}>
        <View style={[s.card, { alignSelf: "center", width: "100%", maxWidth: 360 }]}>
          <Text style={s.title}>재고 정렬</Text>
          {([['expiry', '남은 소비기한 순'], ['name', '이름순']] as const).map(([mode, label]) => (
            <Pressable accessibilityRole="button" key={mode} style={[s.row, { minHeight: 48 }]} onPress={() => onSelect(mode)}>
              <Text style={[s.text, { flex: 1 }]}>{label}</Text>
              {sortMode === mode ? <Check size={20} color={color.green} /> : null}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
