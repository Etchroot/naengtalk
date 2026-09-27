import React from "react";
import { Modal, View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import { AppButton } from "../components/app-button.tsx";
import { s } from "../../theme.ts";

export type ShareConsentModalProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirmShare: () => void;
};

export function ShareConsentModal({ visible, onCancel, onConfirmShare }: ShareConsentModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0007" }}>
        <View style={[s.card, { alignSelf: "center", width: "100%", maxWidth: 440, gap: 16 }]}>
          <Text style={s.title}>레시피 공유</Text>
          <Text style={s.text}>좋아요 표시를 하면 이 레시피가 다른 사용자도 이용할 수 있도록 공유됩니다.</Text>
          <View style={s.row}>
            <View style={{ flex: 1 }}><AppButton secondary onPress={onCancel}>취소</AppButton></View>
            <View style={{ flex: 1 }}><AppButton onPress={onConfirmShare}>확인</AppButton></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
