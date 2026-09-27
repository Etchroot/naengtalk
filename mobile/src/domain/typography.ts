import type { TextStyle } from "react-native";

export type AppFontFamily =
  | "SUIT-Regular"
  | "SUIT-Medium"
  | "SUIT-SemiBold"
  | "SUIT-Bold";

export function getAppFontFamily(
  fontWeight: TextStyle["fontWeight"],
): AppFontFamily {
  if (fontWeight === "bold") return "SUIT-Bold";
  if (fontWeight === "normal" || fontWeight == null) return "SUIT-Regular";

  const numericWeight = typeof fontWeight === "number"
    ? fontWeight
    : Number.parseInt(fontWeight, 10);

  if (numericWeight >= 700) return "SUIT-Bold";
  if (numericWeight >= 600) return "SUIT-SemiBold";
  if (numericWeight >= 500) return "SUIT-Medium";
  return "SUIT-Regular";
}
