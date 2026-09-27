import React from "react";
import { Pressable, View } from "react-native";
import { MessageCircle, Package } from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import type { InventoryItem } from "../../../domain/cooking.ts";
import { getRefrigeratorDoorSurface, getUrgentCardMinHeight } from "../../../domain/home-layout.ts";
import { isPastUseBy } from "../../../domain/date-presentation.ts";
import { RefrigeratorHandle } from "../components/refrigerator-handle.tsx";
import { color, s } from "../../theme.ts";

export type HomeScreenProps = {
  inventory: InventoryItem[];
  today: { key: string; label: string };
  urgentInventoryLimit: number;
  homeActionTitleFontSize: number;
  onOpenRegistration: () => void;
  onOpenChat: () => void;
};

export function HomeScreen({
  inventory,
  today,
  urgentInventoryLimit,
  homeActionTitleFontSize,
  onOpenRegistration,
  onOpenChat,
}: HomeScreenProps) {
  const urgentInventory = [...inventory]
    .filter((item) => item.quantity > 0)
    .sort((left, right) => left.useBy.localeCompare(right.useBy))
    .slice(0, urgentInventoryLimit);

  return (
    <View style={s.homeLayout}>
      <View
        style={[
          s.card,
          s.refrigeratorDoor,
          getRefrigeratorDoorSurface("fresh"),
          { flex: 2, minHeight: getUrgentCardMinHeight(urgentInventoryLimit) },
        ]}
      >
        <RefrigeratorHandle tone="fresh" />
        <View style={s.urgentHeadingRow}>
          <View style={s.urgentHeadingCopy}>
            <Text style={s.title}>먼저 먹으면 좋겠어요</Text>
            <Text style={s.muted}>권장 소진일이 가까운 재료</Text>
          </View>
          <View style={s.todayBox}>
            <Text style={s.todayLabel}>Today</Text>
            <Text style={s.todayDate}>{today.label}</Text>
          </View>
        </View>
        {urgentInventory.map((item) => (
          <View style={[s.row, { paddingVertical: 10 }]} key={item.id}>
            <Text style={[s.text, { flex: 1 }]}>{item.name}</Text>
            <View style={s.row}>
              <Text style={s.muted}>{item.quantity}{item.unit}</Text>
              <Text style={[s.muted, s.urgentUseBy, isPastUseBy(item.useBy, today.key) && s.overdueDate]}>
                {item.useBy.slice(5).replace("-", ".")}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={[s.row, s.homeActions]}>
        <Pressable
          style={({ pressed }) => [
            s.card,
            s.refrigeratorDoor,
            getRefrigeratorDoorSurface("warm", pressed),
            { flex: 1, justifyContent: "center" },
          ]}
          onPress={onOpenRegistration}
        >
          <RefrigeratorHandle tone="warm" />
          <Package color={color.green} />
          <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[s.title, { fontSize: homeActionTitleFontSize }]}>
            구매내역 등록
          </Text>
          <Text style={s.muted}>냉장고 채우기</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            s.card,
            s.refrigeratorDoor,
            getRefrigeratorDoorSurface("neutral", pressed),
            { flex: 1, justifyContent: "center" },
          ]}
          onPress={onOpenChat}
        >
          <RefrigeratorHandle tone="neutral" />
          <MessageCircle color={color.green} />
          <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[s.title, { fontSize: homeActionTitleFontSize }]}>
            오늘 뭐 먹지?
          </Text>
          <Text style={s.muted}>메뉴 상담하기</Text>
        </Pressable>
      </View>
    </View>
  );
}
