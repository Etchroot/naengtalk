import React from "react";
import { View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import { AppButton } from "../components/app-button.tsx";
import { s } from "../../theme.ts";

export type LoginScreenProps = {
  busy: boolean;
  error: string;
  statusText: string;
  onGuestLogin: () => void;
  onGoogleLogin: () => void;
};

export function LoginScreen({ busy, error, statusText, onGuestLogin, onGoogleLogin }: LoginScreenProps) {
  return (
    <View style={{ flex: 1, padding: 32, justifyContent: "center", gap: 20 }}>
      <Text style={[s.title, { fontSize: 38 }]}>냉톡</Text>
      <Text style={s.text}>대화로 관리하는 냉장고와 레시피</Text>
      <View style={{ height: 28 }} />
      <AppButton loading={busy} onPress={onGuestLogin}>게스트 로그인(심사)</AppButton>
      <AppButton secondary onPress={onGoogleLogin}>구글 로그인</AppButton>
      <Text style={s.muted}>{statusText}</Text>
      <Text style={{ color: "#a94232" }}>{error}</Text>
    </View>
  );
}
