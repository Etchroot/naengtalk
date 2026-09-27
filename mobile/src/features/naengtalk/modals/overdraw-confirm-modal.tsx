import React from "react";
import { Modal, View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import { AppButton } from "../components/app-button.tsx";
import { s } from "../../theme.ts";

export type OverdrawConfirmModalProps = {
  visible: boolean;
  ingredientName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function OverdrawConfirmModal({ visible, ingredientName, onCancel, onConfirm }: OverdrawConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0008" }}>
        <View style={[s.card, { alignSelf: "center", width: "100%", maxWidth: 440, gap: 16 }]}>
          <Text style={s.title}>재고 사용량 확인</Text>
          <Text style={s.text}>{ingredientName}은(는) 현재 재고보다 많은 수량을 소비했습니다. 전량 소비한 것으로 처리할까요?</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}><AppButton secondary onPress={onCancel}>취소</AppButton></View>
            <View style={{ flex: 1 }}><AppButton onPress={onConfirm}>확인</AppButton></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
