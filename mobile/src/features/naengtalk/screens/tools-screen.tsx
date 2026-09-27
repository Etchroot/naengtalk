import React from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "../../../components/app-text.tsx";
import { AppButton } from "../components/app-button.tsx";
import { s } from "../../theme.ts";

export type ToolsScreenProps = {
  tools: string[];
  input: string;
  cardWidth: number;
  cardAspectRatio: number;
  onChangeInput: (value: string) => void;
  onAddTool: () => void;
  onRemoveTool: (index: number) => void;
};

export function ToolsScreen({ tools, input, cardWidth, cardAspectRatio, onChangeInput, onAddTool, onRemoveTool }: ToolsScreenProps) {
  return (
    <>
      <TextInput style={s.input} accessibilityLabel="조리도구" placeholder="예: 2.5L 냄비" value={input} onChangeText={onChangeInput} />
      <AppButton onPress={onAddTool}>조리도구 입력</AppButton>
      <View style={s.grid}>
        {tools.map((tool, index) => (
          <View style={[s.card, s.toolCard, { width: cardWidth, aspectRatio: cardAspectRatio }]} key={`${tool}-${index}`}>
            <View style={s.toolCardNameArea}><Text style={s.toolCardName}>{tool}</Text></View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${tool} 조리도구 삭제`}
              style={({ pressed }) => [s.toolDeleteButton, pressed && s.toolDeleteButtonPressed]}
              onPress={() => onRemoveTool(index)}
            >
              <Text style={s.toolDeleteText}>삭제</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </>
  );
}
