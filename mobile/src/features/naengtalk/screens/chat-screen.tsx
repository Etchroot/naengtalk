import React from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import type { ChatMessage, MenuRecipe } from "../../../domain/menu-chat.ts";
import { recipeDisplayReason } from "../../../domain/recipe-provenance.ts";
import { breakSentences } from "../../../domain/readable-text.ts";
import { AppButton } from "../components/app-button.tsx";
import { color, s } from "../../theme.ts";

export type ChatScreenProps = {
  chat: ChatMessage[];
  recipe: MenuRecipe | null;
  input: string;
  error: string;
  aiBusy: boolean;
  composerLayout: { horizontalPadding: number; gap: number; sendButtonWidth: number };
  onChangeInput: (value: string) => void;
  onSend: () => void;
  onOpenRecipe: () => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
};

export function ChatScreen({
  chat,
  recipe,
  input,
  error,
  aiBusy,
  composerLayout,
  onChangeInput,
  onSend,
  onOpenRecipe,
  onInputFocus,
  onInputBlur,
}: ChatScreenProps) {
  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.text}>
            오늘은 어떤 메뉴가 당기세요? 시간, 맛, 원하는 메뉴를 말하면 현재 재고와 조리도구에 맞춰 한 가지를 추천해드려요.
          </Text>
        </View>
        {chat.map((item, index) => (
          <View
            key={`${item.role}-${index}`}
            style={[s.card, item.role === "user" ? { backgroundColor: color.green, marginLeft: 42 } : { marginRight: 24 }]}
          >
            <Text style={[s.text, item.role === "user" && { color: "white" }]}>{breakSentences(item.content)}</Text>
          </View>
        ))}
        {aiBusy ? (
          <View style={[s.card, { marginRight: 24 }]}>
            <View style={s.loadingRow}>
              <Text accessibilityLiveRegion="polite" style={[s.muted, { flex: 1 }]}>냉장고와 레시피를 확인하고 있어요…</Text>
              <ActivityIndicator size="small" color={color.green} />
            </View>
          </View>
        ) : null}
        {recipe ? (
          <View style={[s.card, { backgroundColor: color.soft }]}>
            <Text style={s.title}>{recipe.title}</Text>
            <Text style={s.text}>{breakSentences(recipeDisplayReason(recipe))}</Text>
            <AppButton secondary onPress={onOpenRecipe}>레시피 전체 보기</AppButton>
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={{ color: "#a94232" }}>{error}</Text> : null}
      </ScrollView>
      <View style={[s.chatComposer, { paddingHorizontal: composerLayout.horizontalPadding, paddingVertical: 12, gap: composerLayout.gap }]}>
        <TextInput
          style={s.chatComposerInput}
          placeholder="먹고 싶은 메뉴를 말해보세요"
          value={input}
          onChangeText={onChangeInput}
          editable={!aiBusy}
          onSubmitEditing={onSend}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: aiBusy, busy: aiBusy }}
          disabled={aiBusy}
          onPress={onSend}
          style={[s.chatSendButton, { width: composerLayout.sendButtonWidth }, aiBusy && s.buttonDisabled]}
        >
          {aiBusy ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={s.buttonText}>전송</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}
