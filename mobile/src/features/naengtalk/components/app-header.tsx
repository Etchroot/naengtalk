import React from "react";
import { Image, Pressable, View } from "react-native";
import { Home } from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import { getCompactHeaderMetrics } from "../../../domain/home-layout.ts";
import type { AppTab } from "../model.ts";
import { color, s } from "../../theme.ts";

export type AppHeaderProps = {
  tab: AppTab;
  title: string;
  onHome: () => void;
  scale: number;
};

export function AppHeader({ tab, title, onHome, scale }: AppHeaderProps) {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("scale must be a positive number");
  }
  const metrics = getCompactHeaderMetrics();
  return (
    <View style={[s.header, { padding: metrics.padding, gap: metrics.gap }]}>
      {tab === 0 ? (
        <View
          accessibilityElementsHidden
          style={[
            s.home,
            {
              width: metrics.controlSize,
              height: metrics.controlSize,
              borderRadius: metrics.controlRadius,
            },
          ]}
        >
          <Image
            source={require("../../../../assets/images/icon.png")}
            resizeMode="contain"
            style={{ width: metrics.logoSize, height: metrics.logoSize }}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="홈으로 이동"
          style={[
            s.home,
            {
              width: metrics.controlSize,
              height: metrics.controlSize,
              borderRadius: metrics.controlRadius,
            },
          ]}
          onPress={onHome}
        >
          <Home size={metrics.homeIconSize} color={color.ink} />
        </Pressable>
      )}
      <View style={s.headerCopy}>
        <Text
          style={[
            s.title,
            s.headerTitle,
            { fontSize: metrics.titleFontSize, lineHeight: metrics.titleLineHeight },
          ]}
        >
          {title}
        </Text>
        {tab === 0 ? (
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            style={[
              s.muted,
              s.headerTagline,
              { fontSize: metrics.taglineFontSize, lineHeight: metrics.taglineLineHeight },
            ]}
          >
            오늘도 남김없이, 나만의 한 끼
          </Text>
        ) : null}
      </View>
    </View>
  );
}
