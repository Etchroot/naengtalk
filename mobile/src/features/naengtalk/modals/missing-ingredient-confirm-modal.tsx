import React from "react";
import { Modal, View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import { AppButton } from "../components/app-button.tsx";
import { s } from "../../theme.ts";

export type MissingIngredientConfirmModalProps = {
  visible: boolean;
  ingredients: string[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MissingIngredientConfirmModal({
  visible,
  ingredients,
  busy,
  onCancel,
  onConfirm,
}: MissingIngredientConfirmModalProps) {
  const ingredientLabel = ingredients.join(", ") || "요청한 재료";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0007" }}>
        <View style={[s.card, { alignSelf: "center", width: "100%", maxWidth: 440, gap: 16 }]}>
          <Text style={s.title}>재고에 없는 재료</Text>
          <Text style={s.text}>
            {`${ingredientLabel}은(는) 현재 재고에 없습니다. 그래도 이 재료를 포함한 레시피를 만들까요?`}
          </Text>
          <Text style={s.muted}>
            계속 진행하면 이 재료만 구매가 필요한 항목으로 표시됩니다.
          </Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <AppButton secondary disabled={busy} onPress={onCancel}>취소</AppButton>
            </View>
            <View style={{ flex: 1 }}>
              <AppButton loading={busy} onPress={onConfirm}>계속 진행</AppButton>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
