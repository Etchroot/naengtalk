import type { TextProps } from "react-native";
import { StyleSheet, Text as NativeText } from "react-native";

import { getAppFontFamily } from "../domain/typography.ts";

export function Text({ style, ...props }: TextProps) {
  const flattenedStyle = StyleSheet.flatten(style);
  const fontFamily = getAppFontFamily(flattenedStyle?.fontWeight);

  return (
    <NativeText
      {...props}
      style={[style, { fontFamily }]}
    />
  );
}
