import React from "react";
import { Pressable, View } from "react-native";
import {
  CookingPot,
  Home,
  MessageCircle,
  NotebookText,
  Package,
  Settings,
} from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import type { AppTab } from "../model.ts";
import { color, s } from "../../theme.ts";

const tabs = ["홈", "채팅", "재고", "레시피", "조리도구", "설정"] as const;
const icons = [Home, MessageCircle, Package, NotebookText, CookingPot, Settings] as const;

export type BottomNavigationProps = {
  tab: AppTab;
  onSelect: (tab: AppTab) => void;
  scale: number;
};

export function BottomNavigation({ tab, onSelect, scale }: BottomNavigationProps) {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("scale must be a positive number");
  }
  return (
    <View style={s.nav}>
      {tabs.map((name, index) => {
        const Icon = icons[index];
        const target = index as AppTab;
        return (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === target }}
            style={s.tab}
            onPress={() => onSelect(target)}
          >
            <Icon size={22} color={tab === target ? color.green : color.muted} />
            <Text
              style={{
                fontSize: 11,
                color: tab === target ? color.green : color.muted,
              }}
            >
              {name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
