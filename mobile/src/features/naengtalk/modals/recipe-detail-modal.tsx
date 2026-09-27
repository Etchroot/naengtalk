import React, { useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThumbsUp } from "lucide-react-native";
import { Text } from "../../../components/app-text.tsx";
import type { InventoryItem } from "../../../domain/cooking.ts";
import type { MenuRecipe } from "../../../domain/menu-chat.ts";
import { recipeDisplayReason } from "../../../domain/recipe-provenance.ts";
import { formatCookingStepTitle } from "../../../domain/recipe-presentation.ts";
import { breakSentences } from "../../../domain/readable-text.ts";
import type { UsageDraft } from "../../../domain/usage-review.ts";
import { AppButton } from "../components/app-button.tsx";
import { color, s } from "../../theme.ts";

export type RecipeDetailModalProps = {
  visible: boolean;
  recipe: MenuRecipe;
  providedAt: string;
  timer: React.ReactNode;
  review: boolean;
  usageDraft: UsageDraft[];
  inventory: InventoryItem[];
  error: string;
  returnLabel: string;
  canShare: boolean;
  sharePending: boolean;
  shared: boolean;
  shareBusy: boolean;
  safeAreaStyle: StyleProp<ViewStyle>;
  appViewportStyle: StyleProp<ViewStyle>;
  appFrameStyle: StyleProp<ViewStyle>;
  headerMetrics: {
    padding: number;
    gap: number;
    titleFontSize: number;
    titleLineHeight: number;
  };
  onRequestClose: () => void;
  onBack: () => void;
  onStartTimer: (stepIndex: number, minutes: number) => void;
  onChangeUsage: (ingredientId: string, quantityText: string) => void;
  onFinishCooking: () => void;
  onStartUsageReview: () => void;
  onConfirmShare: () => void;
};

export function RecipeDetailModal({
  visible,
  recipe,
  providedAt,
  timer,
  review,
  usageDraft,
  inventory,
  error,
  returnLabel,
  canShare,
  sharePending,
  shared,
  shareBusy,
  safeAreaStyle,
  appViewportStyle,
  appFrameStyle,
  headerMetrics,
  onRequestClose,
  onBack,
  onStartTimer,
  onChangeUsage,
  onFinishCooking,
  onStartUsageReview,
  onConfirmShare,
}: RecipeDetailModalProps) {
  const scroll = useRef<ScrollView>(null);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onRequestClose}>
      <View style={s.stage}>
        <SafeAreaView style={safeAreaStyle}>
          <View style={appViewportStyle}>
            <View style={appFrameStyle}>
              <View style={[s.header, { padding: headerMetrics.padding, gap: headerMetrics.gap }]}>
                <Text style={[s.title, { fontSize: headerMetrics.titleFontSize, lineHeight: headerMetrics.titleLineHeight }]}>{recipe.title}</Text>
              </View>
              {timer}
              <ScrollView
                ref={scroll}
                onContentSizeChange={() => { if (review) scroll.current?.scrollToEnd({ animated: true }); }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.content}
              >
                <Text style={s.muted}>제공일 {providedAt.replaceAll("-", ". ")} · {recipe.servings}인분 · {recipe.minutes}분</Text>
                <Text style={s.badge}>{breakSentences(recipeDisplayReason(recipe))}</Text>
                <View style={s.card}>
                  <Text style={s.title}>준비 재료</Text>
                  {recipe.ingredients.map((ingredient, index) => (
                    <Text key={`${ingredient.name}-${index}`} style={s.text}>
                      {ingredient.name}
                      {ingredient.quantity !== null && ingredient.unit ? ` ${ingredient.quantity}${ingredient.unit}` : ""}
                      {ingredient.requiredPurchase ? " · 구매 필요" : ""}
                    </Text>
                  ))}
                </View>
                {recipe.steps.map((step, index) => (
                  <View style={s.card} key={index}>
                    <Text style={[s.title, { fontSize: 16 }]}>{formatCookingStepTitle(index)}</Text>
                    <Text style={s.text}>{breakSentences(step.text)}</Text>
                    {step.minutes > 0 ? (
                      <AppButton secondary onPress={() => onStartTimer(index, step.minutes)}>{`${step.minutes}분 타이머 시작`}</AppButton>
                    ) : null}
                  </View>
                ))}
                {review ? (
                  <View style={[s.card, { backgroundColor: color.soft }]}>
                    <Text style={s.title}>사용량을 확인해주세요</Text>
                    {usageDraft.map((line) => {
                      const name = inventory.find((item) => item.id === line.ingredientId)?.name;
                      return (
                        <View key={line.ingredientId} style={s.usageRow}>
                          <Text style={[s.text, { flex: 1 }]}>{name}</Text>
                          <TextInput
                            accessibilityLabel={`${name ?? "재료"} 사용량`}
                            inputMode="decimal"
                            value={line.quantityText}
                            onChangeText={(quantityText) => onChangeUsage(line.ingredientId, quantityText)}
                            style={s.usageInput}
                          />
                          <Text style={s.text}>{line.unit}</Text>
                        </View>
                      );
                    })}
                    <Text style={s.muted}>확정하면 현재 재고에서 차감합니다.</Text>
                    <AppButton onPress={onFinishCooking}>사용량 확정</AppButton>
                  </View>
                ) : null}
                {error ? <Text accessibilityRole="alert" style={{ color: "#a94232" }}>{error}</Text> : null}
              </ScrollView>
              <View style={[s.footer, s.row]}>
                <View style={{ flex: 1 }}><AppButton secondary onPress={onBack}>{returnLabel}</AppButton></View>
                {canShare ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={shared ? "공유된 레시피" : "레시피 좋아요 및 공유"}
                    accessibilityState={{ disabled: shared || shareBusy, busy: shareBusy }}
                    disabled={shared || shareBusy}
                    onPress={onConfirmShare}
                    style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                  >
                    {shareBusy ? <ActivityIndicator size="small" color={color.green} /> : (
                      <ThumbsUp
                        size={24}
                        color={sharePending || shared ? "#D9A900" : color.green}
                        fill={sharePending || shared ? "#FFD64D" : "transparent"}
                      />
                    )}
                  </Pressable>
                ) : null}
                <AppButton onPress={onStartUsageReview}>요리 완료</AppButton>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
