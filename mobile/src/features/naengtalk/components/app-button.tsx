import React from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import { color, s } from "../../theme.ts";

export type AppButtonProps = {
  children: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  disabled?: boolean;
};

export function AppButton({
  children,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
}: AppButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, inactive && s.buttonDisabled]}
    >
      <View style={s.buttonContent}>
        <Text style={[s.buttonText, secondary && { color: color.green }]}>
          {children}
        </Text>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={secondary ? color.green : "white"}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
